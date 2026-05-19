import { sanitizeArticleText } from '../helpers/content.helpers.js';
import { parseDate } from '../helpers/date.helpers.js';
import { FirecrawlError, firecrawlScrape, firecrawlSearch } from '../helpers/firecrawl.helpers.js';
import type { RawArticle, ThemeConfig } from '../types.js';

const MAX_ARTICLES_PER_THEME = 2;
const MAX_ARTICLE_AGE_DAYS = 30;
const SEARCH_LIMIT = 10;

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

async function searchAndExtract(
  theme: ThemeConfig,
  processedUrls: ReadonlySet<string>,
  cpTitles: readonly string[],
  apiKey: string,
): Promise<RawArticle[]> {
  const results = await firecrawlSearch(
    `site:esgnews.com ${theme.esgNewsSearchTerms}`,
    apiKey,
    SEARCH_LIMIT,
  );

  const seen = new Set<string>();
  const candidates = results.filter((result) => {
    let hostname = '';
    try {
      hostname = new URL(result.url).hostname.toLowerCase();
    } catch {
      return false;
    }
    if (hostname !== 'esgnews.com' && !hostname.endsWith('.esgnews.com')) return false;
    if (processedUrls.has(result.url) || seen.has(result.url)) return false;
    if (isDuplicateOfCarbonPulse(result.title, cpTitles)) return false;
    seen.add(result.url);
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
      const articleDate = parseDate(scraped.publishedTime);
      if (!articleDate) {
        console.warn(`[ESG News] Missing/invalid publish date, skipping: ${candidate.url}`);
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
      if (error instanceof FirecrawlError && (error.status === 402 || error.status === 429)) {
        console.error(
          `[ESG News] Firecrawl ${error.status} (quota/rate limit) — aborting theme, keeping ${articles.length} collected`,
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
  for (const theme of themes) {
    console.log(`[ESG News] Searching: ${theme.name}`);
    try {
      const articles = await searchAndExtract(theme, processedUrls, cpTitles, firecrawlApiKey);
      allArticles.push(...articles);
      console.log(`[ESG News] Found ${articles.length} articles for ${theme.name}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown';
      console.error(`[ESG News] Search failed for "${theme.name}": ${message}`);
    }
  }
  return allArticles;
}
