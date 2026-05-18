import { sanitizeArticleText } from '../helpers/content.helpers.js';
import { FirecrawlError, firecrawlScrape, firecrawlSearch } from '../helpers/firecrawl.helpers.js';
import type { RawArticle, ThemeConfig } from '../types.js';

const MAX_ARTICLES_PER_THEME = 2;
const MAX_ARTICLE_AGE_DAYS = 30;
const SEARCH_LIMIT = 10;

function parseDate(raw: string): string {
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
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
    if (!result.url.includes('esgnews.com')) return false;
    if (processedUrls.has(result.url) || seen.has(result.url)) return false;
    if (isDuplicateOfCarbonPulse(result.title, cpTitles)) return false;
    seen.add(result.url);
    return true;
  });

  const articles: RawArticle[] = [];
  for (const candidate of candidates.slice(0, MAX_ARTICLES_PER_THEME)) {
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
      // Quota (402) / rate-limit (429) are fatal to the whole theme — every
      // remaining candidate would hit the same wall. Propagate so the
      // per-theme handler logs it instead of silently burning the loop.
      if (error instanceof FirecrawlError && (error.status === 402 || error.status === 429)) {
        throw error;
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
