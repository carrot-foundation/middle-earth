import { THEMES } from '../config.constants.js';
import { curateTrellisArticles, type TrellisCandidate } from '../ai/trellis-curator.js';
import { sanitizeArticleText } from '../helpers/content.helpers.js';
import { parseDate } from '../helpers/date.helpers.js';
import {
  FirecrawlError,
  extractMarkdownLinks,
  firecrawlScrape,
} from '../helpers/firecrawl.helpers.js';
import type { RawArticle, ThemeConfig } from '../types.js';

const MAX_ARTICLES_PER_THEME = 1;
// Hard cap on per-theme candidate scrapes — parity with esg-news.ts.
// Without it, a listing with N links iterates until 1 succeeds or the list
// is exhausted, burning 1 credit per failed publish-date / freshness /
// sanitization skip. Listing is date-desc; past #5 candidates drift toward
// the freshness cliff anyway.
const MAX_CANDIDATES_PER_THEME = 5;
const MAX_ARTICLE_AGE_DAYS = 30;
const CANDIDATE_POOL_SIZE = 15;
const PER_THEME_LISTING_URL_BASE = 'https://trellis.net/?s=';
// Trellis's own date-ordered articles index — same URL the pre-Firecrawl
// Playwright scraper used as `LISTING_URL` for the curation broad pool.
// One scrape per pipeline run, shared across all eligible themes.
const CURATION_LISTING_URL = 'https://trellis.net/articles/';

// Trellis articles live at trellis.net/article/...; the old Playwright code only
// ever followed `a[href*="/article/"]`. Require both an in-domain host and the
// article path so a listing-page menu/footer link can't steer us elsewhere.
function isTrellisArticleUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== 'trellis.net' && !host.endsWith('.trellis.net')) return false;
  // Lowercase the path before the contains-check so a future CMS migration
  // serving `/Article/` (or otherwise mixed-case) doesn't silently lose
  // every candidate; parity with the ESG predicate above.
  return parsed.pathname.toLowerCase().includes('/article/');
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof FirecrawlError && (error.status === 402 || error.status === 429)
  );
}

/**
 * Scrape one Trellis URL into a RawArticle, applying the shared freshness +
 * sanitization barrier. Returns null for skip conditions (undated, too old,
 * empty after sanitization). Throws FirecrawlError so callers can handle
 * quota/rate-limit (402/429) by aborting their loop while keeping partials.
 */
async function scrapeArticle(
  url: string,
  title: string,
  mainTheme: string,
  apiKey: string,
): Promise<RawArticle | null> {
  const scraped = await firecrawlScrape(url, apiKey);
  // No reliable publish date — skip rather than stamp it "today" and let a
  // stale article bypass the freshness window (parity with esg/carbon-pulse).
  // Split missing-vs-unparseable so a Firecrawl metadata-schema regression
  // is visibly distinct from publisher pages that genuinely lack a date.
  if (!scraped.publishedTime) {
    console.warn(`[Trellis] No publish_time metadata, skipping: ${url}`);
    return null;
  }
  const articleDate = parseDate(scraped.publishedTime);
  if (!articleDate) {
    console.error(
      `[Trellis] Unparseable publish_time "${scraped.publishedTime}", skipping: ${url}`,
    );
    return null;
  }
  const ageMs = Date.now() - new Date(articleDate).getTime();
  if (ageMs > MAX_ARTICLE_AGE_DAYS * 24 * 60 * 60 * 1000) {
    console.warn(`[Trellis] Article too old (${articleDate}), skipping: ${url}`);
    return null;
  }
  const cleanContent = sanitizeArticleText(scraped.markdown);
  if (!cleanContent) {
    console.warn(`[Trellis] No article body after sanitization, skipping: ${url}`);
    return null;
  }
  return {
    source: 'trellis',
    url,
    title,
    date: articleDate,
    author: scraped.author || 'Trellis',
    mainTheme,
    categories: '',
    location: '',
    fullContent: cleanContent,
  };
}

interface ThemeDiscoveryResult {
  readonly articles: RawArticle[];
  readonly quotaExhausted: boolean;
}

async function discoverThemeAndScrape(
  theme: ThemeConfig,
  processedUrls: ReadonlySet<string>,
  apiKey: string,
): Promise<ThemeDiscoveryResult> {
  // Per-theme discovery: Trellis's own WordPress search (default
  // publish-date-desc ordering), then extract `/article/` permalinks from
  // the returned markdown. Replaces the `/v2/search` flow whose upstream
  // index lacked dates for this publisher.
  const listingUrl = `${PER_THEME_LISTING_URL_BASE}${encodeURIComponent(theme.trellisSearchTerms)}`;
  const listing = await firecrawlScrape(listingUrl, apiKey);

  const candidates = extractMarkdownLinks(listing.markdown, ({ url }) => {
    if (!isTrellisArticleUrl(url)) return false;
    if (processedUrls.has(url)) return false;
    return true;
  });

  // Cap on *successful* extractions plus a hard ceiling on attempts
  // (MAX_CANDIDATES_PER_THEME) so a low-yield listing can't drain credits
  // through the entire link list. Listing is date-desc; freshest first.
  const articles: RawArticle[] = [];
  for (const candidate of candidates.slice(0, MAX_CANDIDATES_PER_THEME)) {
    if (articles.length >= MAX_ARTICLES_PER_THEME) break;
    try {
      const article = await scrapeArticle(candidate.url, candidate.title, theme.name, apiKey);
      if (article) articles.push(article);
    } catch (error: unknown) {
      if (isQuotaError(error)) {
        console.error(
          `[Trellis] Firecrawl quota/rate limit — aborting theme, keeping ${articles.length} collected`,
        );
        return { articles, quotaExhausted: true };
      }
      const message = error instanceof Error ? error.message : 'unknown';
      console.error(`[Trellis] Failed to extract "${candidate.title}": ${message}`);
    }
  }
  return { articles, quotaExhausted: false };
}

