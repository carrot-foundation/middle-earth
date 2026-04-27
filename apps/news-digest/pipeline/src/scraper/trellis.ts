import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { THEMES } from '../config.constants.js';
import { curateTrellisArticles, type TrellisCandidate } from '../ai/trellis-curator.js';
import type { RawArticle, ThemeConfig } from '../types.js';

const SEARCH_URL = 'https://trellis.net/?s=';
const LISTING_URL = 'https://trellis.net/articles/';
const HOMEPAGE_URL = 'https://trellis.net/';
const MAX_ARTICLES_PER_THEME = 1;
const MAX_ARTICLE_AGE_DAYS = 30;
const CANDIDATE_POOL_SIZE = 15;
const MAX_EXCERPT_LENGTH = 400;

export const TRELLIS_CONTENT_SELECTORS = [
  '.post-content',
  'article',
  'main',
] as const;

interface SearchLink {
  readonly url: string;
  readonly title: string;
}

interface ArticleExtract {
  readonly content: string;
  readonly date: string;
  readonly author: string;
}

interface ListingItem {
  readonly url: string;
  readonly title: string;
  readonly date: string;   // may be empty if not in listing DOM
  readonly excerpt: string; // may be empty if not in listing DOM
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isTooOld(dateIso: string): boolean {
  const ts = new Date(dateIso).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts > MAX_ARTICLE_AGE_DAYS * 24 * 60 * 60 * 1000;
}

async function extractSearchLinks(page: Page): Promise<SearchLink[]> {
  return page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/article/"]'));
    const seen = new Set<string>();
    const out: SearchLink[] = [];
    for (const a of anchors) {
      const href = a.href;
      if (!href || seen.has(href)) continue;
      const title = (a.textContent ?? '').trim();
      if (!title) continue;
      seen.add(href);
      out.push({ url: href, title });
    }
    return out;
  });
}

