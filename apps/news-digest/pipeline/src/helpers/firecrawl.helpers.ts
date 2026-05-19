// Thin Firecrawl v2 HTTP client (search + scrape) used by the scrapers.
//
// Firecrawl replaces hand-written CSS-selector scraping: `search` gives
// layout-resilient discovery and `scrape` returns markdown regardless of DOM.
// Mirrors the raw-`fetch` pattern in `ai/article-processor.ts` (no SDK).
// Validated against the v2 API in the 2026-05-18 Step 0 spike.

const FIRECRAWL_API_BASE = 'https://api.firecrawl.dev/v2';
const SCRAPE_TIMEOUT_MS = 60_000;
const SEARCH_TIMEOUT_MS = 30_000;
// Client-side ceiling above the server-side `timeout` hint so a hung socket
// can't block the scheduled pipeline indefinitely (orchestrator try/catch
// catches errors, not hangs).
const CLIENT_TIMEOUT_BUFFER_MS = 15_000;

export class FirecrawlError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'FirecrawlError';
    this.status = status;
  }
}

export interface FirecrawlSearchResult {
  readonly url: string;
  readonly title: string;
  readonly description: string;
}

export interface FirecrawlScrapeResult {
  readonly markdown: string;
  readonly publishedTime: string;
  readonly author: string;
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
    throw new FirecrawlError(`Firecrawl ${path} request failed: ${reason}`);
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
 * Web search via Firecrawl. Returns `{ url, title }` for each web result,
 * dropping entries missing either field.
 *
 * Recency: the Google-style `tbs=qdr:*` filter was tried and dropped — for
 * `site:esgnews.com` / `site:trellis.net` queries it excluded **all** results
 * (Firecrawl honors `tbs` only when the underlying index has a clean
 * publish date; both publishers lack one, so the filter is binary-fatal).
 * A hybrid listing-page scrape will replace it; until then recency relies
 * solely on the per-scraper `MAX_ARTICLE_AGE_DAYS` filter.
 */
export async function firecrawlSearch(
  query: string,
  apiKey: string,
  limit = 10,
): Promise<FirecrawlSearchResult[]> {
  const data = await firecrawlPost(
    '/search',
    apiKey,
    { query, limit, sources: [{ type: 'web' }] },
    SEARCH_TIMEOUT_MS + CLIENT_TIMEOUT_BUFFER_MS,
  );

  const payload = (data['data'] ?? {}) as Record<string, unknown>;
  const web = Array.isArray(payload['web']) ? payload['web'] : [];

  return web
    .map((entry): FirecrawlSearchResult => {
      const record = (entry ?? {}) as Record<string, unknown>;
      return {
        url: typeof record['url'] === 'string' ? record['url'] : '',
        title: typeof record['title'] === 'string' ? record['title'].trim() : '',
        description:
          typeof record['description'] === 'string' ? record['description'].trim() : '',
      };
    })
    .filter((result) => result.url.length > 0 && result.title.length > 0);
}

/**
 * Scrape a single URL to markdown (main content only). Pull publish time and
 * author from page metadata when present.
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
