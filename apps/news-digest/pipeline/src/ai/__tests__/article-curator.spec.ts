import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { curateArticles, type ArticleCandidate } from '../article-curator.js';

const THEME_NAMES = ['Methane & Super Pollutants', 'Circularity & Composting', 'Carbon Markets'];

function stubCandidate(overrides: Partial<ArticleCandidate> = {}): ArticleCandidate {
  return {
    url: 'https://trellis.net/article/default/',
    title: 'Default Title',
    date: '2026-04-10',
    excerpt: 'Default excerpt content for testing.',
    ...overrides,
  };
}

function anthropicResponse(picks: Array<{ url: string; mainTheme: string; reason: string }>): Response {
  const body = JSON.stringify({
    content: [{ type: 'text', text: JSON.stringify({ picks }) }],
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
}

function anthropicText(rawText: string): Response {
  const body = JSON.stringify({
    content: [{ type: 'text', text: rawText }],
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('curateArticles', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns empty array without calling the API when candidates are empty', async () => {
    const result = await curateArticles([], THEME_NAMES, 'test-key');
    expect(result).toEqual([]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('returns valid picks when Claude returns well-formed JSON', async () => {
    const candidates = [
      stubCandidate({ url: 'https://trellis.net/article/a/', title: 'A' }),
      stubCandidate({ url: 'https://trellis.net/article/b/', title: 'B' }),
    ];
    vi.mocked(fetch).mockResolvedValueOnce(
      anthropicResponse([
        { url: 'https://trellis.net/article/a/', mainTheme: 'Carbon Markets', reason: 'ok' },
        { url: 'https://trellis.net/article/b/', mainTheme: 'Methane & Super Pollutants', reason: 'ok' },
      ]),
    );
    const result = await curateArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([
      { url: 'https://trellis.net/article/a/', mainTheme: 'Carbon Markets' },
      { url: 'https://trellis.net/article/b/', mainTheme: 'Methane & Super Pollutants' },
    ]);
  });

  it('filters out picks whose URL is not in the candidate pool', async () => {
    const candidates = [stubCandidate({ url: 'https://trellis.net/article/a/' })];
    vi.mocked(fetch).mockResolvedValueOnce(
      anthropicResponse([
        { url: 'https://trellis.net/article/a/', mainTheme: 'Carbon Markets', reason: 'ok' },
        { url: 'https://evil.example/', mainTheme: 'Carbon Markets', reason: 'bad' },
      ]),
    );
    const result = await curateArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([{ url: 'https://trellis.net/article/a/', mainTheme: 'Carbon Markets' }]);
  });

  it('filters out picks whose mainTheme is not in themeNames', async () => {
    const candidates = [stubCandidate({ url: 'https://trellis.net/article/a/' })];
    vi.mocked(fetch).mockResolvedValueOnce(
      anthropicResponse([
        { url: 'https://trellis.net/article/a/', mainTheme: 'Bogus Theme', reason: 'x' },
      ]),
    );
    const result = await curateArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([]);
  });

  it('caps picks at the default maxPicks (2)', async () => {
    const candidates = [
      stubCandidate({ url: 'https://trellis.net/article/a/' }),
      stubCandidate({ url: 'https://trellis.net/article/b/' }),
      stubCandidate({ url: 'https://trellis.net/article/c/' }),
    ];
    vi.mocked(fetch).mockResolvedValueOnce(
      anthropicResponse([
        { url: 'https://trellis.net/article/a/', mainTheme: 'Carbon Markets', reason: '1' },
        { url: 'https://trellis.net/article/b/', mainTheme: 'Carbon Markets', reason: '2' },
        { url: 'https://trellis.net/article/c/', mainTheme: 'Carbon Markets', reason: '3' },
      ]),
    );
    const result = await curateArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toHaveLength(2);
  });

  it('honors an explicit maxPicks option', async () => {
    const candidates = ['a', 'b', 'c', 'd', 'e'].map((slug) =>
      stubCandidate({ url: `https://esgnews.com/${slug}/` }),
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      anthropicResponse(
        candidates.map((candidate) => ({
          url: candidate.url, mainTheme: 'Carbon Markets', reason: 'ok',
        })),
      ),
    );
    const result = await curateArticles(candidates, THEME_NAMES, 'test-key', { maxPicks: 3 });
    expect(result).toHaveLength(3);
  });

  it('drops a pick whose URL is repeated so the same article is not curated twice', async () => {
    const candidates = [stubCandidate({ url: 'https://esgnews.com/a/' })];
    vi.mocked(fetch).mockResolvedValueOnce(
      anthropicResponse([
        { url: 'https://esgnews.com/a/', mainTheme: 'Carbon Markets', reason: 'first' },
        { url: 'https://esgnews.com/a/', mainTheme: 'Methane & Super Pollutants', reason: 'dup' },
      ]),
    );
    const result = await curateArticles(candidates, THEME_NAMES, 'test-key', { maxPicks: 3 });
    expect(result).toEqual([{ url: 'https://esgnews.com/a/', mainTheme: 'Carbon Markets' }]);
  });

  it('uses the label option in log output', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const candidates = [stubCandidate({ url: 'https://esgnews.com/a/' })];
    vi.mocked(fetch).mockResolvedValueOnce(anthropicResponse([]));
    await curateArticles(candidates, THEME_NAMES, 'test-key', { label: 'ESG News Curator' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[ESG News Curator]'));
  });

  it('returns empty array when Claude returns non-JSON text', async () => {
    const candidates = [stubCandidate()];
    vi.mocked(fetch).mockResolvedValueOnce(anthropicText('not json at all'));
    const result = await curateArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([]);
  });

  it('returns empty array when Claude returns JSON missing the picks field', async () => {
    const candidates = [stubCandidate()];
    vi.mocked(fetch).mockResolvedValueOnce(anthropicText(JSON.stringify({ other: 'field' })));
    const result = await curateArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([]);
  });

  it('returns empty array when fetch rejects', async () => {
    const candidates = [stubCandidate()];
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'));
    const result = await curateArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([]);
  });

  it('returns empty array when fetch returns non-2xx status', async () => {
    const candidates = [stubCandidate()];
    vi.mocked(fetch).mockResolvedValueOnce(new Response('error', { status: 500 }));
    const result = await curateArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([]);
  });

  it('returns empty array when fetch is aborted (timeout)', async () => {
    const candidates = [stubCandidate()];
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    vi.mocked(fetch).mockRejectedValueOnce(abortError);
    const result = await curateArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([]);
  });

  it('passes an AbortSignal to fetch so the request can be timed out', async () => {
    const candidates = [stubCandidate({ url: 'https://trellis.net/article/a/' })];
    vi.mocked(fetch).mockResolvedValueOnce(
      anthropicResponse([
        { url: 'https://trellis.net/article/a/', mainTheme: 'Carbon Markets', reason: 'ok' },
      ]),
    );
    await curateArticles(candidates, THEME_NAMES, 'test-key');
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('tolerates markdown fences around JSON in Claude output', async () => {
    const candidates = [stubCandidate({ url: 'https://trellis.net/article/a/' })];
    vi.mocked(fetch).mockResolvedValueOnce(
      anthropicText('```json\n{"picks":[{"url":"https://trellis.net/article/a/","mainTheme":"Carbon Markets","reason":"ok"}]}\n```'),
    );
    const result = await curateArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([{ url: 'https://trellis.net/article/a/', mainTheme: 'Carbon Markets' }]);
  });
});
