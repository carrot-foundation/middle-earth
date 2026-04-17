import type { ProcessedArticle } from '../types.js';
import { sourceLabel } from './source.helpers.js';

const MAX_SLUG_LENGTH = 63;

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-$/, '');
}

export function buildArticleMarkdown(article: ProcessedArticle): string {
  const company = 'Not Applicable';
  const keyPointsList = article.keyPoints.map((p) => `- ${p}`).join('\n');

  return `# ${article.title}

> **Notion Properties**
> Copy these values when adding to Notion database:
>
> **Nome (Title):** ${article.title}
> **Segment:** ${article.segment}
> **Main Theme:** ${article.mainTheme}
> **Company:** ${company}
> **Date:** ${article.date}

---

## Article Metadata

**Source:** [${sourceLabel(article.source)}](${article.url})
**Published:** ${article.date}
**Author:** ${article.author}
**Location:** ${article.location ?? 'N/A'}
**Categories/Tags:** ${article.categories ?? 'N/A'}

---

## Key Points

${keyPointsList}

---

## Summary

${article.summary}

---

## Full Article Content

${article.fullContent}

---

**Article extracted from:** [${sourceLabel(article.source)}](${article.url})
**Extracted on:** ${article.processedAt.slice(0, 10)}
**Status:** ${article.status}
`;
}
