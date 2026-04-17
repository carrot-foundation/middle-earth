import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { curateTrellisArticles, type TrellisCandidate } from '../trellis-curator.js';

const THEME_NAMES = ['Methane & Super Pollutants', 'Circularity & Composting', 'Carbon Markets'];

function stubCandidate(overrides: Partial<TrellisCandidate> = {}): TrellisCandidate {
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

describe('curateTrellisArticles', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns empty array without calling the API when candidates are empty', async () => {
    const result = await curateTrellisArticles([], THEME_NAMES, 'test-key');
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
    const result = await curateTrellisArticles(candidates, THEME_NAMES, 'test-key');
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
    const result = await curateTrellisArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([{ url: 'https://trellis.net/article/a/', mainTheme: 'Carbon Markets' }]);
  });

  it('filters out picks whose mainTheme is not in themeNames', async () => {
    const candidates = [stubCandidate({ url: 'https://trellis.net/article/a/' })];
    vi.mocked(fetch).mockResolvedValueOnce(
      anthropicResponse([
        { url: 'https://trellis.net/article/a/', mainTheme: 'Bogus Theme', reason: 'x' },
      ]),
    );
    const result = await curateTrellisArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([]);
  });

  it('caps picks at MAX_PICKS (2)', async () => {
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
    const result = await curateTrellisArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toHaveLength(2);
  });

  it('returns empty array when Claude returns non-JSON text', async () => {
    const candidates = [stubCandidate()];
    vi.mocked(fetch).mockResolvedValueOnce(anthropicText('not json at all'));
    const result = await curateTrellisArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([]);
  });

  it('returns empty array when Claude returns JSON missing the picks field', async () => {
    const candidates = [stubCandidate()];
    vi.mocked(fetch).mockResolvedValueOnce(anthropicText(JSON.stringify({ other: 'field' })));
    const result = await curateTrellisArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([]);
  });

  it('returns empty array when fetch rejects', async () => {
    const candidates = [stubCandidate()];
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'));
    const result = await curateTrellisArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([]);
  });

  it('returns empty array when fetch returns non-2xx status', async () => {
    const candidates = [stubCandidate()];
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('error', { status: 500 }),
    );
    const result = await curateTrellisArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([]);
  });

  it('returns empty array when fetch is aborted (timeout)', async () => {
    const candidates = [stubCandidate()];
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    vi.mocked(fetch).mockRejectedValueOnce(abortError);
    const result = await curateTrellisArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([]);
  });

  it('passes an AbortSignal to fetch so the request can be timed out', async () => {
    const candidates = [stubCandidate({ url: 'https://trellis.net/article/a/' })];
    vi.mocked(fetch).mockResolvedValueOnce(
      anthropicResponse([
        { url: 'https://trellis.net/article/a/', mainTheme: 'Carbon Markets', reason: 'ok' },
      ]),
    );
    await curateTrellisArticles(candidates, THEME_NAMES, 'test-key');
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('tolerates markdown fences around JSON in Claude output', async () => {
    const candidates = [stubCandidate({ url: 'https://trellis.net/article/a/' })];
    vi.mocked(fetch).mockResolvedValueOnce(
      anthropicText('```json\n{"picks":[{"url":"https://trellis.net/article/a/","mainTheme":"Carbon Markets","reason":"ok"}]}\n```'),
    );
    const result = await curateTrellisArticles(candidates, THEME_NAMES, 'test-key');
    expect(result).toEqual([{ url: 'https://trellis.net/article/a/', mainTheme: 'Carbon Markets' }]);
  });
});
