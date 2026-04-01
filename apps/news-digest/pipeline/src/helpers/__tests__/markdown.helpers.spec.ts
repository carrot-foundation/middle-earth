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
});
