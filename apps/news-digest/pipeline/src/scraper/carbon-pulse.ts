import { chromium } from 'playwright';
import type { Page } from 'playwright';
import type { ProxyConfig, RawArticle, ThemeConfig } from '../types.js';

const BASE_URL = 'https://carbon-pulse.com';
const SEARCH_URL = `${BASE_URL}/?sfid=1438&_sf_s=`;
const LOGIN_URL = `${BASE_URL}/login/`;
const MAX_ARTICLES_PER_THEME = 3;
const MAX_ARTICLE_AGE_DAYS = 30;
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

async function fillAndSubmitWpLogin(page: Page, username: string, password: string): Promise<void> {
  await waitForCloudflare(page);
  await page.fill('#user_login', username);
  await page.fill('#user_pass', password);
  console.log('[Carbon Pulse] WP credentials filled, clicking submit...');
  await page.click('#wp-submit');
  await page.waitForLoadState('domcontentloaded');
}

async function fillAndSubmitCustomLogin(page: Page, username: string, password: string): Promise<void> {
  await waitForCloudflare(page);
  // Custom /login/ page uses standard input names inside a themed form
  const usernameInput = page.locator('input[name="log"], input[name="username"], #user_login');
  const passwordInput = page.locator('input[name="pwd"], input[name="password"], #user_pass');
  const submitButton = page.locator('input[type="submit"], button[type="submit"], #wp-submit');

  await usernameInput.first().fill(username);
  await passwordInput.first().fill(password);
  console.log('[Carbon Pulse] Custom login credentials filled, submitting...');
  await submitButton.first().click();
  await page.waitForLoadState('domcontentloaded');
}

async function login(page: Page, username: string, password: string): Promise<boolean> {
  console.log('[Carbon Pulse] Navigating to login page...');
  await page.goto(LOGIN_URL);
  console.log(`[Carbon Pulse] Login page loaded. Title: "${await page.title()}", URL: ${page.url()}`);

  try {
    // Step 1: Fill the custom /login/ page (or wp-login if no redirect happened)
    if (page.url().includes('wp-login.php')) {
      await fillAndSubmitWpLogin(page, username, password);
    } else {
      await fillAndSubmitCustomLogin(page, username, password);
    }
    console.log(`[Carbon Pulse] After submit — Title: "${await page.title()}", URL: ${page.url()}`);

    // Step 2: Carbon Pulse may redirect to wp-login.php for a second auth step
    if (page.url().includes('wp-login.php')) {
      console.log('[Carbon Pulse] Redirected to wp-login.php, re-submitting credentials...');
      await fillAndSubmitWpLogin(page, username, password);
      console.log(`[Carbon Pulse] After wp-login submit — Title: "${await page.title()}", URL: ${page.url()}`);
    }

    await waitForCloudflare(page);
    await page.waitForSelector('a[href*="logout"]', { timeout: LOGIN_TIMEOUT });
    return true;
  } catch (error: unknown) {
    const title = await page.title().catch(() => 'unknown');
    const url = page.url();
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500)).catch(() => 'unavailable');
    console.error(`[Carbon Pulse] Login failed — Title: "${title}", URL: ${url}`);
    console.error(`[Carbon Pulse] Page content: ${bodyText}`);
    const msg = error instanceof Error ? error.message : 'unknown';
    throw new Error(`Carbon Pulse login failed: ${msg}`);
  }
}

export function parseHumanDate(raw: string): string {
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return '';
}

async function extractArticleContent(page: Page): Promise<{
  content: string;
  author: string;
  date: string;
  categories: string;
}> {
  const raw = await page.evaluate(() => {
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

  return { ...raw, date: parseHumanDate(raw.date) };
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
      const ageMs = Date.now() - new Date(extracted.date).getTime();
      if (ageMs > MAX_ARTICLE_AGE_DAYS * 24 * 60 * 60 * 1000) {
        console.warn(`[Carbon Pulse] Article too old (${extracted.date}), skipping: ${link.url}`);
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
  proxy: ProxyConfig,
): Promise<RawArticle[]> {
  const browser = await chromium.launch({
    headless: false,
    proxy: {
      server: proxy.server,
      username: proxy.username,
      password: proxy.password,
    },
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
