import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import type { RawArticle, ThemeConfig } from '../types.js';

const SEARCH_URL = 'https://esgnews.com/?s=';
const MAX_ARTICLES_PER_THEME = 2;

async function extractArticleContent(page: Page): Promise<{
  content: string;
  author: string;
  date: string;
}> {
  return page.evaluate(() => {
    const article = document.querySelector('article') ?? document.body;
    const content = article.textContent?.trim() ?? '';
    const timeEl = document.querySelector('time');
    const date = timeEl?.getAttribute('datetime')?.slice(0, 10) ?? '';
    const authorEl = document.querySelector('.author, .byline, [rel="author"]');
    const author = authorEl?.textContent?.trim() ?? 'ESG News';
    return { content, author, date };
  });
}

async function searchAndExtract(
  page: Page,
  theme: ThemeConfig,
  processedUrls: ReadonlySet<string>,
  cpTitles: readonly string[],
): Promise<RawArticle[]> {
  const searchUrl = `${SEARCH_URL}${encodeURIComponent(theme.esgNewsSearchTerms)}`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  const links = await page.evaluate(() => {
    const results = document.querySelectorAll('article a, h2 a, h3 a');
    const seen = new Set<string>();
    return Array.from(results)
      .filter((a) => {
        const href = (a as HTMLAnchorElement).href;
        if (seen.has(href) || !href.includes('esgnews.com')) return false;
        seen.add(href);
        return true;
      })
      .map((a) => ({
        url: (a as HTMLAnchorElement).href,
        title: a.textContent?.trim() ?? '',
      }));
  });
  const articles: RawArticle[] = [];
  const candidates = links.filter((l) => !processedUrls.has(l.url));
  for (const link of candidates.slice(0, MAX_ARTICLES_PER_THEME)) {
    const lowerTitle = link.title.toLowerCase();
    const isDupOfCp = cpTitles.some((cpTitle) => {
      const cpWords = new Set(cpTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
      const esgWords = lowerTitle.split(/\s+/).filter((w) => w.length > 3);
      const overlap = esgWords.filter((w) => cpWords.has(w)).length;
      return cpWords.size > 0 && overlap / cpWords.size >= 0.5;
    });
    if (isDupOfCp) continue;
    try {
      await page.goto(link.url, { waitUntil: 'domcontentloaded' });
      const extracted = await extractArticleContent(page);
      articles.push({
        source: 'esgnews',
        url: link.url,
        title: link.title,
        date: extracted.date || new Date().toISOString().slice(0, 10),
        author: extracted.author,
        mainTheme: theme.name,
        categories: '',
        location: '',
        fullContent: extracted.content,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown';
      console.error(`Failed to extract ESG News article "${link.title}": ${message}`);
    }
  }
  return articles;
}

export async function scrapeEsgNews(
  themes: readonly ThemeConfig[],
  processedUrls: ReadonlySet<string>,
  cpTitles: readonly string[],
): Promise<RawArticle[]> {
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const allArticles: RawArticle[] = [];
    for (const theme of themes) {
      console.log(`[ESG News] Searching: ${theme.name}`);
      const articles = await searchAndExtract(page, theme, processedUrls, cpTitles);
      allArticles.push(...articles);
      console.log(`[ESG News] Found ${articles.length} articles for ${theme.name}`);
    }
    return allArticles;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error(`ESG News scraping failed: ${message}`);
    return [];
  } finally {
    await browser?.close();
  }
}
