/**
 * Normalize an arbitrary date string (ISO, RFC, human) to `YYYY-MM-DD`.
 *
 * Returns `''` for empty or unparseable input — every scraper treats `''` as
 * "no reliable publish date" and skips the article, so freshness behaviour is
 * identical across esg-news / trellis (and future scrapers).
 *
 * Behaviour is intentionally unchanged from the previous per-scraper copies.
 * The `.toISOString().slice(0,10)` round-trip is UTC-based; a known
 * timezone off-by-one at the freshness boundary is tracked in
 * `implementation-artifacts/deferred-work.md` — now fixable in one place.
 */
export function parseDate(raw: string): string {
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}
