import { describe, it, expect } from 'vitest';
import { buildEmailHtml } from '../email-template.helpers.js';
import type { ProcessedArticle } from '../../types.js';

function stubProcessedArticle(overrides: Partial<ProcessedArticle> = {}): ProcessedArticle {
  return {
    source: 'carbon-pulse',
    url: 'https://carbon-pulse.com/article/123/',
    title: 'Test Article',
    date: '2026-04-09',
    author: 'Test Author',
    mainTheme: 'Carbon Markets',
    categories: '',
    location: '',
    summary: 'A test summary.',
    keyPoints: ['Point 1', 'Point 2'],
    segment: 'Policy & Regulation',
    fullContent: 'Content.',
    markdownFile: 'test.md',
    notionPageId: null,
    processedAt: '2026-04-09T10:00:00Z',
    status: 'markdown-only',
    ...overrides,
  };
}

function manyArticles(count: number): ProcessedArticle[] {
  return Array.from({ length: count }, (_, i) =>
    stubProcessedArticle({
      url: `https://carbon-pulse.com/article/${i}/`,
      title: `Article ${i}`,
      mainTheme: i % 2 === 0 ? 'Carbon Markets' : 'Methane & Super Pollutants',
    }),
  );
}

describe('buildEmailHtml — render branches', () => {
  it('renders the normal card branch when articles.length <= COMPACT_THRESHOLD', () => {
    const html = buildEmailHtml(manyArticles(3), '2026-04-09');
    expect(html).toContain('<!-- Article Card -->');
    expect(html).not.toContain('<!-- Theme Section:');
  });

  it('renders the compact theme branch when articles.length > COMPACT_THRESHOLD', () => {
    const html = buildEmailHtml(manyArticles(12), '2026-04-09');
    expect(html).toContain('<!-- Theme Section:');
    expect(html).not.toContain('<!-- Article Card -->');
  });
});

describe('buildEmailHtml — escaping', () => {
  it('escapes ampersand theme names in the compact branch (regression for line 199)', () => {
    const articles = manyArticles(12).map((a, i) =>
      i === 0 ? { ...a, mainTheme: 'Methane & Super Pollutants' } : a,
    );
    const html = buildEmailHtml(articles, '2026-04-09');
    expect(html).toContain('Methane &amp; Super Pollutants');
  });

  it('escapes ampersand theme names in the normal card branch', () => {
    const html = buildEmailHtml(
      [stubProcessedArticle({ mainTheme: 'Methane & Super Pollutants' })],
      '2026-04-09',
    );
    expect(html).toContain('Methane &amp; Super Pollutants');
  });

  it('escapes adversarial title / author / summary / key points', () => {
    const html = buildEmailHtml(
      [
        stubProcessedArticle({
          title: '<script>alert(1)</script>',
          author: '"); drop',
          summary: 'Bad <img onerror="x"> & stuff',
          keyPoints: ['<b>bold</b>', 'a & b'],
        }),
      ],
      '2026-04-09',
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img onerror="x">');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&quot;); drop');
    expect(html).toContain('Bad &lt;img onerror=&quot;x&quot;&gt; &amp; stuff');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(html).toContain('a &amp; b');
  });

  it('attribute-escapes URLs containing ampersands and quotes', () => {
    const url = 'https://carbon-pulse.com/?a=1&b=%222%22';
    const html = buildEmailHtml([stubProcessedArticle({ url })], '2026-04-09');
    expect(html).toContain('&amp;');
    // Raw unescaped `&b=` would appear if the href were not escaped.
    expect(html).not.toContain('?a=1&b=');
  });

  it('rewrites javascript: URLs to href="#"', () => {
    const html = buildEmailHtml(
      [stubProcessedArticle({ url: 'javascript:alert(1)' })],
      '2026-04-09',
    );
    expect(html).not.toContain('javascript:alert(1)');
    expect(html).toContain('href="#"');
  });

  it('rewrites unparseable URLs to href="#"', () => {
    const html = buildEmailHtml(
      [stubProcessedArticle({ url: 'not-a-url' })],
      '2026-04-09',
    );
    expect(html).toContain('href="#"');
  });
});

