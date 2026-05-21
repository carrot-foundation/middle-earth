import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ThemeConfig } from '../../types.js';

vi.mock('../../ai/article-curator.js', () => ({
  curateArticles: vi.fn(),
}));

import { curateArticles } from '../../ai/article-curator.js';
import { THEMES } from '../../config.constants.js';
import { scrapeTrellis } from '../trellis.js';

const KEY = 'fc-test-key';
const ANTHROPIC = 'sk-test';
const CURATION_LISTING_URL = 'https://trellis.net/articles/';

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

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function themeListingUrl(theme: ThemeConfig): string {
  return `https://trellis.net/?s=${encodeURIComponent(theme.trellisSearchTerms)}`;
}

function listingMarkdown(links: ReadonlyArray<{ url: string; title: string }>): string {
  return links.map(({ url, title }) => `[${title}](${url})`).join('\n');
}

type ScrapeEntry =
  | { markdown: string; publishedTime?: string; author?: string }
  | { status: number };

/**
 * Mock every Firecrawl `/v2/scrape` call. Listing URLs (per-theme search +
 * curation broad pool) and article URLs are siblings in the `scrapes` map;
 * absence falls through to a 404.
 */
function installFetch(scrapes: Record<string, ScrapeEntry>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { body: string }) => {
      if (!url.endsWith('/v2/scrape')) {
        throw new Error(`Unexpected fetch URL ${url} — only /v2/scrape is mocked`);
      }
      const body = JSON.parse(init.body) as { url?: string };
      const entry = scrapes[body.url ?? ''];
      if (!entry || 'status' in entry) {
        return { ok: false, status: entry ? entry.status : 404, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            markdown: entry.markdown,
            metadata: {
              'article:published_time': entry.publishedTime ?? daysAgoIso(2),
              author: entry.author ?? '',
            },
          },
        }),
      };
    }),
  );
}

