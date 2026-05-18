import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

import { chromium } from 'playwright';
import { parseHumanDate, scrapeCarbonPulse } from '../carbon-pulse.js';
import type { ProxyConfig, ThemeConfig } from '../../types.js';

const TODAY_HUMAN = new Date().toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

function stubTheme(overrides: Partial<ThemeConfig> = {}): ThemeConfig {
  return {
    name: 'Methane & Super Pollutants',
    frequency: 'daily',
    carbonPulseSearchTerms: 'methane',
    esgNewsSearchTerms: 'methane',
    trellisSearchTerms: 'methane',
    ...overrides,
  };
}

const PROXY: ProxyConfig = { server: 'http://proxy', username: 'u', password: 'p' };
const CREDS = { username: 'user', password: 'pass' };

function mockBrowser(evaluations: Array<() => unknown>) {
  const evalQueue = [...evaluations];
  const locator = {
    first: () => ({ fill: vi.fn(async () => undefined), click: vi.fn(async () => undefined) }),
  };
  const page = {
    goto: vi.fn(async () => null),
    title: vi.fn(async () => 'Carbon Pulse'),
    url: vi.fn(() => 'https://carbon-pulse.com/login/'),
    fill: vi.fn(async () => undefined),
    click: vi.fn(async () => undefined),
    waitForLoadState: vi.fn(async () => undefined),
    waitForSelector: vi.fn(async () => undefined),
    waitForFunction: vi.fn(async () => undefined),
    locator: vi.fn(() => locator),
    evaluate: vi.fn(async () => {
      const current = evalQueue.shift();
      return current ? current() : null;
    }),
  };
  const context = {
    addInitScript: vi.fn(async () => undefined),
    newPage: vi.fn(async () => page),
  };
  const browser = {
    newContext: vi.fn(async () => context),
    close: vi.fn(async () => undefined),
  };
  vi.mocked(chromium.launch).mockResolvedValue(browser as never);
  return { browser, page };
}

describe('parseHumanDate', () => {
  it.each<[string, string]>([
    ['2026-04-09', '2026-04-09'],
    ['April 9, 2026', '2026-04-09'],
    ['9 April 2026', '2026-04-09'],
    ['Apr 9, 2026', '2026-04-09'],
  ])('normalizes %s to ISO', (input, expected) => {
    expect(parseHumanDate(input)).toBe(expected);
  });

  it.each<[string]>([[''], ['garbage'], ['not-a-date']])(
    'returns empty string for unparseable input %s',
    (input) => {
      expect(parseHumanDate(input)).toBe('');
    },
  );
});

describe('scrapeCarbonPulse', () => {
  afterEach(() => vi.clearAllMocks());

  it('does NOT emit an article for a listing/ticker page (regression: "CP Daily News Ticker" 2026-05-18)', async () => {
    mockBrowser([
      // Search results: the link selector now matches a ticker/listing page.
      () => [
        {
          url: 'https://carbon-pulse.com/cp-daily-news-ticker-may-16-2026/',
          title: 'CP Daily News Ticker: May 16, 2026',
        },
      ],
      // "Article" page: actually a date-filter calendar widget, not an article.
      () => ({
        content:
          'Click on the coloured labels below to filter by region or topic\n' +
          'Filter by dateClear filter×See the past posts by selecting a date in the calendar below:\n' +
          'January February March April May June July August September October November December\n' +
          '2016 2017 2018 2019 2020 2021 2022 2023 2024 2025 2026',
        author: '',
        date: TODAY_HUMAN,
        categories: '',
      }),
    ]);

    const result = await scrapeCarbonPulse([stubTheme()], new Set(), CREDS, PROXY);

    expect(result).toHaveLength(0);
  });

  it('sanitizes chrome but keeps a real article body', async () => {
    mockBrowser([
      () => [{ url: 'https://carbon-pulse.com/real-article/', title: 'Real Carbon Article' }],
      () => ({
        content:
          'Share on Facebook\n' +
          '<img loading="lazy" src="https://carbon-pulse.com/x.webp" srcset="x 780w" />\n' +
          'Methane emissions from landfills rose sharply in 2025, new data shows.',
        author: 'Carbon Pulse',
        date: TODAY_HUMAN,
        categories: 'Methane',
      }),
    ]);

    const result = await scrapeCarbonPulse([stubTheme()], new Set(), CREDS, PROXY);

    expect(result).toHaveLength(1);
    const body = result[0]?.fullContent ?? '';
    expect(body).not.toContain('<img');
    expect(body).not.toMatch(/Share on Facebook/);
    expect(body).toContain('Methane emissions from landfills rose sharply in 2025, new data shows.');
  });
});
