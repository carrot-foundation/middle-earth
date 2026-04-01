import { chromium } from 'playwright';
import type { Page } from 'playwright';
import type { RawArticle, ThemeConfig } from '../types.js';

const BASE_URL = 'https://carbon-pulse.com';
const SEARCH_URL = `${BASE_URL}/?sfid=1438&_sf_s=`;
const LOGIN_URL = `${BASE_URL}/login/`;
const MAX_ARTICLES_PER_THEME = 3;
const LOGIN_TIMEOUT = 45_000;
const CF_TIMEOUT = 30_000;
const REALISTIC_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function waitForCloudflare(page: Page): Promise<void> {
  const title = await page.title();
  if (title.includes('moment')) {
    await page.waitForFunction(() => !document.title.includes('moment'), {
      timeout: CF_TIMEOUT,
    });
  }
}

async function login(page: Page, username: string, password: string): Promise<boolean> {
  await page.goto(LOGIN_URL);
  await waitForCloudflare(page);
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'Login' }).click();
  try {
    await waitForCloudflare(page);
    await page.waitForSelector('a[href*="logout"]', { timeout: LOGIN_TIMEOUT });
    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    throw new Error(`Carbon Pulse login failed: ${msg}`);
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

    const author =
      document.querySelector('a.author.url.fn')?.textContent?.trim() ?? '';
    const date =
      document.querySelector('span.published-date')?.textContent?.trim() ?? '';
    const categories = Array.from(
      document.querySelectorAll('a.taxonomy.category'),
    )
      .map((a) => a.textContent?.trim())
      .filter(Boolean)
      .join(', ');

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
  await waitForCloudflare(page);
  const links = await page.evaluate(() => {
    const results = document.querySelectorAll('h2.posttitle a');
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
      await waitForCloudflare(page);
      const extracted = await extractArticleContent(page);
      if (!extracted.date) {
        console.warn(`[Carbon Pulse] Missing publish date, skipping: ${link.url}`);
        continue;
      }
      articles.push({
        source: 'carbon-pulse',
        url: link.url,
        title: link.title,
        date: extracted.date,
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
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  try {
    const context = await browser.newContext({
      userAgent: REALISTIC_USER_AGENT,
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    const page = await context.newPage();
    await login(page, credentials.username, credentials.password);
    const allArticles: RawArticle[] = [];
    for (const theme of themes) {
      console.log(`[Carbon Pulse] Searching: ${theme.name}`);
      const articles = await searchAndExtract(page, theme, processedUrls);
      allArticles.push(...articles);
      console.log(`[Carbon Pulse] Found ${articles.length} articles for ${theme.name}`);
    }
    return allArticles;
  } finally {
    await browser.close();
  }
}
