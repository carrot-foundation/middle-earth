// Defense-in-depth sanitizer for scraped article bodies.
//
// Scrapers extract `fullContent` from source-site DOM. When a site changes its
// markup (or a listing/ticker page is captured instead of an article), naive
// whole-container `.textContent` leaks page chrome: breadcrumbs, social-share
// buttons, <noscript> lazy-load <img> markup, author bios, newsletter signups,
// and date-filter widgets. `notion.ts` and the S3 markdown write this verbatim.
//
// This is the single point that strips that chrome regardless of which scraper
// produced it (present or future). An all-chrome page sanitizes to '' so the
// caller can skip creating an empty/garbage article.

const MONTHS =
  'January|February|March|April|May|June|July|August|September|October|November|December';

const MONTH_LIST_RE = new RegExp(`^(?:${MONTHS})(?:\\s+(?:${MONTHS}))*$`, 'i');
const YEAR_RUN_RE = /^(?:(?:19|20)\d{2})(?:\s+(?:19|20)\d{2})+$/;

// Lines that are pure site chrome, never article body.
const BOILERPLATE_LINE_PATTERNS: readonly RegExp[] = [
  /^Share:?$/i,
  /^Share on (?:Facebook|Twitter|LinkedIn|X)\b/i,
  /^Subscribe & Follow\b/i,
  /^Stay Informed:/i,
  /^Join the Conversation:/i,
  /\bEditorial Team is comprised of\b/i,
  /^RELATED ARTICLE:/i,
  /^Click on the coloured labels\b/i,
  /^Filter by date\b/i,
  /\bSee the past posts by selecting a date\b/i,
  MONTH_LIST_RE,
  YEAR_RUN_RE,
];

function isBoilerplateLine(line: string): boolean {
  return BOILERPLATE_LINE_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Strips residual HTML markup and known site chrome from a scraped article
 * body, collapsing CSS-layout whitespace into clean paragraphs.
 *
 * Returns an empty string when nothing but chrome remains (e.g. a Carbon Pulse
 * listing/ticker page), so callers can skip it instead of publishing garbage.
 */
export function sanitizeArticleText(raw: string): string {
  if (!raw) return '';

  // Drop any residual tags (e.g. <img>/<br>/<p> leaked via <noscript> or a
  // failed extraction). A space keeps adjacent words from gluing together.
  const withoutTags = raw.replace(/<[^>]*>/g, ' ');

  const cleanLines = withoutTags
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0 && !isBoilerplateLine(line));

  return cleanLines.join('\n\n');
}
