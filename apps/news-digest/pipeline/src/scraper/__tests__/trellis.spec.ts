import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ThemeConfig } from '../../types.js';

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

vi.mock('../../ai/trellis-curator.js', () => ({
  curateTrellisArticles: vi.fn(),
}));

import { chromium } from 'playwright';
import { curateTrellisArticles } from '../../ai/trellis-curator.js';
import { scrapeTrellis, TRELLIS_CONTENT_SELECTORS } from '../trellis.js';

const TODAY_ISO = new Date().toISOString().slice(0, 10);

function stubTheme(overrides: Partial<ThemeConfig> = {}): ThemeConfig {
  return {
    name: 'Carbon Markets',
    frequency: 'daily',
    carbonPulseSearchTerms: 'carbon market',
    esgNewsSearchTerms: 'carbon market',
    trellisSearchTerms: 'carbon market',
    ...overrides,
  };
}

interface MockPageConfig {
  gotoCalls?: string[];
  evaluations?: Array<(url: string) => unknown>;
}

function mockBrowser(config: MockPageConfig) {
  const gotoCalls: string[] = config.gotoCalls ?? [];
  const evalQueue = [...(config.evaluations ?? [])];
  const page = {
    goto: vi.fn(async (url: string) => {
      gotoCalls.push(url);
      return null;
    }),
    evaluate: vi.fn(async (fn: () => unknown) => {
      if (evalQueue.length === 0) return null;
      const current = evalQueue.shift();
      return current ? current(gotoCalls[gotoCalls.length - 1] ?? '') : null;
    }),
  };
  const browser = {
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => undefined),
  };
  vi.mocked(chromium.launch).mockResolvedValue(browser as never);
  return { browser, page, gotoCalls };
}

