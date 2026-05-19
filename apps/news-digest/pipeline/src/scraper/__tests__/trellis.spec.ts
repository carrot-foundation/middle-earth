import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ThemeConfig } from '../../types.js';

vi.mock('../../ai/trellis-curator.js', () => ({
  curateTrellisArticles: vi.fn(),
}));

import { curateTrellisArticles } from '../../ai/trellis-curator.js';
import { THEMES } from '../../config.constants.js';
import { scrapeTrellis } from '../trellis.js';

const KEY = 'fc-test-key';
const ANTHROPIC = 'sk-test';

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

type WebResult = { url: string; title: string; description?: string };
type ScrapeEntry =
  | { markdown: string; publishedTime?: string; author?: string }
  | { status: number };

function installFetch(opts: {
  search: (query: string) => WebResult[];
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

const isCuration = (query: string): boolean => query.includes('decarbonization circular economy');

describe('scrapeTrellis', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('extracts a sanitized RawArticle per theme and strips chrome', async () => {
    vi.mocked(curateTrellisArticles).mockResolvedValue([]);
    installFetch({
      search: (q) => (isCuration(q) ? [] : [{ url: 'https://trellis.net/article/a/', title: 'A' }]),
      scrape: {
        'https://trellis.net/article/a/': {
          markdown:
            'Share on Facebook\nSubscribe & Follow\n' +
            'Trellis reports a major circular-economy policy shift this quarter.\n' +
            'RELATED ARTICLE: Something Else',
          author: 'Jane Doe',
          publishedTime: daysAgoIso(3),
        },
      },
    });

    const result = await scrapeTrellis([stubTheme()], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.source).toBe('trellis');
    expect(result[0]!.author).toBe('Jane Doe');
    expect(result[0]!.fullContent).toContain('circular-economy policy shift');
    expect(result[0]!.fullContent).not.toMatch(/Share on Facebook|Subscribe & Follow|RELATED ARTICLE:/);
  });

  it('skips URLs already in processedUrls (no scrape)', async () => {
    vi.mocked(curateTrellisArticles).mockResolvedValue([]);
    installFetch({
      search: (q) => (isCuration(q) ? [] : [{ url: 'https://trellis.net/article/seen/', title: 'Seen' }]),
      scrape: {},
    });
    const result = await scrapeTrellis(
      [stubTheme()],
      new Set(['https://trellis.net/article/seen/']),
      ANTHROPIC,
      KEY,
    );
    expect(result).toHaveLength(0);
  });

  it('skips undated and too-old articles', async () => {
    vi.mocked(curateTrellisArticles).mockResolvedValue([]);
    installFetch({
      search: (q) =>
        isCuration(q)
          ? []
          : [
              { url: 'https://trellis.net/article/undated/', title: 'Undated' },
              { url: 'https://trellis.net/article/old/', title: 'Old' },
            ],
      scrape: {
        'https://trellis.net/article/undated/': { markdown: 'Valid body, no date.', publishedTime: '' },
        'https://trellis.net/article/old/': {
          markdown: 'Valid body, ancient.',
          publishedTime: daysAgoIso(200),
        },
      },
    });
    const result = await scrapeTrellis([stubTheme()], new Set(), ANTHROPIC, KEY);
    expect(result).toHaveLength(0);
  });

  it('skips a page that sanitizes to empty (chrome-only)', async () => {
    vi.mocked(curateTrellisArticles).mockResolvedValue([]);
    installFetch({
      search: (q) => (isCuration(q) ? [] : [{ url: 'https://trellis.net/article/chrome/', title: 'Chrome' }]),
      scrape: {
        'https://trellis.net/article/chrome/': {
          markdown: 'Share on Facebook\nSubscribe & Follow\nRELATED ARTICLE: x',
          publishedTime: daysAgoIso(1),
        },
      },
    });
    const result = await scrapeTrellis([stubTheme()], new Set(), ANTHROPIC, KEY);
    expect(result).toHaveLength(0);
  });

  it('continues other themes when one theme search fails', async () => {
    vi.mocked(curateTrellisArticles).mockResolvedValue([]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { query?: string; url?: string };
        if (url.endsWith('/v2/search')) {
          if ((body.query ?? '').includes('boom')) {
            return { ok: false, status: 500, json: async () => ({}) };
          }
          if (isCuration(body.query ?? '')) {
            return { ok: true, status: 200, json: async () => ({ data: { web: [] } }) };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: { web: [{ url: 'https://trellis.net/article/ok/', title: 'OK' }] } }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              markdown: 'A solid Trellis article body about composting policy.',
              metadata: { 'article:published_time': daysAgoIso(2), author: 'Trellis' },
            },
          }),
        };
      }),
    );

    const result = await scrapeTrellis(
      [stubTheme({ name: 'Bad', trellisSearchTerms: 'boom' }), stubTheme({ name: 'Good' })],
      new Set(),
      ANTHROPIC,
      KEY,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.mainTheme).toBe('Good');
  });

  it('adds curated picks (excerpt from search description, all THEMES passed to curator)', async () => {
    installFetch({
      search: (q) =>
        isCuration(q)
          ? [
              { url: 'https://trellis.net/article/c1/', title: 'Cand 1', description: 'Excerpt one.' },
              { url: 'https://trellis.net/article/c2/', title: 'Cand 2', description: 'Excerpt two.' },
            ]
          : [],
      scrape: {
        'https://trellis.net/article/c1/': {
          markdown: 'Curated article one body about methane abatement.',
          publishedTime: daysAgoIso(1),
        },
      },
    });
    vi.mocked(curateTrellisArticles).mockResolvedValue([
      { url: 'https://trellis.net/article/c1/', mainTheme: 'Methane & Super Pollutants' },
    ]);

    const result = await scrapeTrellis([stubTheme()], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://trellis.net/article/c1/');
    expect(result[0]!.mainTheme).toBe('Methane & Super Pollutants');

    const [candidates, themeNames] = vi.mocked(curateTrellisArticles).mock.calls[0]!;
    expect(candidates[0]).toMatchObject({
      url: 'https://trellis.net/article/c1/',
      title: 'Cand 1',
      excerpt: 'Excerpt one.',
      date: '',
    });
    expect(themeNames).toEqual(THEMES.map((theme) => theme.name));
  });

  it('does not call the curator when the candidate pool is empty', async () => {
    installFetch({
      search: (q) => (isCuration(q) ? [] : [{ url: 'https://trellis.net/article/t/', title: 'T' }]),
      scrape: {
        'https://trellis.net/article/t/': {
          markdown: 'A per-theme Trellis article body about waste policy.',
          publishedTime: daysAgoIso(1),
        },
      },
    });

    const result = await scrapeTrellis([stubTheme()], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(1);
    expect(vi.mocked(curateTrellisArticles)).not.toHaveBeenCalled();
  });

  it('returns only per-theme articles when the curation search fails (resilience)', async () => {
    vi.mocked(curateTrellisArticles).mockResolvedValue([]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { query?: string };
        if (url.endsWith('/v2/search')) {
          if (isCuration(body.query ?? '')) return { ok: false, status: 500, json: async () => ({}) };
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: { web: [{ url: 'https://trellis.net/article/pt/', title: 'PT' }] } }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              markdown: 'Per-theme body about circular economy in depth.',
              metadata: { 'article:published_time': daysAgoIso(1), author: 'Trellis' },
            },
          }),
        };
      }),
    );

    const result = await scrapeTrellis([stubTheme()], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://trellis.net/article/pt/');
    expect(vi.mocked(curateTrellisArticles)).not.toHaveBeenCalled();
  });

  it('keeps partial curated picks when a later pick hits a quota error', async () => {
    installFetch({
      search: (q) =>
        isCuration(q)
          ? [
              { url: 'https://trellis.net/article/good/', title: 'Good', description: 'e' },
              { url: 'https://trellis.net/article/quota/', title: 'Quota', description: 'e' },
            ]
          : [],
      scrape: {
        'https://trellis.net/article/good/': {
          markdown: 'Good curated body about emissions monitoring.',
          publishedTime: daysAgoIso(1),
        },
        'https://trellis.net/article/quota/': { status: 402 },
      },
    });
    vi.mocked(curateTrellisArticles).mockResolvedValue([
      { url: 'https://trellis.net/article/good/', mainTheme: 'Carbon Markets' },
      { url: 'https://trellis.net/article/quota/', mainTheme: 'Carbon Markets' },
    ]);

    const result = await scrapeTrellis([stubTheme()], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://trellis.net/article/good/');
  });

  it('skips the curation flow entirely when a per-theme quota error occurs', async () => {
    installFetch({
      search: (q) =>
        isCuration(q)
          ? [{ url: 'https://trellis.net/article/curated/', title: 'Curated' }]
          : [{ url: 'https://trellis.net/article/q/', title: 'Q' }],
      scrape: {
        'https://trellis.net/article/q/': { status: 402 },
        'https://trellis.net/article/curated/': {
          markdown: 'Should never be scraped because quota aborted first.',
          publishedTime: daysAgoIso(1),
        },
      },
    });

    const result = await scrapeTrellis([stubTheme()], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(0);
    expect(vi.mocked(curateTrellisArticles)).not.toHaveBeenCalled();
  });

  it('rejects off-domain and non-article URLs from search results', async () => {
    vi.mocked(curateTrellisArticles).mockResolvedValue([]);
    installFetch({
      search: (q) =>
        isCuration(q)
          ? []
          : [
              { url: 'https://evil.com/article/x/', title: 'Off domain' },
              { url: 'https://trellis.net/about/', title: 'Not an article' },
              { url: 'https://trellis.net/article/ok/', title: 'Valid' },
            ],
      scrape: {
        'https://trellis.net/article/ok/': {
          markdown: 'A valid Trellis article body about emissions policy.',
          publishedTime: daysAgoIso(1),
        },
      },
    });

    const result = await scrapeTrellis([stubTheme()], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://trellis.net/article/ok/');
  });

  it('deduplicates repeated curator picks (scrapes a URL once)', async () => {
    installFetch({
      search: (q) =>
        isCuration(q)
          ? [{ url: 'https://trellis.net/article/dup/', title: 'Dup', description: 'e' }]
          : [],
      scrape: {
        'https://trellis.net/article/dup/': {
          markdown: 'A curated article body about circular economy finance.',
          publishedTime: daysAgoIso(1),
        },
      },
    });
    vi.mocked(curateTrellisArticles).mockResolvedValue([
      { url: 'https://trellis.net/article/dup/', mainTheme: 'Carbon Markets' },
      { url: 'https://trellis.net/article/dup/', mainTheme: 'Carbon Markets' },
    ]);

    const result = await scrapeTrellis([stubTheme()], new Set(), ANTHROPIC, KEY);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://trellis.net/article/dup/');
  });

  it('throws when the Firecrawl API key is not configured', async () => {
    await expect(scrapeTrellis([stubTheme()], new Set(), ANTHROPIC, '')).rejects.toThrow(
      /FIRECRAWL_API_KEY not configured/,
    );
  });
});
