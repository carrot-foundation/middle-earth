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

type ScrapeEntry =
  | { markdown: string; publishedTime?: string; author?: string }
  | { status: number };

function installFetch(opts: {
  search: (query: string) => Array<{ url: string; title: string }>;
  scrape: Record<string, ScrapeEntry>;
}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { query?: string; url?: string };
      if (url.endsWith('/v2/search')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { web: opts.search(body.query ?? '') } }),
        };
      }
      const entry = opts.scrape[body.url ?? ''];
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

  it('returns a sanitized RawArticle and strips page chrome from markdown', async () => {
    installFetch({
      search: () => [{ url: 'https://esgnews.com/nz/', title: 'NZ Climate Law' }],
      scrape: {
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
      },
    });

    const result = await scrapeEsgNews([stubTheme()], new Set(), [], KEY);

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

  it('skips results already in processedUrls (no scrape call)', async () => {
    installFetch({
      search: () => [{ url: 'https://esgnews.com/seen/', title: 'Seen Article' }],
      scrape: {},
    });
    const result = await scrapeEsgNews(
      [stubTheme()],
      new Set(['https://esgnews.com/seen/']),
      [],
      KEY,
    );
    expect(result).toHaveLength(0);
  });

  it('skips results that duplicate a Carbon Pulse title', async () => {
    installFetch({
      search: () => [
        { url: 'https://esgnews.com/dup/', title: 'Global Methane Pledge Reaches Milestone' },
      ],
      scrape: {},
    });
    const result = await scrapeEsgNews(
      [stubTheme()],
      new Set(),
      ['Global Methane Pledge Reaches Major Milestone Today'],
      KEY,
    );
    expect(result).toHaveLength(0);
  });

  it('skips articles older than the age limit', async () => {
    installFetch({
      search: () => [{ url: 'https://esgnews.com/old/', title: 'Old Article' }],
      scrape: {
        'https://esgnews.com/old/': {
          markdown: 'This is a sufficiently long article body about carbon markets.',
          publishedTime: daysAgoIso(120),
        },
      },
    });
    const result = await scrapeEsgNews([stubTheme()], new Set(), [], KEY);
    expect(result).toHaveLength(0);
  });

  it('skips pages that sanitize to empty (chrome-only)', async () => {
    installFetch({
      search: () => [{ url: 'https://esgnews.com/chrome/', title: 'Chrome Only' }],
      scrape: {
        'https://esgnews.com/chrome/': {
          markdown: 'Share:\nShare on Facebook\nSubscribe & Follow\nRELATED ARTICLE: Something',
          publishedTime: daysAgoIso(1),
        },
      },
    });
    const result = await scrapeEsgNews([stubTheme()], new Set(), [], KEY);
    expect(result).toHaveLength(0);
  });

  it('continues other themes when one theme search fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { query?: string; url?: string };
        if (url.endsWith('/v2/search')) {
          if ((body.query ?? '').includes('boom')) {
            return { ok: false, status: 500, json: async () => ({}) };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: { web: [{ url: 'https://esgnews.com/ok/', title: 'Good One' }] },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              markdown: 'A solid article body about composting infrastructure and policy.',
              metadata: { 'article:published_time': daysAgoIso(2), author: 'ESG News' },
            },
          }),
        };
      }),
    );

    const result = await scrapeEsgNews(
      [stubTheme({ name: 'Bad', esgNewsSearchTerms: 'boom' }), stubTheme({ name: 'Good' })],
      new Set(),
      [],
      KEY,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.mainTheme).toBe('Good');
  });

  it('skips a single article whose scrape fails but keeps the others', async () => {
    installFetch({
      search: () => [
        { url: 'https://esgnews.com/bad/', title: 'Bad Scrape' },
        { url: 'https://esgnews.com/good/', title: 'Good Scrape' },
      ],
      scrape: {
        'https://esgnews.com/bad/': { status: 500 },
        'https://esgnews.com/good/': {
          markdown: 'A complete article body discussing carbon market regulation in depth.',
          publishedTime: daysAgoIso(1),
        },
      },
    });

    const result = await scrapeEsgNews([stubTheme()], new Set(), [], KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://esgnews.com/good/');
  });

  it('skips an article with no parseable publish date (parity with carbon-pulse)', async () => {
    installFetch({
      search: () => [{ url: 'https://esgnews.com/undated/', title: 'Undated' }],
      scrape: {
        'https://esgnews.com/undated/': {
          markdown: 'A perfectly valid long article body with no date metadata.',
          publishedTime: '',
        },
      },
    });
    const result = await scrapeEsgNews([stubTheme()], new Set(), [], KEY);
    expect(result).toHaveLength(0);
  });

  it('scrapes at most MAX_ARTICLES_PER_THEME eligible results', async () => {
    let scrapeCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { url?: string };
        if (url.endsWith('/v2/search')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                web: [
                  { url: 'https://esgnews.com/1/', title: 'One' },
                  { url: 'https://esgnews.com/2/', title: 'Two' },
                  { url: 'https://esgnews.com/3/', title: 'Three' },
                ],
              },
            }),
          };
        }
        scrapeCalls += 1;
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

    const result = await scrapeEsgNews([stubTheme()], new Set(), [], KEY);

    expect(scrapeCalls).toBe(2);
    expect(result).toHaveLength(2);
  });

  it('aborts the theme on a quota error (402) without burning the rest of the loop', async () => {
    installFetch({
      search: (query) =>
        query.includes('quota')
          ? [
              { url: 'https://esgnews.com/q1/', title: 'Q1' },
              { url: 'https://esgnews.com/q2/', title: 'Q2' },
            ]
          : [{ url: 'https://esgnews.com/ok/', title: 'OK' }],
      scrape: {
        'https://esgnews.com/q1/': { status: 402 },
        'https://esgnews.com/q2/': { status: 402 },
        'https://esgnews.com/ok/': {
          markdown: 'A healthy article body about carbon market regulation.',
          publishedTime: daysAgoIso(1),
        },
      },
    });

    const result = await scrapeEsgNews(
      [stubTheme({ name: 'Quota', esgNewsSearchTerms: 'quota' }), stubTheme({ name: 'Fine' })],
      new Set(),
      [],
      KEY,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.mainTheme).toBe('Fine');
  });

  it('fills the per-theme cap from later candidates when early ones are skipped', async () => {
    installFetch({
      search: () => [
        { url: 'https://esgnews.com/undated/', title: 'Undated' },
        { url: 'https://esgnews.com/stale/', title: 'Stale' },
        { url: 'https://esgnews.com/good1/', title: 'Good 1' },
        { url: 'https://esgnews.com/good2/', title: 'Good 2' },
      ],
      scrape: {
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
      },
    });

    const result = await scrapeEsgNews([stubTheme()], new Set(), [], KEY);

    expect(result.map((article) => article.url)).toEqual([
      'https://esgnews.com/good1/',
      'https://esgnews.com/good2/',
    ]);
  });

  it('preserves articles already collected when a later scrape hits a quota error', async () => {
    installFetch({
      search: () => [
        { url: 'https://esgnews.com/collected/', title: 'Collected' },
        { url: 'https://esgnews.com/quota/', title: 'Quota' },
      ],
      scrape: {
        'https://esgnews.com/collected/': {
          markdown: 'A solid article body about methane monitoring.',
          publishedTime: daysAgoIso(1),
        },
        'https://esgnews.com/quota/': { status: 402 },
      },
    });

    const result = await scrapeEsgNews([stubTheme()], new Set(), [], KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://esgnews.com/collected/');
  });

  it('does not re-scrape an article that already matched an earlier theme', async () => {
    let scrapeCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: { body: string }) => {
        if (url.endsWith('/v2/search')) {
          // Every theme search surfaces the SAME article.
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: { web: [{ url: 'https://esgnews.com/shared/', title: 'Shared' }] },
            }),
          };
        }
        scrapeCalls += 1;
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

    const result = await scrapeEsgNews(
      [
        stubTheme({ name: 'Theme A', esgNewsSearchTerms: 'aaa' }),
        stubTheme({ name: 'Theme B', esgNewsSearchTerms: 'bbb' }),
      ],
      new Set(),
      [],
      KEY,
    );

    expect(scrapeCalls).toBe(1);
    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://esgnews.com/shared/');
  });

  it('throws when the Firecrawl API key is not configured', async () => {
    await expect(scrapeEsgNews([stubTheme()], new Set(), [], '')).rejects.toThrow(
      /FIRECRAWL_API_KEY not configured/,
    );
  });
});