async function extractArticle(page: Page): Promise<ArticleExtract> {
  return page.evaluate((selectors: readonly string[]) => {
    // Trellis wraps the article header, byline, image caption, author bio,
    // newsletter signup, "Featured Reports", "Coming up" and "Recommended"
    // widgets all inside <article class="post-type-post">. Scoping to
    // .post-content (the body div) is what keeps sidebar paragraphs out.
    let container: Element | null = null;
    for (const selector of selectors) {
      container = document.querySelector(selector);
      if (container) break;
    }
    container = container ?? document.body;

    // Collapse internal whitespace runs so any sidebar <p> that slips through
    // a future selector change cannot reintroduce tab/space blocks.
    const paragraphs = Array.from(container.querySelectorAll('p'))
      .map((paragraph) => (paragraph.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter((text) => text.length > 0);
    const fallback = (container.textContent ?? '').replace(/\s+/g, ' ').trim();
    const content = paragraphs.length > 0 ? paragraphs.join('\n\n') : fallback;

    const publishedMeta = document
      .querySelector('meta[property="article:published_time"]')
      ?.getAttribute('content') ?? '';
    const timeAttr = document.querySelector('time')?.getAttribute('datetime') ?? '';
    const date = (publishedMeta || timeAttr).slice(0, 10);

    const authorMeta = document.querySelector('meta[name="author"]')?.getAttribute('content') ?? '';
    const bylineEl = document.querySelector('.author, .byline, [rel="author"]');
    const author = authorMeta || (bylineEl?.textContent ?? '').trim();

    return { content, date, author };
  }, [...TRELLIS_CONTENT_SELECTORS]);
}

async function extractListing(page: Page): Promise<ListingItem[]> {
  return page.evaluate((maxExcerpt: number) => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/article/"]'));
    const seen = new Set<string>();
    const out: ListingItem[] = [];
    for (const a of anchors) {
      const href = a.href;
      if (!href || seen.has(href)) continue;
      const title = (a.textContent ?? '').trim();
      if (!title) continue;
      // Probe for adjacent date/excerpt in the listing DOM.
      const card = a.closest('article, li, .post, .card') ?? a.parentElement;
      const timeAttr = card?.querySelector('time')?.getAttribute('datetime') ?? '';
      const dekEl = card?.querySelector('.dek, .excerpt, .summary, p');
      const excerpt = ((dekEl?.textContent ?? '').trim()).slice(0, maxExcerpt);
      seen.add(href);
      out.push({ url: href, title, date: timeAttr.slice(0, 10), excerpt });
    }
    return out;
  }, MAX_EXCERPT_LENGTH);
}

async function scrapeThemeSearch(
  page: Page,
  theme: ThemeConfig,
  processedUrls: ReadonlySet<string>,
): Promise<RawArticle[]> {
  const searchUrl = `${SEARCH_URL}${encodeURIComponent(theme.trellisSearchTerms)}`;
  try {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error(`[Trellis] Theme search failed for "${theme.name}": ${message}`);
    return [];
  }

  const links = await extractSearchLinks(page);
  const fresh = links.filter((l) => !processedUrls.has(l.url)).slice(0, MAX_ARTICLES_PER_THEME);

  const articles: RawArticle[] = [];
  for (const link of fresh) {
    try {
      await page.goto(link.url, { waitUntil: 'domcontentloaded' });
      const extracted = await extractArticle(page);
      const date = extracted.date || todayIso();
      if (isTooOld(date)) {
        console.warn(`[Trellis] Article too old (${date}), skipping: ${link.url}`);
        continue;
      }
      articles.push({
        source: 'trellis',
        url: link.url,
        title: link.title,
        date,
        author: extracted.author || 'Trellis',
        mainTheme: theme.name,
        categories: '',
        location: '',
        fullContent: extracted.content,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown';
      console.error(`[Trellis] Failed to extract "${link.title}": ${message}`);
    }
  }
  return articles;
}

async function fetchCandidateMetadata(
  page: Page,
  item: ListingItem,
): Promise<TrellisCandidate | null> {
  // Happy path: listing DOM supplied both date and excerpt.
  if (item.date && item.excerpt) {
    if (isTooOld(item.date)) return null;
    return { url: item.url, title: item.title, date: item.date, excerpt: item.excerpt };
  }

  // Fallback: navigate to the article to read meta tags.
  try {
    await page.goto(item.url, { waitUntil: 'domcontentloaded' });
    const extracted = await page.evaluate((maxExcerpt: number) => {
      const publishedMeta = document
        .querySelector('meta[property="article:published_time"]')
        ?.getAttribute('content') ?? '';
      const timeAttr = document.querySelector('time')?.getAttribute('datetime') ?? '';
      const date = (publishedMeta || timeAttr).slice(0, 10);
      const descMeta = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
      const firstP = document.querySelector('article p')?.textContent ?? '';
      const excerpt = (descMeta || firstP).trim().slice(0, maxExcerpt);
      return { date, excerpt };
    }, MAX_EXCERPT_LENGTH);
    const date = extracted.date || todayIso();
    if (isTooOld(date)) return null;
    return {
      url: item.url,
      title: item.title,
      date,
      excerpt: extracted.excerpt,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.warn(`[Trellis] Candidate metadata fetch failed for ${item.url}: ${message}`);
    return null;
  }
}

async function collectHomepageCandidates(
  page: Page,
  excludeUrls: ReadonlySet<string>,
): Promise<TrellisCandidate[]> {
  // Prefer /articles/ listing; fall back to homepage.
  let listingLoaded = false;
  try {
    await page.goto(LISTING_URL, { waitUntil: 'domcontentloaded' });
    listingLoaded = true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.warn(`[Trellis] /articles/ listing unavailable (${message}), falling back to homepage`);
  }

  if (!listingLoaded) {
    await page.goto(HOMEPAGE_URL, { waitUntil: 'domcontentloaded' });
  }

  const items = await extractListing(page);
  const candidates: TrellisCandidate[] = [];
  for (const item of items) {
    if (excludeUrls.has(item.url)) continue;
    const candidate = await fetchCandidateMetadata(page, item);
    if (candidate) candidates.push(candidate);
    if (candidates.length >= CANDIDATE_POOL_SIZE) break;
  }
  return candidates;
}

async function scrapeCuratedPick(
  page: Page,
  candidate: TrellisCandidate,
  mainTheme: string,
): Promise<RawArticle | null> {
  try {
    await page.goto(candidate.url, { waitUntil: 'domcontentloaded' });
    const extracted = await extractArticle(page);
    const date = extracted.date || candidate.date || todayIso();
    if (isTooOld(date)) {
      console.warn(`[Trellis] Curated pick too old (${date}), skipping: ${candidate.url}`);
      return null;
    }
    return {
      source: 'trellis',
      url: candidate.url,
      title: candidate.title,
      date,
      author: extracted.author || 'Trellis',
      mainTheme,
      categories: '',
      location: '',
      fullContent: extracted.content,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error(`[Trellis] Failed to extract curated pick ${candidate.url}: ${message}`);
    return null;
  }
}

export async function scrapeTrellis(
  themes: readonly ThemeConfig[],
  processedUrls: ReadonlySet<string>,
  anthropicApiKey: string,
): Promise<RawArticle[]> {
  const browser: Browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    const perTheme: RawArticle[] = [];
    for (const theme of themes) {
      console.log(`[Trellis] Searching: ${theme.name}`);
      const themeArticles = await scrapeThemeSearch(page, theme, processedUrls);
      perTheme.push(...themeArticles);
      console.log(`[Trellis] Found ${themeArticles.length} article(s) for ${theme.name}`);
    }

    const exclude = new Set<string>([...processedUrls, ...perTheme.map((a) => a.url)]);
    let curated: RawArticle[] = [];
    try {
      const candidates = await collectHomepageCandidates(page, exclude);
      if (candidates.length > 0) {
        const candidateByUrl = new Map(candidates.map((c) => [c.url, c]));
        const allThemeNames = THEMES.map((t) => t.name);
        const picks = await curateTrellisArticles(candidates, allThemeNames, anthropicApiKey);
        for (const pick of picks) {
          const candidate = candidateByUrl.get(pick.url);
          if (!candidate) continue;
          const article = await scrapeCuratedPick(page, candidate, pick.mainTheme);
          if (article) curated.push(article);
        }
      } else {
        console.warn('[Trellis] No homepage candidates collected; skipping curation.');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown';
      console.warn(`[Trellis] Curation flow failed: ${message}`);
      curated = [];
    }

    return [...perTheme, ...curated];
  } finally {
    await browser.close();
  }
}
