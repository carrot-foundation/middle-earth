import { THEMES } from '../config.constants.js';
import { curateTrellisArticles, type TrellisCandidate } from '../ai/trellis-curator.js';
import { sanitizeArticleText } from '../helpers/content.helpers.js';
import { parseDate } from '../helpers/date.helpers.js';
import { FirecrawlError, firecrawlScrape, firecrawlSearch } from '../helpers/firecrawl.helpers.js';
import type { RawArticle, ThemeConfig } from '../types.js';

const MAX_ARTICLES_PER_THEME = 1;
const MAX_ARTICLE_AGE_DAYS = 30;
const CANDIDATE_POOL_SIZE = 15;
const SEARCH_LIMIT = 10;
const MAX_EXCERPT_LENGTH = 400;
// The curator (not a per-theme query) decides which of these are worth the
// digest; keep the discovery query broad and recency-biased, scoped to Trellis.
const CURATION_QUERY = 'site:trellis.net climate sustainability decarbonization circular economy';

// Trellis articles live at trellis.net/article/...; the old Playwright code only
// ever followed `a[href*="/article/"]`. Require both an in-domain host and the
// article path so a search provider can't steer us to an arbitrary URL.
function isTrellisArticleUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== 'trellis.net' && !host.endsWith('.trellis.net')) return false;
  return parsed.pathname.includes('/article/');
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
  const articleDate = parseDate(scraped.publishedTime);
  if (!articleDate) {
    console.warn(`[Trellis] Missing/invalid publish date, skipping: ${url}`);
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

interface ThemeSearchResult {
  readonly articles: RawArticle[];
  readonly quotaExhausted: boolean;
}

async function searchTheme(
  theme: ThemeConfig,
  processedUrls: ReadonlySet<string>,
  apiKey: string,
): Promise<ThemeSearchResult> {
  const results = await firecrawlSearch(
    `site:trellis.net ${theme.trellisSearchTerms}`,
    apiKey,
    SEARCH_LIMIT,
  );

  const seen = new Set<string>();
  const candidates = results.filter((result) => {
    if (!isTrellisArticleUrl(result.url)) return false;
    if (processedUrls.has(result.url) || seen.has(result.url)) return false;
    seen.add(result.url);
    return true;
  });

  // Cap on *successful* extractions, not raw candidates.
  const articles: RawArticle[] = [];
  for (const candidate of candidates) {
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
  // Over-request: host/exclude/dedup filtering below would otherwise shrink the
  // pool below CANDIDATE_POOL_SIZE with no top-up.
  const results = await firecrawlSearch(CURATION_QUERY, apiKey, CANDIDATE_POOL_SIZE * 2);
  const seen = new Set<string>();
  const candidates: TrellisCandidate[] = [];
  for (const result of results) {
    if (!isTrellisArticleUrl(result.url)) continue;
    if (excludeUrls.has(result.url) || seen.has(result.url)) continue;
    seen.add(result.url);
    // date is enforced later at the pick scrape; the curator ranks on
    // title+excerpt and only prefers recency "when relevance is similar".
    candidates.push({
      url: result.url,
      title: result.title,
      date: '',
      excerpt: (result.description || result.title).slice(0, MAX_EXCERPT_LENGTH),
    });
    if (candidates.length >= CANDIDATE_POOL_SIZE) break;
  }
  return candidates;
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
  let quotaExhausted = false;
  for (const theme of themes) {
    console.log(`[Trellis] Searching: ${theme.name}`);
    try {
      const result = await searchTheme(theme, processedUrls, firecrawlApiKey);
      perTheme.push(...result.articles);
      console.log(`[Trellis] Found ${result.articles.length} article(s) for ${theme.name}`);
      if (result.quotaExhausted) {
        quotaExhausted = true;
        break;
      }
    } catch (error: unknown) {
      // A 402/429 from firecrawlSearch itself (not the scrape) propagates here;
      // treat it as quota exhaustion too, so remaining themes + curation are
      // skipped rather than hammering the exhausted API.
      if (isQuotaError(error)) {
        console.error('[Trellis] Firecrawl quota/rate limit during theme search — aborting remaining themes.');
        quotaExhausted = true;
        break;
      }
      const message = error instanceof Error ? error.message : 'unknown';
      console.error(`[Trellis] Search failed for "${theme.name}": ${message}`);
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