describe('scrapeTrellis', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('extracts a sanitized RawArticle per theme and strips chrome', async () => {
    vi.mocked(curateArticles).mockResolvedValue([]);
    const theme = stubTheme();
    installFetch({
      [themeListingUrl(theme)]: {
        markdown: listingMarkdown([{ url: 'https://trellis.net/article/a/', title: 'A' }]),
      },
      [CURATION_LISTING_URL]: { markdown: '' },
      'https://trellis.net/article/a/': {
        markdown:
          'Share on Facebook\nSubscribe & Follow\n' +
          'Trellis reports a major circular-economy policy shift this quarter.\n' +
          'RELATED ARTICLE: Something Else',
        author: 'Jane Doe',
        publishedTime: daysAgoIso(3),
      },
    });

    const result = await scrapeTrellis([theme], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.source).toBe('trellis');
    expect(result[0]!.author).toBe('Jane Doe');
    expect(result[0]!.fullContent).toContain('circular-economy policy shift');
    expect(result[0]!.fullContent).not.toMatch(/Share on Facebook|Subscribe & Follow|RELATED ARTICLE:/);
  });

  it('hits the publisher search URL for per-theme discovery', async () => {
    const theme = stubTheme({ trellisSearchTerms: 'methane policy' });
    vi.mocked(curateArticles).mockResolvedValue([]);
    const seen = new Set<string>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { url?: string };
        seen.add(body.url ?? '');
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { markdown: '', metadata: {} } }),
        };
      }),
    );

    await scrapeTrellis([theme], new Set(), ANTHROPIC, KEY);

    expect(seen).toContain('https://trellis.net/?s=methane%20policy');
    expect(seen).toContain(CURATION_LISTING_URL);
  });

  it('skips URLs already in processedUrls (no scrape)', async () => {
    vi.mocked(curateArticles).mockResolvedValue([]);
    const theme = stubTheme();
    installFetch({
      [themeListingUrl(theme)]: {
        markdown: listingMarkdown([{ url: 'https://trellis.net/article/seen/', title: 'Seen' }]),
      },
      [CURATION_LISTING_URL]: { markdown: '' },
    });
    const result = await scrapeTrellis(
      [theme],
      new Set(['https://trellis.net/article/seen/']),
      ANTHROPIC,
      KEY,
    );
    expect(result).toHaveLength(0);
  });

  it('skips undated and too-old articles', async () => {
    vi.mocked(curateArticles).mockResolvedValue([]);
    const theme = stubTheme();
    installFetch({
      [themeListingUrl(theme)]: {
        markdown: listingMarkdown([
          { url: 'https://trellis.net/article/undated/', title: 'Undated' },
          { url: 'https://trellis.net/article/old/', title: 'Old' },
        ]),
      },
      [CURATION_LISTING_URL]: { markdown: '' },
      'https://trellis.net/article/undated/': { markdown: 'Valid body, no date.', publishedTime: '' },
      'https://trellis.net/article/old/': {
        markdown: 'Valid body, ancient.',
        publishedTime: daysAgoIso(200),
      },
    });
    const result = await scrapeTrellis([theme], new Set(), ANTHROPIC, KEY);
    expect(result).toHaveLength(0);
  });

  it('skips a page that sanitizes to empty (chrome-only)', async () => {
    vi.mocked(curateArticles).mockResolvedValue([]);
    const theme = stubTheme();
    installFetch({
      [themeListingUrl(theme)]: {
        markdown: listingMarkdown([{ url: 'https://trellis.net/article/chrome/', title: 'Chrome' }]),
      },
      [CURATION_LISTING_URL]: { markdown: '' },
      'https://trellis.net/article/chrome/': {
        markdown: 'Share on Facebook\nSubscribe & Follow\nRELATED ARTICLE: x',
        publishedTime: daysAgoIso(1),
      },
    });
    const result = await scrapeTrellis([theme], new Set(), ANTHROPIC, KEY);
    expect(result).toHaveLength(0);
  });

  it('continues other themes when one theme discovery fails', async () => {
    vi.mocked(curateArticles).mockResolvedValue([]);
    const badTheme = stubTheme({ name: 'Bad', trellisSearchTerms: 'boom' });
    const goodTheme = stubTheme({ name: 'Good' });
    installFetch({
      [themeListingUrl(badTheme)]: { status: 500 },
      [themeListingUrl(goodTheme)]: {
        markdown: listingMarkdown([{ url: 'https://trellis.net/article/ok/', title: 'OK' }]),
      },
      [CURATION_LISTING_URL]: { markdown: '' },
      'https://trellis.net/article/ok/': {
        markdown: 'A solid Trellis article body about composting policy.',
        publishedTime: daysAgoIso(2),
        author: 'Trellis',
      },
    });

    const result = await scrapeTrellis([badTheme, goodTheme], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.mainTheme).toBe('Good');
  });

  it('adds curated picks; candidates carry title-based excerpt and all THEMES go to curator', async () => {
    const theme = stubTheme();
    installFetch({
      [themeListingUrl(theme)]: { markdown: '' },
      [CURATION_LISTING_URL]: {
        markdown: listingMarkdown([
          { url: 'https://trellis.net/article/c1/', title: 'Cand 1' },
          { url: 'https://trellis.net/article/c2/', title: 'Cand 2' },
        ]),
      },
      'https://trellis.net/article/c1/': {
        markdown: 'Curated article one body about methane abatement.',
        publishedTime: daysAgoIso(1),
      },
    });
    vi.mocked(curateArticles).mockResolvedValue([
      { url: 'https://trellis.net/article/c1/', mainTheme: 'Methane & Super Pollutants' },
    ]);

    const result = await scrapeTrellis([theme], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://trellis.net/article/c1/');
    expect(result[0]!.mainTheme).toBe('Methane & Super Pollutants');

    const [candidates, themeNames] = vi.mocked(curateArticles).mock.calls[0]!;
    expect(candidates[0]).toMatchObject({
      url: 'https://trellis.net/article/c1/',
      title: 'Cand 1',
      // Markdown link extraction can't see the publisher's listing-card
      // excerpt, so we fall back to the title (matches the curator contract).
      excerpt: 'Cand 1',
      date: '',
    });
    expect(themeNames).toEqual(THEMES.map((theme) => theme.name));
  });

  it('does not call the curator when the candidate pool is empty', async () => {
    const theme = stubTheme();
    installFetch({
      [themeListingUrl(theme)]: {
        markdown: listingMarkdown([{ url: 'https://trellis.net/article/t/', title: 'T' }]),
      },
      [CURATION_LISTING_URL]: { markdown: '' },
      'https://trellis.net/article/t/': {
        markdown: 'A per-theme Trellis article body about waste policy.',
        publishedTime: daysAgoIso(1),
      },
    });

    const result = await scrapeTrellis([theme], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(1);
    expect(vi.mocked(curateArticles)).not.toHaveBeenCalled();
  });

  it('returns only per-theme articles when the curation discovery fails (resilience)', async () => {
    vi.mocked(curateArticles).mockResolvedValue([]);
    const theme = stubTheme();
    installFetch({
      [themeListingUrl(theme)]: {
        markdown: listingMarkdown([{ url: 'https://trellis.net/article/pt/', title: 'PT' }]),
      },
      [CURATION_LISTING_URL]: { status: 500 },
      'https://trellis.net/article/pt/': {
        markdown: 'Per-theme body about circular economy in depth.',
        publishedTime: daysAgoIso(1),
        author: 'Trellis',
      },
    });

    const result = await scrapeTrellis([theme], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://trellis.net/article/pt/');
    expect(vi.mocked(curateArticles)).not.toHaveBeenCalled();
  });

  it('fills the per-theme cap from later candidates when early ones are skipped (cap on successful extractions)', async () => {
    vi.mocked(curateArticles).mockResolvedValue([]);
    const theme = stubTheme();
    installFetch({
      [themeListingUrl(theme)]: {
        markdown: listingMarkdown([
          { url: 'https://trellis.net/article/undated/', title: 'Undated' },
          { url: 'https://trellis.net/article/stale/', title: 'Stale' },
          { url: 'https://trellis.net/article/good/', title: 'Good' },
        ]),
      },
      [CURATION_LISTING_URL]: { markdown: '' },
      'https://trellis.net/article/undated/': { markdown: 'Body, no date.', publishedTime: '' },
      'https://trellis.net/article/stale/': {
        markdown: 'Body, ancient.',
        publishedTime: daysAgoIso(200),
      },
      'https://trellis.net/article/good/': {
        markdown: 'Fresh Trellis article body about climate finance.',
        publishedTime: daysAgoIso(1),
      },
    });

    const result = await scrapeTrellis([theme], new Set(), ANTHROPIC, KEY);

    expect(result.map((article) => article.url)).toEqual(['https://trellis.net/article/good/']);
  });

  it('stops scraping per-theme candidates after the hard cap (5) to bound credit spend', async () => {
    vi.mocked(curateArticles).mockResolvedValue([]);
    const theme = stubTheme();
    const links = Array.from({ length: 8 }, (_unused, index) => ({
      url: `https://trellis.net/article/c${index}/`,
      title: `Candidate ${index}`,
    }));
    const fetchSpy = vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { url: string };
      if (body.url === themeListingUrl(theme)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { markdown: listingMarkdown(links), metadata: {} } }),
        };
      }
      if (body.url === CURATION_LISTING_URL) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { markdown: '', metadata: {} } }),
        };
      }
      // Every candidate skips on missing publish_time (1 credit each).
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: { markdown: '', metadata: { 'article:published_time': '' } },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchSpy);

    await scrapeTrellis([theme], new Set(), ANTHROPIC, KEY);

    // 1 per-theme listing + 5 candidate scrapes + 1 curation listing scrape = 7
    expect(fetchSpy).toHaveBeenCalledTimes(7);
  });

  it('returns only per-theme articles when the curator itself throws (Anthropic outage)', async () => {
    vi.mocked(curateArticles).mockRejectedValue(new Error('anthropic 401'));
    const theme = stubTheme();
    installFetch({
      [themeListingUrl(theme)]: {
        markdown: listingMarkdown([{ url: 'https://trellis.net/article/pt/', title: 'PT' }]),
      },
      [CURATION_LISTING_URL]: {
        markdown: listingMarkdown([
          { url: 'https://trellis.net/article/c1/', title: 'Cand 1' },
        ]),
      },
      'https://trellis.net/article/pt/': {
        markdown: 'Per-theme Trellis article about waste policy.',
        publishedTime: daysAgoIso(1),
      },
    });

    const result = await scrapeTrellis([theme], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://trellis.net/article/pt/');
  });

  it('keeps partial curated picks when a later pick hits a quota error', async () => {
    const theme = stubTheme();
    installFetch({
      [themeListingUrl(theme)]: { markdown: '' },
      [CURATION_LISTING_URL]: {
        markdown: listingMarkdown([
          { url: 'https://trellis.net/article/good/', title: 'Good' },
          { url: 'https://trellis.net/article/quota/', title: 'Quota' },
        ]),
      },
      'https://trellis.net/article/good/': {
        markdown: 'Good curated body about emissions monitoring.',
        publishedTime: daysAgoIso(1),
      },
      'https://trellis.net/article/quota/': { status: 402 },
    });
    vi.mocked(curateArticles).mockResolvedValue([
      { url: 'https://trellis.net/article/good/', mainTheme: 'Carbon Markets' },
      { url: 'https://trellis.net/article/quota/', mainTheme: 'Carbon Markets' },
    ]);

    const result = await scrapeTrellis([theme], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://trellis.net/article/good/');
  });

  it.each([402, 429] as const)(
    'skips the curation flow entirely when a per-theme Firecrawl %s quota/rate-limit response occurs',
    async (status) => {
      const theme = stubTheme();
      installFetch({
        [themeListingUrl(theme)]: {
          markdown: listingMarkdown([{ url: 'https://trellis.net/article/q/', title: 'Q' }]),
        },
        [CURATION_LISTING_URL]: {
          markdown: listingMarkdown([
            { url: 'https://trellis.net/article/curated/', title: 'Curated' },
          ]),
        },
        'https://trellis.net/article/q/': { status },
        'https://trellis.net/article/curated/': {
          markdown: 'Should never be scraped because quota aborted first.',
          publishedTime: daysAgoIso(1),
        },
      });

      const result = await scrapeTrellis([theme], new Set(), ANTHROPIC, KEY);

      expect(result).toHaveLength(0);
      expect(vi.mocked(curateArticles)).not.toHaveBeenCalled();
    },
  );

  it('skips curation when the per-theme listing itself returns 402', async () => {
    const theme = stubTheme();
    installFetch({
      [themeListingUrl(theme)]: { status: 402 },
      [CURATION_LISTING_URL]: {
        markdown: listingMarkdown([{ url: 'https://trellis.net/article/c/', title: 'C' }]),
      },
      'https://trellis.net/article/c/': {
        markdown: 'Should never be scraped — discovery quota already exhausted.',
        publishedTime: daysAgoIso(1),
      },
    });

    const result = await scrapeTrellis([theme], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(0);
    expect(vi.mocked(curateArticles)).not.toHaveBeenCalled();
  });

  it('rejects off-domain and non-article URLs from listings', async () => {
    vi.mocked(curateArticles).mockResolvedValue([]);
    const theme = stubTheme();
    installFetch({
      [themeListingUrl(theme)]: {
        markdown: listingMarkdown([
          { url: 'https://evil.com/article/x/', title: 'Off domain' },
          { url: 'https://trellis.net/about/', title: 'Not an article' },
          { url: 'https://trellis.net/article/ok/', title: 'Valid' },
        ]),
      },
      [CURATION_LISTING_URL]: { markdown: '' },
      'https://trellis.net/article/ok/': {
        markdown: 'A valid Trellis article body about emissions policy.',
        publishedTime: daysAgoIso(1),
      },
    });

    const result = await scrapeTrellis([theme], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://trellis.net/article/ok/');
  });

  it('deduplicates repeated curator picks (scrapes a URL once)', async () => {
    const theme = stubTheme();
    installFetch({
      [themeListingUrl(theme)]: { markdown: '' },
      [CURATION_LISTING_URL]: {
        markdown: listingMarkdown([{ url: 'https://trellis.net/article/dup/', title: 'Dup' }]),
      },
      'https://trellis.net/article/dup/': {
        markdown: 'A curated article body about circular economy finance.',
        publishedTime: daysAgoIso(1),
      },
    });
    vi.mocked(curateArticles).mockResolvedValue([
      { url: 'https://trellis.net/article/dup/', mainTheme: 'Carbon Markets' },
      { url: 'https://trellis.net/article/dup/', mainTheme: 'Carbon Markets' },
    ]);

    const result = await scrapeTrellis([theme], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://trellis.net/article/dup/');
  });

  it('does not re-scrape an article that already matched an earlier theme', async () => {
    vi.mocked(curateArticles).mockResolvedValue([]);
    const themeA = stubTheme({ name: 'Theme A', trellisSearchTerms: 'aaa' });
    const themeB = stubTheme({ name: 'Theme B', trellisSearchTerms: 'bbb' });
    let scrapeCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { url?: string };
        if (body.url === themeListingUrl(themeA) || body.url === themeListingUrl(themeB)) {
          // Every theme listing surfaces the SAME article.
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                markdown: listingMarkdown([
                  { url: 'https://trellis.net/article/shared/', title: 'Shared' },
                ]),
                metadata: {},
              },
            }),
          };
        }
        if (body.url === CURATION_LISTING_URL) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: { markdown: '', metadata: {} } }),
          };
        }
        scrapeCalls += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              markdown: 'A Trellis article matching multiple themes about carbon policy.',
              metadata: { 'article:published_time': daysAgoIso(1), author: 'Trellis' },
            },
          }),
        };
      }),
    );

    const result = await scrapeTrellis([themeA, themeB], new Set(), ANTHROPIC, KEY);

    expect(scrapeCalls).toBe(1);
    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://trellis.net/article/shared/');
  });

  it('throws when the Firecrawl API key is not configured', async () => {
    await expect(scrapeTrellis([stubTheme()], new Set(), ANTHROPIC, '')).rejects.toThrow(
      /FIRECRAWL_API_KEY not configured/,
    );
  });
});
