// ESG News discovery — RSS feed.
//
// ESG News has no usable server-side search: `esgnews.com/?s=<term>` ignores
// the query term *and* `orderby` entirely and returns the same fixed post grid
// for every request (validated 2026-05-21 — the old `?s=` discovery surfaced
// ~0 fresh articles and collapsed the digest to a single article). The
// publisher's WordPress RSS feed, by contrast, is clean: date-desc ordered,
// real `<pubDate>`, and `<content:encoded>` carries the full article body —
// so ESG needs no Firecrawl at all (same model as the Substack scraper).
//
// Discovery is global (one feed fetch, no per-theme loop); the shared article
// curator picks the most digest-worthy items and assigns each a theme.

import { XMLParser } from 'fast-xml-parser';
import { THEMES } from '../config.constants.js';
import { curateArticles, type ArticleCandidate } from '../ai/article-curator.js';
import { sanitizeArticleText } from '../helpers/content.helpers.js';
import { stripHtml } from './substack.js';
import type { RawArticle } from '../types.js';

const ESG_NEWS_FEED_URL = 'https://esgnews.com/feed/';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_ARTICLE_AGE_DAYS = 30;
// Cap on candidates handed to the curator. The feed carries ~50 recent items;
// after the freshness + dedup filters this is rarely hit, but it bounds the
// curator prompt size if the feed ever balloons.
const MAX_CANDIDATES = 30;
// ESG News is the digest's primary source while Carbon Pulse is disabled, so
// it gets a higher pick budget than Trellis (which keeps the curator default).
const MAX_PICKS = 3;

interface RssItem {
  readonly title?: string;
  readonly link?: string;
  readonly pubDate?: string;
  readonly description?: string;
  readonly 'content:encoded'?: string;
  readonly 'dc:creator'?: string;
}

interface FeedArticle {
  readonly url: string;
  readonly title: string;
  readonly date: string;
  readonly author: string;
  readonly excerpt: string;
  readonly fullContent: string;
}

function isDuplicateOfCarbonPulse(title: string, cpTitles: readonly string[]): boolean {
  const lowerTitle = title.toLowerCase();
  return cpTitles.some((cpTitle) => {
    const cpWords = new Set(
      cpTitle.toLowerCase().split(/\s+/).filter((word) => word.length > 3),
    );
    const esgWords = lowerTitle.split(/\s+/).filter((word) => word.length > 3);
    const overlap = esgWords.filter((word) => cpWords.has(word)).length;
    return cpWords.size > 0 && overlap / cpWords.size >= 0.5;
  });
}

/** Normalize the feed XML into RSS `<item>` records. */
function parseFeedItems(xml: string): readonly RssItem[] {
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
  return Array.isArray(itemsRaw) ? itemsRaw : itemsRaw ? [itemsRaw] : [];
}

/**
 * Fetch the ESG News RSS feed and turn it into freshness-filtered, deduped
 * article candidates — the per-article body comes straight from
 * `content:encoded` (no second network call), then through the shared
 * sanitizer barrier.
 */
async function fetchFeedArticles(
  processedUrls: ReadonlySet<string>,
  cpTitles: readonly string[],
): Promise<FeedArticle[]> {
  const response = await fetch(ESG_NEWS_FEED_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${ESG_NEWS_FEED_URL}`);
  }
  const items = parseFeedItems(await response.text());
  const cutoffMs = Date.now() - MAX_ARTICLE_AGE_DAYS * 24 * 60 * 60 * 1000;

  const articles: FeedArticle[] = [];
  for (const item of items) {
    const url = item.link;
    if (!url || processedUrls.has(url)) continue;

    // The feed always carries a real <pubDate>; an item without a parseable
    // one is suspect — skip rather than stamp it "today" and let a stale
    // article slip past the freshness window.
    const raw = item.pubDate;
    const published = raw ? new Date(raw) : null;
    if (!published || Number.isNaN(published.getTime())) {
      console.warn(`[ESG News] No parseable pubDate, skipping: ${url}`);
      continue;
    }
    if (published.getTime() < cutoffMs) continue;

    const title = stripHtml(item.title ?? '');
    if (!title || isDuplicateOfCarbonPulse(title, cpTitles)) continue;

    // Defense-in-depth: feed HTML still carries share strips, related-article
    // blocks and the editorial-team bio — strip it through the same barrier
    // every scraper uses (cf. content.helpers).
    const html = item['content:encoded'] ?? item.description ?? '';
    const fullContent = sanitizeArticleText(stripHtml(html));
    if (!fullContent) {
      console.warn(`[ESG News] No article body after sanitization, skipping: ${url}`);
      continue;
    }

    articles.push({
      url,
      title,
      date: published.toISOString().slice(0, 10),
      author: stripHtml(item['dc:creator'] ?? '') || 'ESG News',
      excerpt: stripHtml(item.description ?? '') || title,
      fullContent,
    });
    if (articles.length >= MAX_CANDIDATES) break;
  }
  return articles;
}

/**
 * Scrape ESG News for the daily digest. Discovers articles from the publisher
 * RSS feed, then asks the shared curator to pick the most relevant ones and
 * tag each with a theme. Any failure degrades to an empty list — the caller
 * (orchestrator) logs it and continues with the other sources.
 */
export async function scrapeEsgNews(
  processedUrls: ReadonlySet<string>,
  cpTitles: readonly string[],
  anthropicApiKey: string,
): Promise<RawArticle[]> {
  console.log('[ESG News] Fetching RSS feed...');
  const feedArticles = await fetchFeedArticles(processedUrls, cpTitles);
  console.log(`[ESG News] ${feedArticles.length} fresh candidate(s) from feed`);
  if (feedArticles.length === 0) return [];

  const candidates: ArticleCandidate[] = feedArticles.map((article) => ({
    url: article.url,
    title: article.title,
    date: article.date,
    excerpt: article.excerpt,
  }));
  const picks = await curateArticles(
    candidates,
    THEMES.map((theme) => theme.name),
    anthropicApiKey,
    { maxPicks: MAX_PICKS, label: 'ESG News Curator' },
  );

  const articleByUrl = new Map(feedArticles.map((article) => [article.url, article]));
  const result: RawArticle[] = [];
  for (const pick of picks) {
    const article = articleByUrl.get(pick.url);
    if (!article) continue;
    result.push({
      source: 'esgnews',
      url: article.url,
      title: article.title,
      date: article.date,
      author: article.author,
      mainTheme: pick.mainTheme,
      categories: '',
      location: '',
      fullContent: article.fullContent,
    });
  }
  console.log(`[ESG News] ${result.length} article(s) selected`);
  return result;
}
