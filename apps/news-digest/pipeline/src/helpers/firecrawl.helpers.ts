// Thin Firecrawl v2 HTTP client (scrape) used by the Trellis scraper.
//
// Firecrawl replaces hand-written CSS-selector scraping: `scrape` returns
// markdown regardless of DOM, and we discover article candidates by
// scraping Trellis's own `/articles/` index + `?s=` search pages and
// extracting links from that markdown.
//
// Why not `/v2/search`? It was tried (PRs #31/#32) and failed: the upstream
// web index does not carry reliable publish dates for `trellis.net`, so its
// `tbs=qdr:*` recency filter is binary-fatal (PR #34 → reverted in #35).
//
// ESG News no longer uses this client at all: `esgnews.com/?s=` turned out to
// ignore the query term and `orderby` entirely (validated 2026-05-21), so the
// ESG scraper switched to the publisher RSS feed — see `scraper/esg-news.ts`.
//
// Mirrors the raw-`fetch` pattern in `ai/article-processor.ts` (no SDK).
// Validated against the v2 API in the 2026-05-18 Step 0 spike and the
// 2026-05-19 isolated ECS validation runs.

const FIRECRAWL_API_BASE = 'https://api.firecrawl.dev/v2';
const SCRAPE_TIMEOUT_MS = 60_000;
// Client-side ceiling above the server-side `timeout` hint so a hung socket
// can't block the scheduled pipeline indefinitely (orchestrator try/catch
// catches errors, not hangs).
const CLIENT_TIMEOUT_BUFFER_MS = 15_000;

export class FirecrawlError extends Error {
  readonly status?: number;
  // Preserve the underlying error class (AbortError, TypeError, …) so
  // callers can distinguish a transport-level timeout from a quota
  // response if they need to. Logged callers see `error.message`; outage
  // detection can inspect `error.cause` instead of string-matching.
  readonly cause?: unknown;

  constructor(message: string, status?: number, cause?: unknown) {
    super(message);
    this.name = 'FirecrawlError';
    this.status = status;
    this.cause = cause;
  }
}

export interface FirecrawlScrapeResult {
  readonly markdown: string;
  readonly publishedTime: string;
  readonly author: string;
}

export interface MarkdownLink {
  readonly url: string;
  readonly title: string;
}

function firstString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

async function firecrawlPost(
  path: string,
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  if (!apiKey) {
    throw new FirecrawlError('FIRECRAWL_API_KEY not configured');
  }

  let response: Response;
  try {
    response = await fetch(`${FIRECRAWL_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : 'network error';
    throw new FirecrawlError(`Firecrawl ${path} request failed: ${reason}`, undefined, error);
  }

  if (!response.ok) {
    throw new FirecrawlError(`Firecrawl ${path} returned ${response.status}`, response.status);
  }

  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    throw new FirecrawlError(`Firecrawl ${path} returned a non-JSON body`, response.status);
  }
}

/**
 * Scrape a single URL to markdown (main content only). Pull publish time and
 * author from page metadata when present. Used both for the listing/search
 * pages (discovery) and for the article body itself.
 */
export async function firecrawlScrape(
  url: string,
  apiKey: string,
): Promise<FirecrawlScrapeResult> {
  const data = await firecrawlPost(
    '/scrape',
    apiKey,
    { url, formats: ['markdown'], onlyMainContent: true, timeout: SCRAPE_TIMEOUT_MS },
    SCRAPE_TIMEOUT_MS + CLIENT_TIMEOUT_BUFFER_MS,
  );

  const payload = (data['data'] ?? {}) as Record<string, unknown>;
  const metadata = (payload['metadata'] ?? {}) as Record<string, unknown>;

  return {
    markdown: typeof payload['markdown'] === 'string' ? payload['markdown'] : '',
    publishedTime: firstString(metadata['article:published_time']),
    author:
      firstString(metadata['author']) || firstString(metadata['article:author']),
  };
}

// Inline markdown link syntax: `[title](url)` with an optional `"title"`
// trailing the URL. Reference-style links (`[t][ref]`) and bare URLs are
// not matched on purpose — listing pages always render as inline links.
// The negative lookbehind `(?<!!)` excludes image syntax `![alt](url)` so
// thumbnail images on listing cards don't leak into the candidate pool
// (would burn a Firecrawl scrape on a JPG URL).
const MARKDOWN_LINK_PATTERN = /(?<!!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

// Recursively peel matched-emphasis wrappers (`**bold**`, `*italic*`, `__b__`,
// `_i_`, and `***bold-italic***`) off a link title. Trellis listings render
// titles as `[**Title Goes Here**](url)`; without this, the `**` ended up
// literally in the Notion page title (regression: 2026-05-20 prod page).
// Unmatched/asymmetric markers are left alone — safer than over-stripping.
function stripMarkdownEmphasis(title: string): string {
  let current = title.trim();
  for (;;) {
    const match = /^(\*\*\*|\*\*|__|\*|_)(.+)\1$/.exec(current);
    if (!match) return current;
    current = match[2].trim();
  }
}

/**
 * Pull `{url, title}` from each markdown inline link, in source order, keeping
 * only those the `predicate` accepts. Titles are trimmed; empty titles and
 * empty URLs are dropped. Duplicates (by URL) are removed preserving the
 * first occurrence.
 *
 * Stays narrow on purpose: per-source rules (host check, path patterns,
 * exclude index pages, dedup against `processedUrls`) live in the scraper
 * predicate so the helper stays generic.
 */
export function extractMarkdownLinks(
  markdown: string,
  predicate: (link: MarkdownLink) => boolean,
): MarkdownLink[] {
  if (!markdown) return [];
  const seen = new Set<string>();
  const out: MarkdownLink[] = [];
  for (const match of markdown.matchAll(MARKDOWN_LINK_PATTERN)) {
    const rawTitle = (match[1] ?? '').trim();
    const title = stripMarkdownEmphasis(rawTitle);
    const url = (match[2] ?? '').trim();
    if (!title || !url || seen.has(url)) continue;
    if (!predicate({ url, title })) continue;
    seen.add(url);
    out.push({ url, title });
  }
  return out;
}