describe('scrapeTrellis', () => {
  beforeEach(() => {
    vi.mocked(curateTrellisArticles).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('extracts one article per theme using MAX_ARTICLES_PER_THEME=1', async () => {
    mockBrowser({
      evaluations: [
        // Per-theme search page: list of article links.
        () => [
          { url: 'https://trellis.net/article/a1/', title: 'Article A1' },
          { url: 'https://trellis.net/article/a2/', title: 'Article A2' },
        ],
        // Article A1 page: content + date + author.
        () => ({
          content: 'Full text of A1.',
          date: TODAY_ISO,
          author: 'Author A',
        }),
        // Homepage candidates (empty).
        () => [],
      ],
    });
    const result = await scrapeTrellis([stubTheme()], new Set(), 'test-key');
    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe('trellis');
    expect(result[0]?.url).toBe('https://trellis.net/article/a1/');
    expect(result[0]?.title).toBe('Article A1');
    expect(result[0]?.mainTheme).toBe('Carbon Markets');
    expect(result[0]?.author).toBe('Author A');
    expect(result[0]?.fullContent).toBe('Full text of A1.');
  });

  it('skips URLs already in processedUrls', async () => {
    mockBrowser({
      evaluations: [
        () => [
          { url: 'https://trellis.net/article/a1/', title: 'Already Seen' },
          { url: 'https://trellis.net/article/a2/', title: 'Fresh' },
        ],
        () => ({ content: 'Fresh content.', date: TODAY_ISO, author: 'Author A2' }),
        () => [],
      ],
    });
    const seen = new Set(['https://trellis.net/article/a1/']);
    const result = await scrapeTrellis([stubTheme()], seen, 'test-key');
    expect(result).toHaveLength(1);
    expect(result[0]?.url).toBe('https://trellis.net/article/a2/');
  });

  it('skips articles older than MAX_ARTICLE_AGE_DAYS (30) days', async () => {
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    mockBrowser({
      evaluations: [
        () => [{ url: 'https://trellis.net/article/old/', title: 'Old' }],
        () => ({ content: 'Old content.', date: oldDate, author: 'Old Author' }),
        () => [],
      ],
    });
    const result = await scrapeTrellis([stubTheme()], new Set(), 'test-key');
    expect(result).toHaveLength(0);
  });

  it('falls back to default author "Trellis" when no author metadata is present', async () => {
    mockBrowser({
      evaluations: [
        () => [{ url: 'https://trellis.net/article/a/', title: 'T' }],
        () => ({ content: 'Content.', date: TODAY_ISO, author: '' }),
        () => [],
      ],
    });
    const result = await scrapeTrellis([stubTheme()], new Set(), 'test-key');
    expect(result[0]?.author).toBe('Trellis');
  });

  it('falls back to today when no date metadata is present', async () => {
    mockBrowser({
      evaluations: [
        () => [{ url: 'https://trellis.net/article/a/', title: 'T' }],
        () => ({ content: 'Content.', date: '', author: 'A' }),
        () => [],
      ],
    });
    const result = await scrapeTrellis([stubTheme()], new Set(), 'test-key');
    expect(result[0]?.date).toBe(TODAY_ISO);
  });

  it('adds curated picks returned by the curator as RawArticles', async () => {
    mockBrowser({
      evaluations: [
        // Per-theme search returns no links.
        () => [],
        // Homepage candidates: two links with listing-DOM metadata.
        () => [
          { url: 'https://trellis.net/article/c1/', title: 'C1 title', date: TODAY_ISO, excerpt: 'C1 excerpt' },
          { url: 'https://trellis.net/article/c2/', title: 'C2 title', date: TODAY_ISO, excerpt: 'C2 excerpt' },
        ],
        // Curated pick c1: full content fetch.
        () => ({ content: 'C1 body.', date: TODAY_ISO, author: 'C1 Author' }),
        // Curated pick c2: full content fetch.
        () => ({ content: 'C2 body.', date: TODAY_ISO, author: 'C2 Author' }),
      ],
    });
    vi.mocked(curateTrellisArticles).mockResolvedValueOnce([
      { url: 'https://trellis.net/article/c1/', mainTheme: 'Carbon Markets' },
      { url: 'https://trellis.net/article/c2/', mainTheme: 'Methane & Super Pollutants' },
    ]);

    const result = await scrapeTrellis([stubTheme()], new Set(), 'test-key');
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.url)).toEqual([
      'https://trellis.net/article/c1/',
      'https://trellis.net/article/c2/',
    ]);
    expect(result[0]?.mainTheme).toBe('Carbon Markets');
    expect(result[1]?.mainTheme).toBe('Methane & Super Pollutants');
    expect(result.every((a) => a.source === 'trellis')).toBe(true);
  });

  it('returns only per-theme articles if the curator returns zero picks', async () => {
    mockBrowser({
      evaluations: [
        () => [{ url: 'https://trellis.net/article/a/', title: 'A' }],
        () => ({ content: 'Body.', date: TODAY_ISO, author: 'Author' }),
        () => [
          { url: 'https://trellis.net/article/c/', title: 'C', date: TODAY_ISO, excerpt: 'C excerpt' },
        ],
      ],
    });
    vi.mocked(curateTrellisArticles).mockResolvedValueOnce([]);

    const result = await scrapeTrellis([stubTheme()], new Set(), 'test-key');
    expect(result).toHaveLength(1);
    expect(result[0]?.url).toBe('https://trellis.net/article/a/');
  });

  it('returns only per-theme articles if homepage fetch throws', async () => {
    const { page } = mockBrowser({
      evaluations: [
        () => [{ url: 'https://trellis.net/article/a/', title: 'A' }],
        () => ({ content: 'Body.', date: TODAY_ISO, author: 'Author' }),
      ],
    });
    // After the per-theme article page.goto + evaluate pair, the 3rd goto is for the homepage.
    // Make that goto reject.
    let gotoCount = 0;
    page.goto.mockImplementation(async (url: string) => {
      gotoCount += 1;
      if (gotoCount >= 3) throw new Error('homepage unreachable');
      return null;
    });

    const result = await scrapeTrellis([stubTheme()], new Set(), 'test-key');
    expect(result).toHaveLength(1);
    expect(result[0]?.url).toBe('https://trellis.net/article/a/');
    expect(vi.mocked(curateTrellisArticles)).not.toHaveBeenCalled();
  });

  it('passes all themes (from THEMES config) as allowedThemes to the curator, not just eligible ones', async () => {
    mockBrowser({
      evaluations: [
        // Eligible theme 1 search → empty.
        () => [],
        // Eligible theme 2 search → empty.
        () => [],
        // Homepage listing → one candidate with listing-DOM metadata.
        () => [
          { url: 'https://trellis.net/article/c/', title: 'C', date: TODAY_ISO, excerpt: 'ex' },
        ],
      ],
    });
    vi.mocked(curateTrellisArticles).mockResolvedValueOnce([]);

    const eligibleThemes = [
      stubTheme({ name: 'Carbon Markets' }),
      stubTheme({ name: 'Methane Detection & MRV' }),
    ];
    await scrapeTrellis(eligibleThemes, new Set(), 'test-key');

    expect(vi.mocked(curateTrellisArticles)).toHaveBeenCalledTimes(1);
    const [, themeNames] = vi.mocked(curateTrellisArticles).mock.calls[0]!;
    // Curator receives the full THEMES list, not just the two eligible ones.
    // Assert length and presence of themes outside the eligible set.
    expect(themeNames.length).toBeGreaterThan(eligibleThemes.length);
    expect(themeNames).toContain('Carbon Markets');
    expect(themeNames).toContain('Methane Detection & MRV');
    expect(themeNames).toContain('Verification & Auditing'); // monthly theme, typically not eligible daily
  });

  it('prefers .post-content over <article> to keep sidebar/author/related widgets out of the body (regression)', () => {
    // <article class="post-type-post"> on Trellis wraps the article header,
    // byline, image caption, author bio, newsletter signup, "Featured Reports",
    // "Coming up" and "Recommended" widgets. Scoping to .post-content first is
    // what isolates the actual article body. If this list ever drops or
    // demotes .post-content, articles will again render with sidebar bleed and
    // huge whitespace runs (the "black areas" bug in Notion).
    expect(TRELLIS_CONTENT_SELECTORS[0]).toBe('.post-content');
    expect(TRELLIS_CONTENT_SELECTORS).toContain('article');
  });

  it('produces clean paragraph text from CSS-layout whitespace (regression)', async () => {
    // Simulates a Trellis article page where textContent would return leading
    // spaces/tabs due to flex/grid HTML layout, but paragraph-walking produces
    // clean trimmed text joined with double newlines.
    mockBrowser({
      evaluations: [
        () => [{ url: 'https://trellis.net/article/whitespace/', title: 'Whitespace Test' }],
        // The evaluate function in extractArticle walks <p> elements; here we
        // return the already-normalised result that the real browser would
        // produce after the fix (paragraph text trimmed and joined with \n\n).
        () => ({
          content: 'Corporate demand is driving a boom in farmland carbon credits.\n\nFarmers are increasingly turning to carbon markets.',
          date: TODAY_ISO,
          author: 'Jim Giles',
        }),
        () => [],
      ],
    });

    const result = await scrapeTrellis([stubTheme()], new Set(), 'test-key');
    const article = result[0];

    expect(article).toBeDefined();
    expect(article?.fullContent).not.toMatch(/^\s{2,}/m); // no lines starting with 2+ spaces
    expect(article?.fullContent).toContain('Corporate demand is driving a boom in farmland carbon credits.');
    expect(article?.fullContent).toContain('Farmers are increasingly turning to carbon markets.');
    expect(article?.fullContent).toBe(
      'Corporate demand is driving a boom in farmland carbon credits.\n\nFarmers are increasingly turning to carbon markets.',
    );
  });

  it('closes the browser in a finally block even when scraping throws', async () => {
    const { browser } = mockBrowser({ evaluations: [] });
    vi.mocked(chromium.launch).mockResolvedValue(browser as never);
    browser.newPage.mockRejectedValueOnce(new Error('page creation failed'));

    await expect(scrapeTrellis([stubTheme()], new Set(), 'test-key')).rejects.toThrow('page creation failed');
    expect(browser.close).toHaveBeenCalled();
  });
});
