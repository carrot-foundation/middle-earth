import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  FirecrawlError,
  firecrawlScrape,
  firecrawlSearch,
} from '../firecrawl.helpers.js';

function mockFetch(response: { ok: boolean; status?: number; body?: unknown }): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      json: async () => response.body ?? {},
    })),
  );
}

describe('firecrawlSearch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps data.web entries to {url,title,description} and drops incomplete ones', async () => {
    mockFetch({
      ok: true,
      body: {
        data: {
          web: [
            { url: 'https://esgnews.com/a/', title: ' Article A ', description: ' Lead text ' },
            { url: 'https://esgnews.com/b/' }, // missing title -> dropped
            { title: 'No URL' }, // missing url -> dropped
          ],
        },
      },
    });

    const results = await firecrawlSearch('methane', 'fc-key');

    expect(results).toEqual([
      { url: 'https://esgnews.com/a/', title: 'Article A', description: 'Lead text' },
    ]);
  });

  it('POSTs to the v2 search endpoint with bearer auth and a JSON body', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { web: [] } }),
    }));
    vi.stubGlobal('fetch', fetchSpy);

    await firecrawlSearch('methane', 'fc-key', 5);

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('https://api.firecrawl.dev/v2/search');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer fc-key');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({
      query: 'methane',
      limit: 5,
      sources: [{ type: 'web' }],
    });
  });

  it('throws FirecrawlError without an API key (no network call)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(firecrawlSearch('methane', '')).rejects.toBeInstanceOf(FirecrawlError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws FirecrawlError with the status on a non-2xx response', async () => {
    mockFetch({ ok: false, status: 429 });
    await expect(firecrawlSearch('methane', 'fc-key')).rejects.toMatchObject({
      name: 'FirecrawlError',
      status: 429,
    });
  });
});

describe('firecrawlScrape', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns markdown plus published time and author from metadata', async () => {
    mockFetch({
      ok: true,
      body: {
        data: {
          markdown: '# Title\n\nBody text.',
          metadata: {
            'article:published_time': '2026-05-10T08:00:00Z',
            author: 'Jane Doe',
          },
        },
      },
    });

    const result = await firecrawlScrape('https://esgnews.com/a/', 'fc-key');

    expect(result).toEqual({
      markdown: '# Title\n\nBody text.',
      publishedTime: '2026-05-10T08:00:00Z',
      author: 'Jane Doe',
    });
  });

  it('coerces array-valued metadata and falls back to article:author', async () => {
    mockFetch({
      ok: true,
      body: {
        data: {
          markdown: 'Body.',
          metadata: {
            'article:published_time': ['2026-05-10T08:00:00Z'],
            'article:author': 'Fallback Author',
          },
        },
      },
    });

    const result = await firecrawlScrape('https://esgnews.com/a/', 'fc-key');

    expect(result.publishedTime).toBe('2026-05-10T08:00:00Z');
    expect(result.author).toBe('Fallback Author');
  });

  it('throws FirecrawlError on a non-2xx response', async () => {
    mockFetch({ ok: false, status: 500 });
    await expect(firecrawlScrape('https://esgnews.com/a/', 'fc-key')).rejects.toBeInstanceOf(
      FirecrawlError,
    );
  });

  it('wraps a non-JSON 200 body in a FirecrawlError (not a raw SyntaxError)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      })),
    );
    await expect(firecrawlScrape('https://esgnews.com/a/', 'fc-key')).rejects.toMatchObject({
      name: 'FirecrawlError',
      status: 200,
    });
  });

  it('wraps a fetch network error in a FirecrawlError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('socket hang up');
      }),
    );
    await expect(firecrawlScrape('https://esgnews.com/a/', 'fc-key')).rejects.toBeInstanceOf(
      FirecrawlError,
    );
  });
});