async function collectCandidates(
  excludeUrls: ReadonlySet<string>,
  apiKey: string,
): Promise<TrellisCandidate[]> {
  // Single broad-pool scrape per run; shared across all themes via the curator.
  const listing = await firecrawlScrape(CURATION_LISTING_URL, apiKey);
  // Over-request: host/exclude/dedup filtering would otherwise shrink the pool
  // below CANDIDATE_POOL_SIZE with no top-up. extractMarkdownLinks already
  // dedupes URLs preserving order, so the predicate just enforces host/path
  // and the running exclude set.
  const links = extractMarkdownLinks(listing.markdown, ({ url }) => {
    if (!isTrellisArticleUrl(url)) return false;
    if (excludeUrls.has(url)) return false;
    return true;
  });
  // Cap the pool to twice CANDIDATE_POOL_SIZE so the curator has headroom
  // to reject low-quality candidates without us re-querying.
  return links.slice(0, CANDIDATE_POOL_SIZE * 2).map((link) => ({
    url: link.url,
    title: link.title,
    // Markdown extraction doesn't expose the listing card's excerpt the old
    // Playwright code did; fall back to the title (matches the curator
    // contract — it just wants enough signal to rank).
    date: '',
    excerpt: link.title,
  }));
}

export async function scrapeTrellis(
  themes: readonly ThemeConfig[],
  processedUrls: ReadonlySet<string>,
  anthropicApiKey: string,
  firecrawlApiKey: string,
): Promise<RawArticle[]> {
  if (!firecrawlApiKey) {
    throw new Error('FIRECRAWL_API_KEY not configured — Trellis scraping skipped');
  }

  const perTheme: RawArticle[] = [];
  // Carry URLs scraped under earlier themes forward, so an article matching
  // multiple themes isn't re-discovered, re-scraped (wasting a credit) and
  // returned twice.
  const seenUrls = new Set(processedUrls);
  let quotaExhausted = false;
  for (const theme of themes) {
    console.log(`[Trellis] Discovering: ${theme.name}`);
    try {
      const result = await discoverThemeAndScrape(theme, seenUrls, firecrawlApiKey);
      perTheme.push(...result.articles);
      for (const article of result.articles) seenUrls.add(article.url);
      console.log(`[Trellis] Found ${result.articles.length} article(s) for ${theme.name}`);
      if (result.quotaExhausted) {
        quotaExhausted = true;
        break;
      }
    } catch (error: unknown) {
      // A 402/429 from the listing scrape itself (not the article scrape)
      // propagates here; treat it as quota exhaustion too, so remaining
      // themes + curation are skipped rather than hammering the exhausted API.
      if (isQuotaError(error)) {
        console.error('[Trellis] Firecrawl quota/rate limit during theme discovery — aborting remaining themes.');
        quotaExhausted = true;
        break;
      }
      const message = error instanceof Error ? error.message : 'unknown';
      console.error(`[Trellis] Discovery failed for "${theme.name}": ${message}`);
    }
  }

  // Out of Firecrawl credits — don't spend an Anthropic call + more scrapes on
  // the curation flow that would only hit the same wall.
  if (quotaExhausted) {
    console.warn('[Trellis] Firecrawl quota exhausted — skipping curation flow.');
    return [...perTheme];
  }

  const exclude = new Set<string>([...processedUrls, ...perTheme.map((article) => article.url)]);
  const curated: RawArticle[] = [];
  try {
    const candidates = await collectCandidates(exclude, firecrawlApiKey);
    if (candidates.length === 0) {
      console.warn('[Trellis] No curation candidates collected; skipping curation.');
    } else {
      const candidateByUrl = new Map(candidates.map((candidate) => [candidate.url, candidate]));
      const allThemeNames = THEMES.map((theme) => theme.name);
      const picks = await curateTrellisArticles(candidates, allThemeNames, anthropicApiKey);
      const scrapedPickUrls = new Set<string>();
      for (const pick of picks) {
        const candidate = candidateByUrl.get(pick.url);
        if (!candidate || scrapedPickUrls.has(pick.url)) continue;
        scrapedPickUrls.add(pick.url);
        try {
          const article = await scrapeArticle(candidate.url, candidate.title, pick.mainTheme, firecrawlApiKey);
          if (article) curated.push(article);
        } catch (error: unknown) {
          if (isQuotaError(error)) {
            console.error(
              `[Trellis] Firecrawl quota/rate limit on curated pick — keeping ${curated.length} collected`,
            );
            break;
          }
          const message = error instanceof Error ? error.message : 'unknown';
          console.error(`[Trellis] Failed to extract curated pick ${candidate.url}: ${message}`);
        }
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.warn(`[Trellis] Curation flow failed: ${message}`);
  }

  return [...perTheme, ...curated];
}
