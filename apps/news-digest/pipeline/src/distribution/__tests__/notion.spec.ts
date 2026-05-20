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

  it('falls back to Industry Intelligence when the theme is not in NOTION_VALID_THEMES', async () => {
    // Regression: 2026-05-20 pages shipped with empty Main Theme because the
    // Trellis curator chose "Verification & Auditing" — a valid THEMES name
    // but not in NOTION_VALID_THEMES. The catch-all "Industry Intelligence"
    // is in NOTION_VALID_THEMES specifically as the fallback target.
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'page-456' }) });
    await createNotionPage(stubProcessedArticle({ mainTheme: 'Verification & Auditing' }), 'db-id', 'token');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.properties['Main Theme']).toEqual({
      multi_select: [{ name: 'Industry Intelligence' }],
    });
  });

  it('keeps a valid mainTheme on the page (no fallback applied)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'page-457' }) });
    await createNotionPage(stubProcessedArticle({ mainTheme: 'Carbon Markets' }), 'db-id', 'token');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.properties['Main Theme']).toEqual({
      multi_select: [{ name: 'Carbon Markets' }],
    });
  });

  it('stores the source article URL in the "Source URL" property', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'page-u' }) });
    await createNotionPage(
      stubProcessedArticle({ url: 'https://esgnews.com/some-article/' }),
      'db-id',
      'token',
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.properties['Source URL']).toEqual({ url: 'https://esgnews.com/some-article/' });
  });

  it('returns failure on API error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: () => Promise.resolve('Bad Request') });
    const result = await createNotionPage(stubProcessedArticle(), 'db-id', 'token');
    expect(result.success).toBe(false);
  });

  it('sanitizes scraped chrome out of the page body (regression: 2026-05-18 broken articles)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'page-x' }) });
    const dirty =
      'Share on Facebook\nShare on LinkedIn\n' +
      '<img loading="lazy" src="https://esgnews.com/x.webp" srcset="https://esgnews.com/x.webp 780w" />\n' +
      'New Zealand plans to amend the Climate Change Response Act 2002.\n' +
      'Subscribe & Follow for Daily ESG Insights\n' +
      'ESG News Editorial Team The ESG News Editorial Team is comprised of veteran journalists.';
    await createNotionPage(stubProcessedArticle({ fullContent: dirty }), 'db-id', 'token');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    const rendered = JSON.stringify(body.children);
    expect(rendered).not.toContain('<img');
    expect(rendered).not.toContain('srcset');
    expect(rendered).not.toContain('Share on Facebook');
    expect(rendered).not.toContain('Subscribe & Follow');
    expect(rendered).not.toContain('Editorial Team is comprised of');
    expect(rendered).toContain('New Zealand plans to amend the Climate Change Response Act 2002.');
  });
});
