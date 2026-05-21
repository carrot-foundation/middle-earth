import { describe, it, expect, vi, afterEach } from 'vitest';
import { scrapeEsgNews } from '../esg-news.js';

const FEED_URL = 'https://esgnews.com/feed/';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const KEY = 'anthropic-test-key';

function rfc822(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toUTCString();
}

interface FeedItemInput {
  readonly title: string;
  readonly link: string;
  readonly daysAgo?: number;
  readonly pubDate?: string;
  readonly creator?: string;
  readonly description?: string;
  readonly content?: string;
}

function feedXml(items: readonly FeedItemInput[]): string {
  const body = items
    .map((item) => {
      const pubDate = item.pubDate ?? rfc822(item.daysAgo ?? 2);
      return `<item>
  <title><![CDATA[${item.title}]]></title>
  <link>${item.link}</link>
  <pubDate>${pubDate}</pubDate>
  <dc:creator><![CDATA[${item.creator ?? 'ESG News'}]]></dc:creator>
  <description><![CDATA[${item.description ?? 'An excerpt.'}]]></description>
  <content:encoded><![CDATA[${item.content ?? '<p>A full ESG News article body about climate policy and methane.</p>'}]]></content:encoded>
</item>`;
    })
    .join('\n');
  return `<?xml version="1.0"?><rss><channel><title>ESG News</title>${body}</channel></rss>`;
}

/**
 * Route GET (the RSS feed) and POST (the curator's Anthropic call). The curator
 * mock echoes back a pick for every candidate URL in `pickedUrls`; when
 * `pickedUrls` is undefined it picks every candidate it was given.
 */
function installFetch(xml: string, pickedUrls?: readonly string[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: { body?: string }) => {
      if (url === FEED_URL) {
        return { ok: true, status: 200, text: async () => xml };
      }
      if (url === ANTHROPIC_URL) {
        const payload = JSON.parse(init?.body ?? '{}') as { messages: Array<{ content: string }> };
        const userPrompt = payload.messages[0]!.content;
        const candidates = (JSON.parse(userPrompt.slice(0, userPrompt.indexOf('\n\n'))) as {
          candidates: Array<{ url: string }>;
        }).candidates;
        const picks = candidates
          .filter((candidate) => !pickedUrls || pickedUrls.includes(candidate.url))
          .map((candidate) => ({ url: candidate.url, mainTheme: 'Carbon Markets', reason: 'ok' }));
        return {
          ok: true,
          status: 200,
          json: async () => ({ content: [{ type: 'text', text: JSON.stringify({ picks }) }] }),
        };
      }
      throw new Error(`Unexpected fetch URL ${url}`);
    }),
  );
}

