import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import type { RawArticle, ThemeConfig } from '../types.js';

const BASE_URL = 'https://carbon-pulse.com';
const SEARCH_URL = `${BASE_URL}/?sfid=1438&_sf_s=`;
const LOGIN_URL = `${BASE_URL}/wp-login.php`;
const MAX_ARTICLES_PER_THEME = 3;
const LOGIN_TIMEOUT = 30_000;

async function login(page: Page, username: string, password: string): Promise<boolean> {
  await page.goto(LOGIN_URL);
  await page.fill('#user_login', username);
  await page.fill('#user_pass', password);
  await page.click('#wp-submit');
  try {
    await page.waitForSelector('a:has-text("Log out")', { timeout: LOGIN_TIMEOUT });
    return true;
  } catch {
    console.error('Carbon Pulse login failed — timed out waiting for "Log out" link');
    return false;
  }
}

async function extractArticleContent(page: Page): Promise<{
  content: string;
  author: string;
  date: string;
  categories: string;
}> {
  return page.evaluate(() => {
    const entry = document.querySelector('div.entry');
    const content = entry?.textContent?.trim() ?? '';
    const meta = document.querySelectorAll('.post p');
    let author = '';
    let date = '';
    let categories = '';
    for (const p of Array.from(meta)) {
      const text = p.textContent ?? '';
      if (text.includes('By ')) author = text.replace('By ', '').trim();
      if (text.match(/\d{1,2}\s\w+\s\d{4}/)) date = text.trim();
      if (text.includes('Categories:')) categories = text.replace('Categories:', '').trim();
    }
    return { content, author, date, categories };
  });
}

async function searchAndExtract(
  page: Page,
  theme: ThemeConfig,
  processedUrls: ReadonlySet<string>,
): Promise<RawArticle[]> {
  const searchUrl = `${SEARCH_URL}${encodeURIComponent(theme.carbonPulseSearchTerms)}`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  const links = await page.evaluate(() => {
    const results = document.querySelectorAll('h2.entry-title a');
    return Array.from(results).map((a) => ({
      url: (a as HTMLAnchorElement).href,
      title: a.textContent?.trim() ?? '',
    }));
  });
  const articles: RawArticle[] = [];
  const candidates = links.filter((l) => !processedUrls.has(l.url));
  for (const link of candidates.slice(0, MAX_ARTICLES_PER_THEME)) {
    try {
      await page.goto(link.url, { waitUntil: 'domcontentloaded' });
      const extracted = await extractArticleContent(page);
      articles.push({
        source: 'carbon-pulse',
        url: link.url,
        title: link.title,
        date: extracted.date || new Date().toISOString().slice(0, 10),
        author: extracted.author || 'Carbon Pulse',
        mainTheme: theme.name,
        categories: extracted.categories,
        location: '',
        fullContent: extracted.content,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown';
      console.error(`Failed to extract article "${link.title}": ${message}`);
    }
  }
  return articles;
}

export async function scrapeCarbonPulse(
  themes: readonly ThemeConfig[],
  processedUrls: ReadonlySet<string>,
  credentials: { readonly username: string; readonly password: string },
): Promise<RawArticle[]> {
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const loggedIn = await login(page, credentials.username, credentials.password);
    if (!loggedIn) return [];
    const allArticles: RawArticle[] = [];
    for (const theme of themes) {
      console.log(`[Carbon Pulse] Searching: ${theme.name}`);
      const articles = await searchAndExtract(page, theme, processedUrls);
      allArticles.push(...articles);
      console.log(`[Carbon Pulse] Found ${articles.length} articles for ${theme.name}`);
    }
    return allArticles;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error(`Carbon Pulse scraping failed: ${message}`);
    return [];
  } finally {
    await browser?.close();
  }
}
