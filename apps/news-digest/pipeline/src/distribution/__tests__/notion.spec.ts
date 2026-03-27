import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotionPage } from '../notion.js';
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

describe('createNotionPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a page and returns the page ID', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'page-123' }) });
    const result = await createNotionPage(stubProcessedArticle(), 'db-id', 'token');
    expect(result).toEqual({ success: true, pageId: 'page-123' });
  });

  it('omits Main Theme when theme is not in valid options', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'page-456' }) });
    await createNotionPage(stubProcessedArticle({ mainTheme: 'Verification & Auditing' }), 'db-id', 'token');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.properties['Main Theme']).toBeUndefined();
  });

  it('returns failure on API error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: () => Promise.resolve('Bad Request') });
    const result = await createNotionPage(stubProcessedArticle(), 'db-id', 'token');
    expect(result.success).toBe(false);
  });
});