describe('scrapeEsgNews', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('fetches the publisher RSS feed for discovery', async () => {
    installFetch(feedXml([{ title: 'A', link: 'https://esgnews.com/a/' }]));
    await scrapeEsgNews(new Set(), [], KEY);
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe(FEED_URL);
  });

  it('returns curated RawArticles tagged with the curator-assigned theme', async () => {
    installFetch(feedXml([{ title: 'Methane Rule Tightens', link: 'https://esgnews.com/methane-rule/' }]));
    const result = await scrapeEsgNews(new Set(), [], KEY);
    expect(result).toHaveLength(1);
    const article = result[0]!;
    expect(article.source).toBe('esgnews');
    expect(article.url).toBe('https://esgnews.com/methane-rule/');
    expect(article.title).toBe('Methane Rule Tightens');
    expect(article.mainTheme).toBe('Carbon Markets');
    expect(article.author).toBe('ESG News');
    expect(article.fullContent).toContain('climate policy and methane');
  });

  it('returns only the articles the curator picked', async () => {
    installFetch(
      feedXml([
        { title: 'Picked', link: 'https://esgnews.com/picked/' },
        { title: 'Dropped', link: 'https://esgnews.com/dropped/' },
      ]),
      ['https://esgnews.com/picked/'],
    );
    const result = await scrapeEsgNews(new Set(), [], KEY);
    expect(result.map((article) => article.url)).toEqual(['https://esgnews.com/picked/']);
  });

  it('skips feed items already in processedUrls', async () => {
    installFetch(feedXml([{ title: 'Seen', link: 'https://esgnews.com/seen/' }]));
    const result = await scrapeEsgNews(new Set(['https://esgnews.com/seen/']), [], KEY);
    expect(result).toHaveLength(0);
  });

  it('skips feed items older than the age limit', async () => {
    installFetch(feedXml([{ title: 'Old', link: 'https://esgnews.com/old/', daysAgo: 120 }]));
    const result = await scrapeEsgNews(new Set(), [], KEY);
    expect(result).toHaveLength(0);
  });

  it('skips feed items with no parseable pubDate', async () => {
    installFetch(feedXml([{ title: 'Undated', link: 'https://esgnews.com/undated/', pubDate: 'not-a-date' }]));
    const result = await scrapeEsgNews(new Set(), [], KEY);
    expect(result).toHaveLength(0);
  });

  it('skips feed items that duplicate a Carbon Pulse title', async () => {
    installFetch(
      feedXml([{ title: 'Global Methane Pledge Reaches Milestone', link: 'https://esgnews.com/dup/' }]),
    );
    const result = await scrapeEsgNews(
      new Set(),
      ['Global Methane Pledge Reaches Major Milestone Today'],
      KEY,
    );
    expect(result).toHaveLength(0);
  });

  it('skips feed items whose body sanitizes to empty (chrome-only)', async () => {
    installFetch(
      feedXml([
        {
          title: 'Chrome Only',
          link: 'https://esgnews.com/chrome/',
          content: '<p>Share on Facebook</p><p>RELATED ARTICLE: Something</p><p>Subscribe &amp; Follow</p>',
        },
      ]),
    );
    const result = await scrapeEsgNews(new Set(), [], KEY);
    expect(result).toHaveLength(0);
  });

  it('strips page chrome from the article body but keeps the prose', async () => {
    installFetch(
      feedXml([
        {
          title: 'Real Article',
          link: 'https://esgnews.com/real/',
          content:
            '<p>New Zealand plans to amend the Climate Change Response Act 2002.</p>' +
            '<p>Share on LinkedIn</p><p>RELATED ARTICLE: Something Else</p>',
        },
      ]),
    );
    const result = await scrapeEsgNews(new Set(), [], KEY);
    expect(result).toHaveLength(1);
    const body = result[0]!.fullContent;
    expect(body).toContain('New Zealand plans to amend the Climate Change Response Act 2002.');
    expect(body).not.toMatch(/Share on LinkedIn/);
    expect(body).not.toMatch(/RELATED ARTICLE:/);
  });

  it('returns an empty list and does not call the curator when no candidates are fresh', async () => {
    installFetch(feedXml([{ title: 'Old', link: 'https://esgnews.com/old/', daysAgo: 120 }]));
    const result = await scrapeEsgNews(new Set(), [], KEY);
    expect(result).toEqual([]);
    const anthropicCalls = vi.mocked(fetch).mock.calls.filter(([url]) => url === ANTHROPIC_URL);
    expect(anthropicCalls).toHaveLength(0);
  });

  it('caps the candidate pool sent to the curator at 30', async () => {
    const items = Array.from({ length: 40 }, (_unused, index) => ({
      title: `Article ${index}`,
      link: `https://esgnews.com/a${index}/`,
    }));
    installFetch(feedXml(items), []);
    await scrapeEsgNews(new Set(), [], KEY);
    const anthropicCall = vi.mocked(fetch).mock.calls.find(([url]) => url === ANTHROPIC_URL)!;
    const body = JSON.parse((anthropicCall[1] as { body: string }).body) as {
      messages: Array<{ content: string }>;
    };
    const userPrompt = body.messages[0]!.content;
    const candidates = (JSON.parse(userPrompt.slice(0, userPrompt.indexOf('\n\n'))) as {
      candidates: unknown[];
    }).candidates;
    expect(candidates).toHaveLength(30);
  });

  it('rejects when the feed fetch returns a non-2xx status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503, text: async () => '' })),
    );
    await expect(scrapeEsgNews(new Set(), [], KEY)).rejects.toThrow(/HTTP 503/);
  });
});
