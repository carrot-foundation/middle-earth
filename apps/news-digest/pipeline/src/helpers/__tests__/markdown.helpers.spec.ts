import { describe, it, expect } from 'vitest';
import { buildArticleMarkdown, slugify } from '../markdown.helpers.js';
import type { ProcessedArticle } from '../../types.js';

describe('slugify', () => {
  it.each([
    ['EU Carbon Market Hits Record High!', 'eu-carbon-market-hits-record-high'],
    ['  Spaces & Special  Chars!! ', 'spaces-special-chars'],
    ['Very Long Title That Should Be Truncated Because It Exceeds The Maximum Length Allowed For File Names In This System', 'very-long-title-that-should-be-truncated-because-it-exceeds-the'],
  ])('slugifies "%s" to "%s"', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('buildArticleMarkdown', () => {
  it('produces valid markdown with all sections', () => {
    const article: ProcessedArticle = {
      source: 'carbon-pulse',
      url: 'https://carbon-pulse.com/123/',
      title: 'Test Article',
      date: '2026-03-27',
      author: 'Test Author',
      mainTheme: 'Carbon Markets',
      categories: 'EU, Voluntary',
      location: 'Europe',
      summary: 'A summary of the article.',
      keyPoints: ['Point 1', 'Point 2'],
      segment: 'Policy & Regulation',
      fullContent: 'Full article content here.',
      markdownFile: '2026-03-27-test-article.md',
      notionPageId: null,
      processedAt: '2026-03-27T10:00:00Z',
      status: 'markdown-only',
    };

    const md = buildArticleMarkdown(article);

    expect(md).toContain('# Test Article');
    expect(md).toContain('**Segment:** Policy & Regulation');
    expect(md).toContain('**Main Theme:** Carbon Markets');
    expect(md).toContain('## Key Points');
    expect(md).toContain('- Point 1');
    expect(md).toContain('## Summary');
    expect(md).toContain('A summary of the article.');
    expect(md).toContain('## Full Article Content');
  });

  it('sanitizes scraped chrome out of the full content section (regression: 2026-05-18)', () => {
    const article: ProcessedArticle = {
      source: 'esgnews',
      url: 'https://esgnews.com/x/',
      title: 'NZ Climate Law',
      date: '2026-05-17',
      author: 'ESG News',
      mainTheme: 'Carbon Markets',
      categories: '',
      location: '',
      summary: 'Clean summary.',
      keyPoints: ['Point 1'],
      segment: '',
      fullContent:
        'Share on Twitter\n' +
        '<img loading="lazy" src="https://esgnews.com/x.webp" srcset="x 780w" />\n' +
        'New Zealand plans to amend the Climate Change Response Act 2002.\n' +
        'Subscribe & Follow for Daily ESG Insights',
      markdownFile: '2026-05-17-nz.md',
      notionPageId: null,
      processedAt: '2026-05-18T10:00:00Z',
      status: 'markdown-only',
    };

    const md = buildArticleMarkdown(article);

    expect(md).not.toContain('<img');
    expect(md).not.toContain('srcset');
    expect(md).not.toContain('Share on Twitter');
    expect(md).not.toContain('Subscribe & Follow');
    expect(md).toContain('New Zealand plans to amend the Climate Change Response Act 2002.');
  });
});
