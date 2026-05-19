import { sanitizeArticleText } from '../helpers/content.helpers.js';
import { parseDate } from '../helpers/date.helpers.js';
import {
  FirecrawlError,
  extractMarkdownLinks,
  firecrawlScrape,
} from '../helpers/firecrawl.helpers.js';
import type { RawArticle, ThemeConfig } from '../types.js';

const MAX_ARTICLES_PER_THEME = 2;
const MAX_ARTICLE_AGE_DAYS = 30;
const LISTING_URL_BASE = 'https://esgnews.com/?s=';

// ESG News article permalinks are slug-only at the root (`/some-slug/`).
// These first-path-segments mark tag/category/author/pagination/region/
// static-page routes that the search page also links to — exclude them so
// we don't waste credits scraping a non-article page (the old `/search`
// flow burnt 16 scrapes on these in the 2026-05-19 validation run).
//
// Matching on the FIRST segment (not a prefix string) handles trailing-slash
// variants uniformly: `/about`, `/about/`, and `/about/us/` all canonicalize
// to first-segment `'about'`. The earlier prefix-list approach required
// every entry to end with `/`, and a single missing slash silently let the
// no-trailing-slash form through (cursor-bot finding on PR #36).
const ESG_INDEX_FIRST_SEGMENTS: ReadonlySet<string> = new Set([
  'tag',
  'category',
  'author',
  'page',
  'esg-europe',
  'esg-americas',
  'esg-africa',
  'esg-asia-pacific',
  'feed',
  'wp-admin',
  'wp-content',
  'wp-json',
  'about',
  'contact',
  'subscribe',
  'authors',
]);

function isEsgNewsArticleUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== 'esgnews.com' && !host.endsWith('.esgnews.com')) return false;
  const segments = parsed.pathname.toLowerCase().split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0) return false;
  if (ESG_INDEX_FIRST_SEGMENTS.has(segments[0]!)) return false;
  // Article permalinks are exactly one segment under root (`/slug/`).
  // Multi-segment paths (`/topic/methane/`, future index types) are
  // rejected so we don't need to keep extending the exclusion set
  // ahead of every CMS change.
  return segments.length === 1;
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof FirecrawlError && (error.status === 402 || error.status === 429)
  );
}

function isDuplicateOfCarbonPulse(title: string, cpTitles: readonly string[]): boolean {
  const lowerTitle = title.toLowerCase();
  return cpTitles.some((cpTitle) => {
    const cpWords = new Set(
      cpTitle.toLowerCase().split(/\s+/).filter((word) => word.length > 3),
    );
    const esgWords = lowerTitle.split(/\s+/).filter((word) => word.length > 3);
    const overlap = esgWords.filter((word) => cpWords.has(word)).length;
    return cpWords.size > 0 && overlap / cpWords.size >= 0.5;
  });
}

