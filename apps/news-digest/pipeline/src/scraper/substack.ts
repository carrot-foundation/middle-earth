import { XMLParser } from 'fast-xml-parser';
import type { RawArticle, SubstackPublication } from '../types.js';

const RETENTION_DAYS = 90;

interface RssItem {
  readonly title?: string;
  readonly link?: string;
  readonly pubDate?: string;
  readonly description?: string;
  readonly 'content:encoded'?: string;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parsePubDate(raw: string | undefined): string {
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

async function scrapeOnePublication(
  publication: SubstackPublication,
  processedUrls: ReadonlySet<string>,
  cutoffMs: number,
): Promise<readonly RawArticle[]> {
  const response = await fetch(publication.feedUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const xml = await response.text();
  const parser = new XMLParser({ ignoreAttributes: true });
  const parsed = parser.parse(xml) as { rss?: { channel?: { item?: RssItem | RssItem[] } } };
  if (typeof parsed !== 'object' || parsed === null || typeof parsed.rss !== 'object' || parsed.rss === null) {
    throw new Error('Invalid RSS: not an object');
  }
  const channel = parsed.rss.channel;
  if (!channel || typeof channel !== 'object') {
    throw new Error('Invalid RSS: missing channel');
  }
  const itemsRaw = channel.item;
  const items: readonly RssItem[] = Array.isArray(itemsRaw) ? itemsRaw : itemsRaw ? [itemsRaw] : [];

  const articles: RawArticle[] = [];
  for (const item of items) {
    const link = item.link;
    if (!link || processedUrls.has(link)) continue;

    const publishedAt = parsePubDate(item.pubDate);
    if (new Date(publishedAt).getTime() < cutoffMs) continue;

    const html = item['content:encoded'] ?? item.description ?? '';
    if (!html) continue;
    const fullContent = stripHtml(html);
    if (!fullContent) continue;

    articles.push({
      source: publication.source,
      url: link,
      title: item.title ?? '',
      date: publishedAt.slice(0, 10),
      author: publication.name,
      mainTheme: 'Industry Intelligence',
      categories: '',
      location: '',
      fullContent,
    });
  }
  return articles;
}

export async function scrapeSubstack(
  publications: readonly SubstackPublication[],
  processedUrls: ReadonlySet<string>,
): Promise<RawArticle[]> {
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const results = await Promise.allSettled(
    publications.map((pub) => scrapeOnePublication(pub, processedUrls, cutoffMs)),
  );

  const articles: RawArticle[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    const pub = publications[i]!;
    if (result.status === 'fulfilled') {
      articles.push(...result.value);
      console.log(`[Substack:${pub.name}] ${result.value.length} articles`);
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : 'unknown';
      console.error(`[Substack:${pub.name}] failed: ${msg}`);
    }
  }
  return articles;
}