describe('buildEmailHtml — date rendering', () => {
  it('formats ISO dates as "Mon D, YYYY"', () => {
    const html = buildEmailHtml(
      [stubProcessedArticle({ date: '2026-04-09' })],
      '2026-04-09',
    );
    expect(html).toContain('Apr 9, 2026');
  });

  it('falls back to escaped raw text for unparseable dates and does not throw', () => {
    expect(() =>
      buildEmailHtml(
        [stubProcessedArticle({ date: 'sometime <last> week' })],
        '2026-04-09',
      ),
    ).not.toThrow();
    const html = buildEmailHtml(
      [stubProcessedArticle({ date: 'sometime <last> week' })],
      '2026-04-09',
    );
    expect(html).toContain('sometime &lt;last&gt; week');
    expect(html).not.toContain('sometime <last> week');
  });
});

describe('buildEmailHtml — minimal / empty', () => {
  it('renders with no key points, no author, and no notionPageId', () => {
    expect(() =>
      buildEmailHtml(
        [stubProcessedArticle({ keyPoints: [], author: '', notionPageId: null })],
        '2026-04-09',
      ),
    ).not.toThrow();
  });

  it('does not emit a keypoint table when keyPoints is empty', () => {
    const html = buildEmailHtml(
      [stubProcessedArticle({ keyPoints: [] })],
      '2026-04-09',
    );
    // The keypoint table uses a leading 12px div spacer in the markup.
    // When there are no keypoints, the whole block is omitted.
    const bulletMarker = '&#9679;';
    expect(html).not.toContain(bulletMarker);
  });
});

describe('buildEmailHtml — Gmail CSS regression guards', () => {
  // These guards exist because each of the last four mornings reintroduced
  // one of these patterns in a different part of the template. If any of
  // them fires, re-run step 2/3 of the plan and finish the sweep before
  // shipping.
  const scenarios: Array<[string, number]> = [
    ['normal branch (3 articles)', 3],
    ['compact branch (12 articles)', 12],
  ];

  for (const [label, count] of scenarios) {
    it(`${label}: no "background: #..." shorthand`, () => {
      const html = buildEmailHtml(manyArticles(count), '2026-04-09');
      expect(html).not.toMatch(/background:\s*#/);
    });

    it(`${label}: no "font-size: 1px" (dark-mode border bug)`, () => {
      const html = buildEmailHtml(manyArticles(count), '2026-04-09');
      expect(html).not.toContain('font-size: 1px');
    });

    it(`${label}: no non-zero margin on p/h elements`, () => {
      const html = buildEmailHtml(manyArticles(count), '2026-04-09');
      // Zero margins are fine; any non-zero px margin should be gone.
      expect(html).not.toMatch(/margin:\s*\d*[1-9]\d*\s*px/);
      expect(html).not.toMatch(/margin:\s*0\s+0\s+[1-9]/);
    });
  }
});

describe('buildEmailHtml — snapshot', () => {
  it('matches the canonical fixture snapshot', () => {
    const fixture: ProcessedArticle[] = [
      stubProcessedArticle({
        title: 'EU launches methane monitoring framework',
        author: 'Alice Reporter',
        mainTheme: 'Methane & Super Pollutants',
        date: '2026-04-08',
        summary: 'The EU proposed a framework for monitoring & reporting methane emissions across sectors.',
        keyPoints: ['Policy proposal published', 'Covers oil, gas, and coal sectors'],
      }),
      stubProcessedArticle({
        url: 'https://esgnews.com/article/456/',
        source: 'esgnews',
        title: 'Major retailer announces composting program',
        author: 'Bob Writer',
        mainTheme: 'Circularity & Composting',
        date: '2026-04-09',
        summary: 'A major US retailer announced a nationwide composting program.',
        keyPoints: ['Rollout across 500 stores', 'Partnership with local farms'],
      }),
    ];
    const html = buildEmailHtml(fixture, '2026-04-09');
    expect(html).toMatchSnapshot();
  });
});