async function discoverAndScrape(
  theme: ThemeConfig,
  processedUrls: ReadonlySet<string>,
  cpTitles: readonly string[],
  apiKey: string,
): Promise<RawArticle[]> {
  // Hit ESG News's own WordPress search (default order: publish-date-desc)
  // and read links straight from the markdown. This is what gives us
  // recency — Firecrawl's `/v2/search` upstream index lacks dates on this
  // publisher and binary-filtered every result when `tbs` was applied
  // (PR #34 → reverted in #35; see firecrawl.helpers note).
  const listingUrl = `${LISTING_URL_BASE}${encodeURIComponent(theme.esgNewsSearchTerms)}`;
  const listing = await firecrawlScrape(listingUrl, apiKey);

  const candidates = extractMarkdownLinks(listing.markdown, ({ url, title }) => {
    if (!isEsgNewsArticleUrl(url)) return false;
    if (processedUrls.has(url)) return false;
    if (isDuplicateOfCarbonPulse(title, cpTitles)) return false;
    return true;
  });

  // Cap on *successful* extractions, not raw candidates: early candidates can
  // be stale/empty/dup, so slicing up front would yield fewer than possible.
  const articles: RawArticle[] = [];
  for (const candidate of candidates) {
    if (articles.length >= MAX_ARTICLES_PER_THEME) break;
    try {
      const scraped = await firecrawlScrape(candidate.url, apiKey);
      // No reliable publish date — skip rather than stamp it "today" and let a
      // stale article bypass the freshness window (parity with carbon-pulse.ts).
      // Split the two failure modes so a Firecrawl metadata-schema regression
      // (parseable string suddenly returning unparseable) is visibly distinct
      // from publisher pages that genuinely lack a date.
      if (!scraped.publishedTime) {
        console.warn(`[ESG News] No publish_time metadata, skipping: ${candidate.url}`);
        continue;
      }
      const articleDate = parseDate(scraped.publishedTime);
      if (!articleDate) {
        console.error(
          `[ESG News] Unparseable publish_time "${scraped.publishedTime}", skipping: ${candidate.url}`,
        );
        continue;
      }
      const ageMs = Date.now() - new Date(articleDate).getTime();
      if (ageMs > MAX_ARTICLE_AGE_DAYS * 24 * 60 * 60 * 1000) {
        console.warn(`[ESG News] Article too old (${articleDate}), skipping: ${candidate.url}`);
        continue;
      }
      // Firecrawl markdown still carries breadcrumbs, share buttons, newsletter
      // signup and the editorial-team bio (spike Robustness #7). Strip it at the
      // source — the same defense-in-depth barrier used for every scraper.
      const cleanContent = sanitizeArticleText(scraped.markdown);
      if (!cleanContent) {
        console.warn(`[ESG News] No article body after sanitization, skipping: ${candidate.url}`);
        continue;
      }
      articles.push({
        source: 'esgnews',
        url: candidate.url,
        title: candidate.title,
        date: articleDate,
        author: scraped.author || 'ESG News',
        mainTheme: theme.name,
        categories: '',
        location: '',
        fullContent: cleanContent,
      });
    } catch (error: unknown) {
      // Quota (402) / rate-limit (429): every remaining candidate would hit the
      // same wall. Stop scraping this theme but KEEP what was already collected
      // — throwing here would discard the partial `articles` for this theme.
      if (isQuotaError(error)) {
        const status = (error as FirecrawlError).status;
        console.error(
          `[ESG News] Firecrawl ${status} (quota/rate limit) — aborting theme, keeping ${articles.length} collected`,
        );
        break;
      }
      const message = error instanceof Error ? error.message : 'unknown';
      console.error(`Failed to extract ESG News article "${candidate.title}": ${message}`);
    }
  }
  return articles;
}

export async function scrapeEsgNews(
  themes: readonly ThemeConfig[],
  processedUrls: ReadonlySet<string>,
  cpTitles: readonly string[],
  firecrawlApiKey: string,
): Promise<RawArticle[]> {
  if (!firecrawlApiKey) {
    throw new Error('FIRECRAWL_API_KEY not configured — ESG News scraping skipped');
  }

  const allArticles: RawArticle[] = [];
  // Carry URLs scraped under earlier themes forward, so an article matching
  // multiple themes isn't re-discovered, re-scraped (wasting a credit) and
  // returned twice.
  const seenUrls = new Set(processedUrls);
  for (const theme of themes) {
    console.log(`[ESG News] Discovering: ${theme.name}`);
    try {
      const articles = await discoverAndScrape(theme, seenUrls, cpTitles, firecrawlApiKey);
      allArticles.push(...articles);
      for (const article of articles) seenUrls.add(article.url);
      console.log(`[ESG News] Found ${articles.length} articles for ${theme.name}`);
    } catch (error: unknown) {
      // A 402/429 from the listing scrape itself (not the per-article scrape)
      // propagates here; treat as quota exhaustion so the remaining themes
      // don't hammer the exhausted API. Parity with `scrapeTrellis`.
      if (isQuotaError(error)) {
        const status = (error as FirecrawlError).status;
        console.error(`[ESG News] Firecrawl ${status} during theme discovery — aborting remaining themes.`);
        break;
      }
      const message = error instanceof Error ? error.message : 'unknown';
      console.error(`[ESG News] Discovery failed for "${theme.name}": ${message}`);
    }
  }
  return allArticles;
}
