import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processArticle, buildPrompt } from '../article-processor.js';
import type { RawArticle } from '../../types.js';

function stubRawArticle(overrides: Partial<RawArticle> = {}): RawArticle {
  return {
    source: 'carbon-pulse',
    url: 'https://carbon-pulse.com/123/',
    title: 'EU carbon prices surge amid policy changes',
    date: '2026-03-27',
    author: 'Test Author',
    mainTheme: 'Carbon Markets',
    categories: 'EU, ETS',
    location: 'Europe',
    fullContent: 'EU carbon prices rose 15% this week following new regulations...',
    ...overrides,
  };
}

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('buildPrompt', () => {
  it('includes article content and expected output format', () => {
    const prompt = buildPrompt(stubRawArticle());
    expect(prompt).toContain('EU carbon prices surge');
    expect(prompt).toContain('summary');
    expect(prompt).toContain('keyPoints');
    expect(prompt).toContain('segment');
  });

  it('feeds Claude sanitized content so chrome cannot skew summary/segment (regression: 2026-05-18)', () => {
    const prompt = buildPrompt(
      stubRawArticle({
        fullContent:
          'Share on Facebook\n' +
          '<img loading="lazy" src="https://esgnews.com/x.webp" srcset="x 780w" />\n' +
          'Indonesia plans to rehabilitate 12 million hectares of degraded land.',
      }),
    );
    expect(prompt).not.toContain('<img');
    expect(prompt).not.toContain('srcset');
    expect(prompt).not.toContain('Share on Facebook');
    expect(prompt).toContain('Indonesia plans to rehabilitate 12 million hectares of degraded land.');
  });
});

describe('processArticle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns processed article from Claude API response', async () => {
    const claudeResponse = {
      content: [{
        type: 'text',
        text: JSON.stringify({
          summary: 'EU carbon prices surged 15% due to new regulations.',
          keyPoints: ['Price increase of 15%', 'New EU regulations'],
          segment: 'Policy & Regulation',
        }),
      }],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(claudeResponse),
    });
    const result = await processArticle(stubRawArticle(), 'test-api-key');
    expect(result.summary).toBe('EU carbon prices surged 15% due to new regulations.');
    expect(result.keyPoints).toEqual(['Price increase of 15%', 'New EU regulations']);
    expect(result.segment).toBe('Policy & Regulation');
  });

  it('returns fallback when Claude API fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API Error'));
    const article = stubRawArticle();
    const result = await processArticle(article, 'test-api-key');
    expect(result.summary).toContain('EU carbon prices rose 15%');
    expect(result.keyPoints).toEqual([]);
    expect(result.segment).toBe('');
  });

  it('produces a clean fallback summary, not scraped chrome (regression: 2026-05-18)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API Error'));
    const article = stubRawArticle({
      fullContent:
        'Share on Facebook\nShare on LinkedIn\n' +
        '<img loading="lazy" src="https://esgnews.com/x.webp" srcset="x 780w" />\n' +
        'New Zealand plans to amend the Climate Change Response Act 2002 to block claims.',
    });
    const result = await processArticle(article, 'test-api-key');
    expect(result.isFallback).toBe(true);
    expect(result.summary).not.toContain('<img');
    expect(result.summary).not.toContain('Share on Facebook');
    expect(result.summary).toContain('New Zealand plans to amend the Climate Change Response Act 2002');
  });
});
