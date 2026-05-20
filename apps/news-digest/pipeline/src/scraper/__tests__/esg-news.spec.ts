import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ThemeConfig } from '../../types.js';
import { scrapeEsgNews } from '../esg-news.js';

const KEY = 'fc-test-key';

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

function listingUrl(theme: ThemeConfig): string {
  return `https://esgnews.com/?s=${encodeURIComponent(theme.esgNewsSearchTerms)}`;
}

/** Synthesize a listing-page markdown body from a set of links. */
function listingMarkdown(links: ReadonlyArray<{ url: string; title: string }>): string {
  return links.map(({ url, title }) => `[${title}](${url})`).join('\n');
}

type ScrapeEntry =
  | { markdown: string; publishedTime?: string; author?: string }
  | { status: number };

/**
 * Mock every Firecrawl `/v2/scrape` call (both listing-page discovery and
 * per-article scraping). Listing URLs and article URLs are siblings in the
 * `scrapes` map; absence falls through to a 404.
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

describe('scrapeEsgNews', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('hits the publisher search URL for discovery (recency comes from there)', async () => {
    const theme = stubTheme({ esgNewsSearchTerms: 'methane policy' });
    const fetchSpy = vi.fn(async (_url: string, _init: { body: string }) => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { markdown: '', metadata: {} } }),
    }));
    vi.stubGlobal('fetch', fetchSpy);

    await scrapeEsgNews([theme], new Set(), [], KEY);

    const requested = (JSON.parse(fetchSpy.mock.calls[0]![1].body) as { url: string }).url;
    expect(requested).toBe('https://esgnews.com/?s=methane%20policy');
  });

  it('returns a sanitized RawArticle and strips page chrome from markdown', async () => {
    const theme = stubTheme();
    installFetch({
      [listingUrl(theme)]: {
        markdown: listingMarkdown([{ url: 'https://esgnews.com/nz/', title: 'NZ Climate Law' }]),
      },
      'https://esgnews.com/nz/': {
        markdown:
          'Climate\n/\nGovernment\n/\nNews\nby ESG News Editorial Team\n' +
          'Share:\nShare on Facebook\nShare on LinkedIn\n' +
          'New Zealand plans to amend the Climate Change Response Act 2002 to block claims.\n' +
          'RELATED ARTICLE: New Zealand Lifts Climate Reporting Thresholds\n' +
          'Subscribe & Follow for Daily ESG Insights\n' +
          'ESG News Editorial Team The ESG News Editorial Team is comprised of veteran journalists.',
        author: 'ESG News Editorial Team',
        publishedTime: daysAgoIso(3),
      },
    });

    const result = await scrapeEsgNews([theme], new Set(), [], KEY);

    expect(result).toHaveLength(1);
    const article = result[0]!;
    expect(article.source).toBe('esgnews');
    expect(article.url).toBe('https://esgnews.com/nz/');
    expect(article.author).toBe('ESG News Editorial Team');
    expect(article.fullContent).toContain(
      'New Zealand plans to amend the Climate Change Response Act 2002 to block claims.',
    );
    expect(article.fullContent).not.toMatch(/Share on (Facebook|LinkedIn)/);
    expect(article.fullContent).not.toMatch(/RELATED ARTICLE:/);
    expect(article.fullContent).not.toMatch(/Subscribe & Follow/);
    expect(article.fullContent).not.toMatch(/Editorial Team is comprised of/);
  });

  it('filters tag/category/author/page/region/wp-*/static-page index links out of the listing', async () => {
    const theme = stubTheme();
    const scrapedUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { url?: string };
        if (body.url === listingUrl(theme)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                markdown: listingMarkdown([
                  { url: 'https://esgnews.com/tag/methane/', title: 'Methane tag' },
                  { url: 'https://esgnews.com/category/policy/', title: 'Policy category' },
                  { url: 'https://esgnews.com/author/someone/', title: 'Author page' },
                  { url: 'https://esgnews.com/page/12/', title: 'Page 12' },
                  { url: 'https://esgnews.com/esg-europe/page/15/', title: 'EU index' },
                  { url: 'https://esgnews.com/esg-americas/page/3/', title: 'Americas index' },
                  { url: 'https://esgnews.com/feed/', title: 'RSS feed' },
                  { url: 'https://esgnews.com/wp-admin/edit.php', title: 'WP admin' },
                  { url: 'https://esgnews.com/wp-content/uploads/2026/x.jpg', title: 'Upload' },
                  { url: 'https://esgnews.com/wp-json/wp/v2/posts', title: 'WP JSON API' },
                  { url: 'https://esgnews.com/about/', title: 'About' },
                  { url: 'https://esgnews.com/contact/', title: 'Contact' },
                  { url: 'https://esgnews.com/real-article-slug/', title: 'Real Article' },
                ]),
                metadata: {},
              },
            }),
          };
        }
        scrapedUrls.push(body.url ?? '');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              markdown: 'A real article body about carbon market policy and methane regulation.',
              metadata: { 'article:published_time': daysAgoIso(1), author: 'ESG News' },
            },
          }),
        };
      }),
    );

    const result = await scrapeEsgNews([theme], new Set(), [], KEY);

    // Only the real article should have been scraped; no index/static page hit Firecrawl.
    expect(scrapedUrls).toEqual(['https://esgnews.com/real-article-slug/']);
    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://esgnews.com/real-article-slug/');
  });

  it('filters index paths regardless of trailing slash (no-trailing-slash variants too)', async () => {
    // Cursor bot finding on PR #36: prefix-list with trailing `/` would let
    // `https://esgnews.com/about` (no slash) through. First-segment matching
    // catches both `/about` and `/about/`.
    const theme = stubTheme();
    const scrapedUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { url?: string };
        if (body.url === listingUrl(theme)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                markdown: listingMarkdown([
                  { url: 'https://esgnews.com/about', title: 'About no-slash' },
                  { url: 'https://esgnews.com/tag', title: 'Tag root no-slash' },
                  { url: 'https://esgnews.com/wp-admin', title: 'WP admin no-slash' },
                  { url: 'https://esgnews.com/feedback-policy/', title: 'Real Article (feedback)' },
                ]),
                metadata: {},
              },
            }),
          };
        }
        scrapedUrls.push(body.url ?? '');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              markdown: 'A feedback-policy article body — should be scraped, not excluded by /feed.',
              metadata: { 'article:published_time': daysAgoIso(1), author: 'ESG News' },
            },
          }),
        };
      }),
    );

    const result = await scrapeEsgNews([theme], new Set(), [], KEY);

    // /about, /tag, /wp-admin all rejected (slug-less or known index first-segment).
    // /feedback-policy/ accepted (first segment is "feedback-policy", not "feed").
    expect(scrapedUrls).toEqual(['https://esgnews.com/feedback-policy/']);
    expect(result).toHaveLength(1);
  });

  it('rejects multi-segment paths the prefix list doesn\'t enumerate (depth-1 safety net)', async () => {
    const theme = stubTheme();
    const scrapedUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { url?: string };
        if (body.url === listingUrl(theme)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                markdown: listingMarkdown([
                  // Hypothetical new index types (e.g. CMS migration adds these
                  // overnight); the prefix list wouldn't enumerate them yet,
                  // but the depth-1 segment check rejects them anyway.
                  { url: 'https://esgnews.com/topic/methane/', title: 'New topic index' },
                  { url: 'https://esgnews.com/region/europe/digest/', title: 'Deep listing' },
                  { url: 'https://esgnews.com/finalists-2026-emissions-rule/', title: 'Real Article' },
                ]),
                metadata: {},
              },
            }),
          };
        }
        scrapedUrls.push(body.url ?? '');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              markdown: 'A real article body about a finalised emissions rule.',
              metadata: { 'article:published_time': daysAgoIso(1), author: 'ESG News' },
            },
          }),
        };
      }),
    );

    const result = await scrapeEsgNews([theme], new Set(), [], KEY);

    expect(scrapedUrls).toEqual(['https://esgnews.com/finalists-2026-emissions-rule/']);
    expect(result).toHaveLength(1);
  });

  it('skips results already in processedUrls (no article scrape call)', async () => {
    const theme = stubTheme();
    installFetch({
      [listingUrl(theme)]: {
        markdown: listingMarkdown([{ url: 'https://esgnews.com/seen/', title: 'Seen Article' }]),
      },
    });
    const result = await scrapeEsgNews(
      [theme],
      new Set(['https://esgnews.com/seen/']),
      [],
      KEY,
    );
    expect(result).toHaveLength(0);
  });

  it('skips results that duplicate a Carbon Pulse title', async () => {
    const theme = stubTheme();
    installFetch({
      [listingUrl(theme)]: {
        markdown: listingMarkdown([
          { url: 'https://esgnews.com/dup/', title: 'Global Methane Pledge Reaches Milestone' },
        ]),
      },
    });
    const result = await scrapeEsgNews(
      [theme],
      new Set(),
      ['Global Methane Pledge Reaches Major Milestone Today'],
      KEY,
    );
    expect(result).toHaveLength(0);
  });

  it('skips articles older than the age limit', async () => {
    const theme = stubTheme();
    installFetch({
      [listingUrl(theme)]: {
        markdown: listingMarkdown([{ url: 'https://esgnews.com/old/', title: 'Old Article' }]),
      },
      'https://esgnews.com/old/': {
        markdown: 'This is a sufficiently long article body about carbon markets.',
        publishedTime: daysAgoIso(120),
      },
    });
    const result = await scrapeEsgNews([theme], new Set(), [], KEY);
    expect(result).toHaveLength(0);
  });

  it('skips pages that sanitize to empty (chrome-only)', async () => {
    const theme = stubTheme();
    installFetch({
      [listingUrl(theme)]: {
        markdown: listingMarkdown([{ url: 'https://esgnews.com/chrome/', title: 'Chrome Only' }]),
      },
      'https://esgnews.com/chrome/': {
        markdown: 'Share:\nShare on Facebook\nSubscribe & Follow\nRELATED ARTICLE: Something',
        publishedTime: daysAgoIso(1),
      },
    });
    const result = await scrapeEsgNews([theme], new Set(), [], KEY);
    expect(result).toHaveLength(0);
  });

  it('continues other themes when one theme discovery fails', async () => {
    const badTheme = stubTheme({ name: 'Bad', esgNewsSearchTerms: 'boom' });
    const goodTheme = stubTheme({ name: 'Good' });
    installFetch({
      [listingUrl(badTheme)]: { status: 500 },
      [listingUrl(goodTheme)]: {
        markdown: listingMarkdown([{ url: 'https://esgnews.com/ok/', title: 'Good One' }]),
      },
      'https://esgnews.com/ok/': {
        markdown: 'A solid article body about composting infrastructure and policy.',
        publishedTime: daysAgoIso(2),
        author: 'ESG News',
      },
    });

    const result = await scrapeEsgNews([badTheme, goodTheme], new Set(), [], KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.mainTheme).toBe('Good');
  });

  it('skips a single article whose scrape fails but keeps the others', async () => {
    const theme = stubTheme();
    installFetch({
      [listingUrl(theme)]: {
        markdown: listingMarkdown([
          { url: 'https://esgnews.com/bad/', title: 'Bad Scrape' },
          { url: 'https://esgnews.com/good/', title: 'Good Scrape' },
        ]),
      },
      'https://esgnews.com/bad/': { status: 500 },
      'https://esgnews.com/good/': {
        markdown: 'A complete article body discussing carbon market regulation in depth.',
        publishedTime: daysAgoIso(1),
      },
    });

    const result = await scrapeEsgNews([theme], new Set(), [], KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://esgnews.com/good/');
  });

  it('skips an article with no parseable publish date (parity with carbon-pulse)', async () => {
    const theme = stubTheme();
    installFetch({
      [listingUrl(theme)]: {
        markdown: listingMarkdown([{ url: 'https://esgnews.com/undated/', title: 'Undated' }]),
      },
      'https://esgnews.com/undated/': {
        markdown: 'A perfectly valid long article body with no date metadata.',
        publishedTime: '',
      },
    });
    const result = await scrapeEsgNews([theme], new Set(), [], KEY);
    expect(result).toHaveLength(0);
  });

  it('scrapes at most MAX_ARTICLES_PER_THEME eligible results', async () => {
    const theme = stubTheme();
    let articleScrapes = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { url?: string };
        if (body.url === listingUrl(theme)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                markdown: listingMarkdown([
                  { url: 'https://esgnews.com/1/', title: 'One' },
                  { url: 'https://esgnews.com/2/', title: 'Two' },
                  { url: 'https://esgnews.com/3/', title: 'Three' },
                ]),
                metadata: {},
              },
            }),
          };
        }
        articleScrapes += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              markdown: `Body for ${body.url} with enough prose to survive sanitization.`,
              metadata: { 'article:published_time': daysAgoIso(1), author: 'ESG News' },
            },
          }),
        };
      }),
    );

    const result = await scrapeEsgNews([theme], new Set(), [], KEY);

    expect(articleScrapes).toBe(2);
    expect(result).toHaveLength(2);
  });

  it('aborts the remaining themes when the listing scrape itself returns 402 (quota)', async () => {
    const quotaTheme = stubTheme({ name: 'First', esgNewsSearchTerms: 'first' });
    const wouldBeNextTheme = stubTheme({ name: 'Second', esgNewsSearchTerms: 'second' });
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { url?: string };
        requestedUrls.push(body.url ?? '');
        if (body.url === listingUrl(quotaTheme)) {
          return { ok: false, status: 402, json: async () => ({}) };
        }
        return { ok: true, status: 200, json: async () => ({ data: { markdown: '', metadata: {} } }) };
      }),
    );

    const result = await scrapeEsgNews([quotaTheme, wouldBeNextTheme], new Set(), [], KEY);

    expect(result).toEqual([]);
    // The second theme's listing must NOT be requested — the loop short-circuited.
    expect(requestedUrls).not.toContain(listingUrl(wouldBeNextTheme));
  });

  it.each([402, 429] as const)(
    'aborts the theme on a Firecrawl %s quota/rate-limit response from per-article scrapes',
    async (status) => {
      const quotaTheme = stubTheme({ name: 'Quota', esgNewsSearchTerms: 'quota' });
      const fineTheme = stubTheme({ name: 'Fine' });
      installFetch({
        [listingUrl(quotaTheme)]: {
          markdown: listingMarkdown([
            { url: 'https://esgnews.com/q1/', title: 'Q1' },
            { url: 'https://esgnews.com/q2/', title: 'Q2' },
          ]),
        },
        [listingUrl(fineTheme)]: {
          markdown: listingMarkdown([{ url: 'https://esgnews.com/ok/', title: 'OK' }]),
        },
        'https://esgnews.com/q1/': { status },
        'https://esgnews.com/q2/': { status },
        'https://esgnews.com/ok/': {
          markdown: 'A healthy article body about carbon market regulation.',
          publishedTime: daysAgoIso(1),
        },
      });

      const result = await scrapeEsgNews([quotaTheme, fineTheme], new Set(), [], KEY);

      expect(result).toHaveLength(1);
      expect(result[0]!.mainTheme).toBe('Fine');
    },
  );

  it('fills the per-theme cap from later candidates when early ones are skipped', async () => {
    const theme = stubTheme();
    installFetch({
      [listingUrl(theme)]: {
        markdown: listingMarkdown([
          { url: 'https://esgnews.com/undated/', title: 'Undated' },
          { url: 'https://esgnews.com/stale/', title: 'Stale' },
          { url: 'https://esgnews.com/good1/', title: 'Good 1' },
          { url: 'https://esgnews.com/good2/', title: 'Good 2' },
        ]),
      },
      'https://esgnews.com/undated/': { markdown: 'Valid body but no date.', publishedTime: '' },
      'https://esgnews.com/stale/': {
        markdown: 'Valid body but ancient.',
        publishedTime: daysAgoIso(120),
      },
      'https://esgnews.com/good1/': {
        markdown: 'Fresh article one about carbon markets and policy.',
        publishedTime: daysAgoIso(1),
      },
      'https://esgnews.com/good2/': {
        markdown: 'Fresh article two about composting infrastructure.',
        publishedTime: daysAgoIso(2),
      },
    });

    const result = await scrapeEsgNews([theme], new Set(), [], KEY);

    expect(result.map((article) => article.url)).toEqual([
      'https://esgnews.com/good1/',
      'https://esgnews.com/good2/',
    ]);
  });

  it('stops scraping per-theme candidates after the hard cap (5) to bound credit spend', async () => {
    const theme = stubTheme();
    const links = Array.from({ length: 8 }, (_unused, index) => ({
      url: `https://esgnews.com/c${index}/`,
      title: `Candidate ${index}`,
    }));
    const articleScrapes: Record<string, { markdown: string; publishedTime: string }> = {};
    for (const link of links) {
      articleScrapes[link.url] = { markdown: '', publishedTime: '' };
    }
    const fetchSpy = vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { url: string };
      if (body.url === listingUrl(theme)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { markdown: listingMarkdown(links), metadata: {} } }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: { markdown: '', metadata: { 'article:published_time': '' } },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchSpy);

    await scrapeEsgNews([theme], new Set(), [], KEY);

    // 1 listing scrape + at most 5 candidate scrapes
    expect(fetchSpy).toHaveBeenCalledTimes(6);
  });

  it('preserves articles already collected when a later scrape hits a quota error', async () => {
    const theme = stubTheme();
    installFetch({
      [listingUrl(theme)]: {
        markdown: listingMarkdown([
          { url: 'https://esgnews.com/collected/', title: 'Collected' },
          { url: 'https://esgnews.com/quota/', title: 'Quota' },
        ]),
      },
      'https://esgnews.com/collected/': {
        markdown: 'A solid article body about methane monitoring.',
        publishedTime: daysAgoIso(1),
      },
      'https://esgnews.com/quota/': { status: 402 },
    });

    const result = await scrapeEsgNews([theme], new Set(), [], KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://esgnews.com/collected/');
  });

  it('does not re-scrape an article that already matched an earlier theme', async () => {
    const themeA = stubTheme({ name: 'Theme A', esgNewsSearchTerms: 'aaa' });
    const themeB = stubTheme({ name: 'Theme B', esgNewsSearchTerms: 'bbb' });
    let articleScrapes = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { url?: string };
        if (body.url === listingUrl(themeA) || body.url === listingUrl(themeB)) {
          // Every theme listing surfaces the SAME article.
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                markdown: listingMarkdown([
                  { url: 'https://esgnews.com/shared/', title: 'Shared' },
                ]),
                metadata: {},
              },
            }),
          };
        }
        articleScrapes += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              markdown: 'An ESG article matching multiple themes about methane policy.',
              metadata: { 'article:published_time': daysAgoIso(1), author: 'ESG News' },
            },
          }),
        };
      }),
    );

    const result = await scrapeEsgNews([themeA, themeB], new Set(), [], KEY);

    expect(articleScrapes).toBe(1);
    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://esgnews.com/shared/');
  });

  it('throws when the Firecrawl API key is not configured', async () => {
    await expect(scrapeEsgNews([stubTheme()], new Set(), [], '')).rejects.toThrow(
      /FIRECRAWL_API_KEY not configured/,
    );
  });
});
