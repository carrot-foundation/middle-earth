/**
 * Local preview CLI for the news-digest email template.
 *
 * Run with: `pnpm nx run news-digest-pipeline:preview-email`
 *
 * Writes a rendered HTML file to `dist/news-digest-preview/digest.html`
 * that can be opened in a browser or dragged into a Gmail compose window
 * to sanity-check layout (light + dark, desktop + mobile) before deploy.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildEmailHtml } from './email-template.helpers.js';
import type { ProcessedArticle } from '../types.js';

function article(overrides: Partial<ProcessedArticle>): ProcessedArticle {
  return {
    source: 'carbon-pulse',
    url: 'https://carbon-pulse.com/article/preview/',
    title: 'Preview article',
    date: '2026-04-09',
    author: 'Preview Author',
    mainTheme: 'Carbon Markets',
    categories: '',
    location: '',
    summary: 'A preview summary that explains what the article covers in a concise way.',
    keyPoints: ['First key point', 'Second key point', 'Third key point'],
    segment: 'Policy & Regulation',
    fullContent: '',
    markdownFile: 'preview.md',
    notionPageId: null,
    processedAt: '2026-04-09T10:00:00Z',
    status: 'markdown-only',
    ...overrides,
  };
}

// Fixture deliberately exercises the edge cases that have broken real
// renders in the past: ampersand theme names, adversarial strings,
// missing author, and non-ISO dates.
const FIXTURE: ProcessedArticle[] = [
  article({
    title: 'EU launches methane monitoring framework',
    mainTheme: 'Methane & Super Pollutants',
    date: '2026-04-08',
    summary:
      'The EU proposed a framework for monitoring & reporting methane emissions across oil, gas, and coal sectors. The proposal includes binding targets and penalties for non-compliance.',
    keyPoints: [
      'Binding sector-specific targets',
      'Penalties for non-compliance',
      'Covers oil, gas, and coal',
    ],
  }),
  article({
    url: 'https://esgnews.com/article/456/',
    source: 'esgnews',
    title: 'Major retailer announces composting program',
    author: 'Bob Writer',
    mainTheme: 'Circularity & Composting',
    date: '2026-04-09',
    summary: 'A major US retailer announced a nationwide composting program.',
    keyPoints: ['Rollout across 500 stores', 'Partnership with local farms'],
  }),
  article({
    title: 'Adversarial input: <script>alert(1)</script> & "quoted"',
    author: '',
    mainTheme: 'Carbon Markets',
    date: '2026-04-07',
    summary: 'Tests that the template escapes < > & " \' correctly.',
    keyPoints: ['<b>should not be bold</b>', 'a & b & c'],
    notionPageId: null,
  }),
];

const COMPACT_FIXTURE: ProcessedArticle[] = Array.from({ length: 12 }, (_, i) =>
  article({
    url: `https://carbon-pulse.com/article/compact-${i}/`,
    title: `Compact branch article ${i + 1}`,
    mainTheme: i % 3 === 0 ? 'Methane & Super Pollutants' : i % 3 === 1 ? 'Carbon Markets' : 'Circularity & Composting',
    date: '2026-04-09',
    keyPoints: [],
  }),
);

function write(name: string, html: string): void {
  const outDir = 'dist/news-digest-preview';
  mkdirSync(outDir, { recursive: true });
  const path = `${outDir}/${name}`;
  writeFileSync(path, html);
  console.log(`Wrote ${path}`);
}

const today = new Date().toISOString().slice(0, 10);
write('digest-normal.html', buildEmailHtml(FIXTURE, today));
write('digest-compact.html', buildEmailHtml(COMPACT_FIXTURE, today));
console.log('\nOpen the files in a browser, or drag them into a Gmail compose window to preview.');
