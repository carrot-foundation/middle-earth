import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postSlackDigest, buildSlackBlocks } from '../slack.js';
import type { ProcessedArticle } from '../../types.js';

function stubProcessedArticle(overrides: Partial<ProcessedArticle> = {}): ProcessedArticle {
  return {
    source: 'carbon-pulse', url: 'https://carbon-pulse.com/123/', title: 'Test Article',
    date: '2026-03-27', author: 'Test Author', mainTheme: 'Carbon Markets', categories: '',
    location: '', summary: 'A test summary.', keyPoints: ['Point 1'], segment: 'Policy & Regulation',
    fullContent: 'Content.', markdownFile: 'test.md', notionPageId: null,
    processedAt: '2026-03-27T10:00:00Z', status: 'markdown-only', ...overrides,
  };
}

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('buildSlackBlocks', () => {
  it('includes header with date and article count', () => {
    const blocks = buildSlackBlocks([stubProcessedArticle()], '2026-03-27');
    expect(blocks[0]).toEqual({ type: 'header', text: { type: 'plain_text', text: 'Industry News Digest - 2026-03-27', emoji: true } });
  });

  it('includes a section block per article', () => {
    const articles = [stubProcessedArticle(), stubProcessedArticle({ title: 'Second' })];
    const blocks = buildSlackBlocks(articles, '2026-03-27');
    const sections = blocks.filter((b) => b.type === 'section');
    expect(sections.length).toBe(2);
  });
});

describe('postSlackDigest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts to Slack API and returns success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true, ts: '123.456' }) });
    const result = await postSlackDigest([stubProcessedArticle()], 'token', 'C123', '2026-03-27');
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('https://slack.com/api/chat.postMessage', expect.objectContaining({ method: 'POST' }));
  });

  it('returns failure when API returns error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: false, error: 'channel_not_found' }) });
    const result = await postSlackDigest([stubProcessedArticle()], 'token', 'C123', '2026-03-27');
    expect(result.success).toBe(false);
  });
});
