import { describe, it, expect } from 'vitest';
import { deduplicateArticles, isSimilarTitle } from '../dedup.helpers.js';
import type { RawArticle } from '../../types.js';

function stubArticle(overrides: Partial<RawArticle> = {}): RawArticle {
  return {
    source: 'carbon-pulse',
    url: 'https://carbon-pulse.com/123/',
    title: 'EU carbon market hits record high',
    date: '2026-03-27',
    author: 'Test Author',
    mainTheme: 'Carbon Markets',
    categories: '',
    location: '',
    fullContent: 'Article content here.',
    ...overrides,
  };
}

describe('isSimilarTitle', () => {
  it.each([
    ['EU carbon market hits record high', 'Carbon market in EU reaches new record high', true],
    ['Methane emissions drop in 2026', 'Methane emissions drop in 2026', true],
    ['Methane emissions drop', 'Carbon markets surge', false],
  ])('compares "%s" and "%s" → %s', (a, b, expected) => {
    expect(isSimilarTitle(a, b)).toBe(expected);
  });
});

describe('deduplicateArticles', () => {
  it('keeps Carbon Pulse version when both sources cover same story', () => {
    const cpArticle = stubArticle({ source: 'carbon-pulse', title: 'EU carbon market hits record high' });
    const esgArticle = stubArticle({ source: 'esgnews', url: 'https://esgnews.com/eu-carbon-market/', title: 'Carbon market in EU reaches new record high' });
    const result = deduplicateArticles([cpArticle, esgArticle]);
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0]?.source).toBe('carbon-pulse');
    expect(result.removed).toHaveLength(1);
  });

  it('keeps both when titles are not similar', () => {
    const cpArticle = stubArticle({ title: 'Methane regulations update' });
    const esgArticle = stubArticle({ source: 'esgnews', url: 'https://esgnews.com/other/', title: 'New solar panel technology announced' });
    const result = deduplicateArticles([cpArticle, esgArticle]);
    expect(result.kept).toHaveLength(2);
    expect(result.removed).toHaveLength(0);
  });

  it('removes duplicates by URL', () => {
    const article1 = stubArticle();
    const article2 = stubArticle();
    const result = deduplicateArticles([article1, article2]);
    expect(result.kept).toHaveLength(1);
  });

  it('keeps Carbon Pulse over Trellis and ESG News for similar titles', () => {
    const articles = [
      stubArticle({ source: 'esgnews', url: 'https://esgnews.com/1/', title: 'EU carbon market hits record high' }),
      stubArticle({ source: 'trellis', url: 'https://trellis.net/article/trl-1/', title: 'EU carbon market reaches record high' }),
      stubArticle({ source: 'carbon-pulse', url: 'https://carbon-pulse.com/cp-1/', title: 'EU carbon market hits record high' }),
    ];
    const { kept, removed } = deduplicateArticles(articles);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.source).toBe('carbon-pulse');
    expect(removed).toHaveLength(2);
  });

  it('keeps Trellis over ESG News for similar titles', () => {
    const articles = [
      stubArticle({ source: 'esgnews', url: 'https://esgnews.com/2/', title: 'Methane emissions dropped in 2026' }),
      stubArticle({ source: 'trellis', url: 'https://trellis.net/article/trl-2/', title: 'Methane emissions drop in 2026' }),
    ];
    const { kept, removed } = deduplicateArticles(articles);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.source).toBe('trellis');
    expect(removed).toHaveLength(1);
    expect(removed[0]?.source).toBe('esgnews');
  });

  it('keeps distinct-title articles from all three sources', () => {
    const articles = [
      stubArticle({ source: 'carbon-pulse', url: 'https://carbon-pulse.com/a/', title: 'Alpha policy update' }),
      stubArticle({ source: 'trellis', url: 'https://trellis.net/article/b/', title: 'Beta market analysis' }),
      stubArticle({ source: 'esgnews', url: 'https://esgnews.com/c/', title: 'Gamma corporate news' }),
    ];
    const { kept, removed } = deduplicateArticles(articles);
    expect(kept).toHaveLength(3);
    expect(removed).toHaveLength(0);
  });

  it('removes a second article with the same URL regardless of source', () => {
    const articles = [
      stubArticle({ source: 'trellis', url: 'https://same.example/x/', title: 'First title' }),
      stubArticle({ source: 'esgnews', url: 'https://same.example/x/', title: 'Unrelated title' }),
    ];
    const { kept, removed } = deduplicateArticles(articles);
    expect(kept).toHaveLength(1);
    expect(removed).toHaveLength(1);
  });
});
