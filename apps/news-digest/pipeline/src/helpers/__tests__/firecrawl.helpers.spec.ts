import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  FirecrawlError,
  extractMarkdownLinks,
  firecrawlScrape,
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

  it('POSTs to the v2 scrape endpoint with bearer auth and a JSON body', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { markdown: '', metadata: {} } }),
    }));
    vi.stubGlobal('fetch', fetchSpy);

    await firecrawlScrape('https://esgnews.com/a/', 'fc-key');

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('https://api.firecrawl.dev/v2/scrape');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer fc-key');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body['url']).toBe('https://esgnews.com/a/');
    expect(body['formats']).toEqual(['markdown']);
    expect(body['onlyMainContent']).toBe(true);
  });

  it('throws FirecrawlError without an API key (no network call)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(firecrawlScrape('https://esgnews.com/a/', '')).rejects.toBeInstanceOf(
      FirecrawlError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws FirecrawlError with the status on a non-2xx response', async () => {
    mockFetch({ ok: false, status: 429 });
    await expect(firecrawlScrape('https://esgnews.com/a/', 'fc-key')).rejects.toMatchObject({
      name: 'FirecrawlError',
      status: 429,
    });
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

describe('extractMarkdownLinks', () => {
  const acceptAll = (): boolean => true;

  it('extracts inline links in source order', () => {
    const md = 'See [One](https://a.example/x) and [Two](https://b.example/y) and [Three](https://c.example/z).';
    expect(extractMarkdownLinks(md, acceptAll)).toEqual([
      { url: 'https://a.example/x', title: 'One' },
      { url: 'https://b.example/y', title: 'Two' },
      { url: 'https://c.example/z', title: 'Three' },
    ]);
  });

  it('returns an empty array for empty or matchless input', () => {
    expect(extractMarkdownLinks('', acceptAll)).toEqual([]);
    expect(extractMarkdownLinks('no markdown here', acceptAll)).toEqual([]);
  });

  it('trims surrounding whitespace from the title', () => {
    expect(extractMarkdownLinks('[  Spaces  ](https://a/x)', acceptAll)).toEqual([
      { url: 'https://a/x', title: 'Spaces' },
    ]);
  });

  it('drops links with empty title or empty url', () => {
    const md = '[Good](https://a/x) [](https://b/y) [No URL]()';
    expect(extractMarkdownLinks(md, acceptAll)).toEqual([
      { url: 'https://a/x', title: 'Good' },
    ]);
  });

  it('deduplicates by url preserving first occurrence', () => {
    const md = '[First](https://a/x) [Second](https://a/x) [Third](https://b/y)';
    expect(extractMarkdownLinks(md, acceptAll)).toEqual([
      { url: 'https://a/x', title: 'First' },
      { url: 'https://b/y', title: 'Third' },
    ]);
  });

  it('supports inline links with a "title" attribute', () => {
    expect(
      extractMarkdownLinks('[Doc](https://a/x "Tooltip")', acceptAll),
    ).toEqual([{ url: 'https://a/x', title: 'Doc' }]);
  });

  it('filters out entries the predicate rejects', () => {
    const md = '[Keep](https://a/keep) [Drop](https://a/drop)';
    const onlyKeep = ({ url }: { url: string }): boolean => url.endsWith('/keep');
    expect(extractMarkdownLinks(md, onlyKeep)).toEqual([
      { url: 'https://a/keep', title: 'Keep' },
    ]);
  });

  it('predicate sees title alongside url (for content-aware filters)', () => {
    const md = '[Climate change rule](https://a/1) [Sponsored: buy now](https://a/2)';
    const noAds = ({ title }: { title: string }): boolean => !title.startsWith('Sponsored');
    expect(extractMarkdownLinks(md, noAds)).toEqual([
      { url: 'https://a/1', title: 'Climate change rule' },
    ]);
  });

  it('ignores reference-style links and bare urls', () => {
    const md = '[Ref][1]\n\n[1]: https://a/x\n\nhttps://a/y bare';
    expect(extractMarkdownLinks(md, acceptAll)).toEqual([]);
  });

  it('rejects markdown image syntax (![alt](url)) to avoid scraping thumbnails', () => {
    // Listing cards often include both a hero image and a text link to the
    // same article; without this guard the helper would emit the JPG URL
    // first and we'd waste a Firecrawl scrape on it before the cap caught up.
    const md = '![Hero](https://a/cover.jpg) and [Real article](https://a/article-slug/)';
    expect(extractMarkdownLinks(md, acceptAll)).toEqual([
      { url: 'https://a/article-slug/', title: 'Real article' },
    ]);
  });
});

describe('FirecrawlError', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('preserves the underlying error as `cause` so outage detection has the original class', async () => {
    const original = new Error('socket hang up');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw original;
      }),
    );

    let caught: unknown;
    try {
      await firecrawlScrape('https://esgnews.com/a/', 'fc-key');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(FirecrawlError);
    expect((caught as FirecrawlError).cause).toBe(original);
    expect((caught as FirecrawlError).status).toBeUndefined();
  });
});
