import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrapeSubstack, stripHtml } from '../substack.js';
import type { SubstackPublication } from '../../types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const VALID_XML = readFileSync(join(FIXTURES, 'substack-feed-valid.xml'), 'utf-8');

const PUBLICATION: SubstackPublication = {
  name: 'Sample Substack',
  source: 'a16z-crypto',
  feedUrl: 'https://sample.substack.com/feed',
};

function mockFetchOk(body: string): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => body,
  } as Response));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-29T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('stripHtml', () => {
  it('strips tags and decodes common entities', () => {
    const html = '<p>Hello &amp; <strong>world</strong>.</p><p>Second.</p>';
    expect(stripHtml(html)).toBe('Hello & world.\n\nSecond.');
  });

  it('preserves paragraph breaks via double newline', () => {
    expect(stripHtml('<p>A</p><p>B</p>')).toBe('A\n\nB');
  });

  it('returns empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });

  it('decodes decimal numeric HTML entities', () => {
    expect(stripHtml('Smart quotes &#8220;hello&#8221; and apostrophe&#8217;s')).toBe('Smart quotes “hello” and apostrophe’s');
  });

  it('decodes hex numeric HTML entities', () => {
    expect(stripHtml('Em dash &#x2014; here')).toBe('Em dash — here');
  });

  it('preserves out-of-range numeric entities verbatim instead of throwing', () => {
    expect(stripHtml('Decimal overflow &#9999999999; survives')).toBe('Decimal overflow &#9999999999; survives');
    expect(stripHtml('Hex overflow &#x110000; survives')).toBe('Hex overflow &#x110000; survives');
  });
});

describe('scrapeSubstack — happy path', () => {
  it('returns RawArticle[] for new items in the feed', async () => {
    mockFetchOk(VALID_XML);

    const articles = await scrapeSubstack([PUBLICATION], new Set());

    expect(articles).toHaveLength(3);
    expect(articles[0]).toMatchObject({
      source: 'a16z-crypto',
      url: 'https://sample.substack.com/p/first-post',
      title: 'First post',
      date: '2026-04-25',
      author: 'Sample Substack',
      mainTheme: 'Industry Intelligence',
      categories: '',
      location: '',
    });
    expect(articles[0]!.fullContent).toContain('Hello world');
    expect(articles[0]!.fullContent).toContain('Second paragraph with link');
  });
});

describe('scrapeSubstack — dedup', () => {
  it('skips items whose link is already in processedUrls', async () => {
    mockFetchOk(VALID_XML);
    const seen = new Set(['https://sample.substack.com/p/second-post']);

    const articles = await scrapeSubstack([PUBLICATION], seen);

    expect(articles).toHaveLength(2);
    expect(articles.map((a) => a.url)).not.toContain('https://sample.substack.com/p/second-post');
  });
});

describe('scrapeSubstack — content fallback', () => {
  it('uses description when content:encoded is missing', async () => {
    mockFetchOk(VALID_XML);

    const articles = await scrapeSubstack([PUBLICATION], new Set());

    const third = articles.find((a) => a.url.endsWith('/third-post'))!;
    expect(third.fullContent).toBe('Only description, no encoded content here.');
  });

  it('skips item with neither content:encoded nor description', async () => {
    const xml = `<?xml version="1.0"?>
<rss xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
  <channel>
    <item>
      <title>Empty</title>
      <link>https://sample.substack.com/p/empty</link>
      <pubDate>Sat, 25 Apr 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;
    mockFetchOk(xml);

    const articles = await scrapeSubstack([PUBLICATION], new Set());

    expect(articles).toHaveLength(0);
  });
});

describe('scrapeSubstack — pubDate handling', () => {
  it('falls back to current timestamp when pubDate is missing', async () => {
    const xml = `<?xml version="1.0"?>
<rss xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
  <channel>
    <item>
      <title>No date</title>
      <link>https://sample.substack.com/p/no-date</link>
      <content:encoded><![CDATA[<p>Body.</p>]]></content:encoded>
    </item>
  </channel>
</rss>`;
    mockFetchOk(xml);

    const articles = await scrapeSubstack([PUBLICATION], new Set());

    expect(articles).toHaveLength(1);
    expect(articles[0]!.date).toBe('2026-04-29');
  });

  it('skips items older than 90-day retention cutoff', async () => {
    const xml = `<?xml version="1.0"?>
<rss xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
  <channel>
    <item>
      <title>Old</title>
      <link>https://sample.substack.com/p/old</link>
      <pubDate>Mon, 01 Jan 2025 10:00:00 GMT</pubDate>
      <content:encoded><![CDATA[<p>Body.</p>]]></content:encoded>
    </item>
    <item>
      <title>Fresh</title>
      <link>https://sample.substack.com/p/fresh</link>
      <pubDate>Sat, 25 Apr 2026 10:00:00 GMT</pubDate>
      <content:encoded><![CDATA[<p>Body.</p>]]></content:encoded>
    </item>
  </channel>
</rss>`;
    mockFetchOk(xml);

    const articles = await scrapeSubstack([PUBLICATION], new Set());

    expect(articles).toHaveLength(1);
    expect(articles[0]!.url).toBe('https://sample.substack.com/p/fresh');
  });
});

describe('scrapeSubstack — multiple publications', () => {
  const PUB_A: SubstackPublication = {
    name: 'Pub A',
    source: 'a16z-crypto',
    feedUrl: 'https://a.substack.com/feed',
  };
  const PUB_B: SubstackPublication = {
    name: 'Pub B',
    source: 'a16z-crypto',
    feedUrl: 'https://b.substack.com/feed',
  };

  it('concatenates results across publications', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url === PUB_A.feedUrl) {
        return Promise.resolve({ ok: true, status: 200, text: async () => VALID_XML } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, text: async () => VALID_XML } as Response);
    }));

    const articles = await scrapeSubstack([PUB_A, PUB_B], new Set());

    expect(articles).toHaveLength(6);
  });

  it('isolates failure: one publication fails, the other succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url === PUB_A.feedUrl) {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve({ ok: true, status: 200, text: async () => VALID_XML } as Response);
    }));

    const articles = await scrapeSubstack([PUB_A, PUB_B], new Set());

    expect(articles).toHaveLength(3);
    expect(articles.every((a) => a.url.startsWith('https://sample.substack.com'))).toBe(true);
  });

  it('isolates failure: one publication has malformed XML, the other succeeds', async () => {
    const malformed = readFileSync(join(FIXTURES, 'substack-feed-malformed.xml'), 'utf-8');
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url === PUB_A.feedUrl) {
        return Promise.resolve({ ok: true, status: 200, text: async () => malformed } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, text: async () => VALID_XML } as Response);
    }));

    const articles = await scrapeSubstack([PUB_A, PUB_B], new Set());

    expect(articles).toHaveLength(3);
  });

  it('returns [] when feed has no items', async () => {
    const empty = `<?xml version="1.0"?>
<rss xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
  <channel><title>Empty</title></channel>
</rss>`;
    mockFetchOk(empty);

    const articles = await scrapeSubstack([PUBLICATION], new Set());

    expect(articles).toHaveLength(0);
  });
});
