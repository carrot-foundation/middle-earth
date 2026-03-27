import type { RawArticle } from '../types.js';

function normalizeTitle(title: string): string[] {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((word) => word.length > 2);
}

export function isSimilarTitle(titleA: string, titleB: string): boolean {
  const wordsA = new Set(normalizeTitle(titleA));
  const wordsB = new Set(normalizeTitle(titleB));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  const intersection = [...wordsA].filter((word) => wordsB.has(word));
  const smaller = Math.min(wordsA.size, wordsB.size);
  return intersection.length / smaller >= 0.5;
}

interface DedupResult {
  readonly kept: RawArticle[];
  readonly removed: RawArticle[];
}

export function deduplicateArticles(articles: readonly RawArticle[]): DedupResult {
  const kept: RawArticle[] = [];
  const removed: RawArticle[] = [];
  const seenUrls = new Set<string>();
  const sorted = [...articles].sort((a, b) => a.source === 'carbon-pulse' && b.source !== 'carbon-pulse' ? -1 : 1);

  for (const article of sorted) {
    if (seenUrls.has(article.url)) { removed.push(article); continue; }
    const isDuplicate = kept.some((existing) => isSimilarTitle(existing.title, article.title));
    if (isDuplicate) { removed.push(article); } else { kept.push(article); seenUrls.add(article.url); }
  }
  return { kept, removed };
}
