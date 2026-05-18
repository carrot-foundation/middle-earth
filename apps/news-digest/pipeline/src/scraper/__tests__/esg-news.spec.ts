import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ThemeConfig } from '../../types.js';

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

import { chromium } from 'playwright';
import { scrapeEsgNews } from '../esg-news.js';

const TODAY_ISO = new Date().toISOString().slice(0, 10);

function stubTheme(overrides: Partial<ThemeConfig> = {}): ThemeConfig {
  return {
    name: 'Carbon Markets',
    frequency: 'daily',
    carbonPulseSearchTerms: 'carbon market',
    esgNewsSearchTerms: 'carbon market',
    trellisSearchTerms: 'carbon market',
    ...overrides,
  };
}

function mockBrowser(evaluations: Array<() => unknown>) {
  const evalQueue = [...evaluations];
  const page = {
    goto: vi.fn(async () => null),
    evaluate: vi.fn(async () => {
      const current = evalQueue.shift();
      return current ? current() : null;
    }),
  };
  const browser = {
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => undefined),
  };
  vi.mocked(chromium.launch).mockResolvedValue(browser as never);
  return { browser, page };
}

describe('scrapeEsgNews', () => {
  afterEach(() => vi.clearAllMocks());

  it('sanitizes scraped page chrome out of fullContent (regression: 2026-05-18 broken ESG articles)', async () => {
    mockBrowser([
      // Search results page: one article link.
      () => [{ url: 'https://esgnews.com/nz/', title: 'NZ Climate Law' }],
      // Article page: textContent of <article> leaked all the page chrome.
      () => ({
        content:
          'Climate\n/\nGovernment\n/\nNews\nby ESG News Editorial Team\n' +
          'Share:\nShare on Facebook\nShare on Twitter\nShare on LinkedIn\n' +
          '<img loading="lazy" src="https://esgnews.com/nz.webp" srcset="https://esgnews.com/nz.webp 780w" />\n' +
          'New Zealand plans to amend the Climate Change Response Act 2002 to block claims.\n' +
          'RELATED ARTICLE: New Zealand Lifts Climate Reporting Thresholds\n' +
          'Subscribe & Follow for Daily ESG Insights\n' +
          'ESG News Editorial Team The ESG News Editorial Team is comprised of veteran journalists.',
        author: 'ESG News Editorial Team',
        date: TODAY_ISO,
      }),
    ]);

    const result = await scrapeEsgNews([stubTheme()], new Set(), []);

    expect(result).toHaveLength(1);
    const body = result[0]?.fullContent ?? '';
    expect(body).not.toContain('<img');
    expect(body).not.toContain('srcset');
    expect(body).not.toMatch(/Share on (Facebook|Twitter|LinkedIn)/);
    expect(body).not.toMatch(/RELATED ARTICLE:/);
    expect(body).not.toMatch(/Subscribe & Follow/);
    expect(body).not.toMatch(/Editorial Team is comprised of/);
    expect(body).toContain('New Zealand plans to amend the Climate Change Response Act 2002 to block claims.');
  });

  it('closes the browser in a finally block even when scraping throws', async () => {
    const { browser } = mockBrowser([]);
    browser.newPage.mockRejectedValueOnce(new Error('page creation failed'));
    await expect(scrapeEsgNews([stubTheme()], new Set(), [])).rejects.toThrow('page creation failed');
    expect(browser.close).toHaveBeenCalled();
  });
});
