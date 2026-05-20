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

// Lines that are pure site chrome, never article body. Patterns are anchored
// to the WHOLE LINE so a phrase inside a real article paragraph isn't dropped.
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
  // Firecrawl markdown chrome (Trellis + ESG templates, regression: 2026-05-20):
  // page nav, newsletter signup form, social share strip, image markdown,
  // reCAPTCHA badge, byline labels, sponsored content cards.
  /^Skip to content$/i,
  /^Subscribe to .{1,80} (?:Briefing|Newsletter|Daily|Weekly)/i,
  /^Please enable JavaScript/i,
  /^Email address[\s*\\]*$/i,
  /^utm(?:Campaign|Medium|Source|Term|Content)Last$/i,
  /^Subscribe!?$/i,
  /^Subscribe!?\[.*\]\(.*\)$/i, // "Subscribe![Loading](url)" button + loader image
  /^Case Studies$/i,
  /^Sponsored$/i,
  /^reCAPTCHA$/i,
  /^Recaptcha requires/i,
  /^protected by/i,
  /^By\s*$/i, // standalone "By" label (the author name is on the next line)
  /^Read More$/i,
  /^\\+$/, // lone backslash artifact ("\\\\" from collapsed-card layout markup)
  /^!\[[^\]]*\]\([^)]*\)\\?$/, // pure image markdown line: ![alt](url) (optional trailing backslash)
  // ENTIRE line consists of only inline link(s) — share button strip and link-only
  // navigation chrome. Inline links inside article paragraphs are NOT matched
  // because they have other text alongside.
  /^(?:\[[^\]]*\]\([^)]*\)\s*)+$/,
];

// Headings (`# … ## … ### …`) that mark the end of the article body. Everything
// from that line down is publisher footer (Featured Reports cards, newsletter
// reposts, author bio republished, etc.). Tested in order; first match wins.
const TRUNCATE_AFTER_HEADING_PATTERNS: readonly RegExp[] = [
  /^#{1,6}\s+Featured Reports\s*$/i,
  /^#{1,6}\s+Subscribe to .{1,80} (?:Briefing|Newsletter|Daily|Weekly)/i,
  /^#{1,6}\s+Related (?:Articles?|Stories?|News)\s*$/i,
];

// Strip cosmetic markdown that wraps a chrome phrase so the boilerplate
// patterns above don't have to enumerate every wrapped variant:
// - `**Subscribe to Trellis Briefing**` → `Subscribe to Trellis Briefing`
// - `Sponsored\\\\` (collapsed-card layout backslashes) → `Sponsored`
// Real article paragraphs aren't usually wrapped in matched emphasis end-to-end,
// so this normalization is safe to apply before the per-line pattern check.
function normalizeForBoilerplateCheck(line: string): string {
  let normalized = line.replace(/\\+$/, '').trim();
  for (;;) {
    const match = /^(\*\*\*|\*\*|__|\*|_)(.+)\1$/.exec(normalized);
    if (!match) return normalized;
    normalized = match[2].trim();
  }
}

function isBoilerplateLine(line: string): boolean {
  const normalized = normalizeForBoilerplateCheck(line);
  // Lines that consist only of emphasis markers and/or trailing backslashes
  // (collapsed-card layout artifacts) normalize to nothing — they carry no
  // content even when the original line had length > 0.
  if (normalized.length === 0) return true;
  return BOILERPLATE_LINE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function findTruncationIndex(lines: readonly string[]): number {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (TRUNCATE_AFTER_HEADING_PATTERNS.some((pattern) => pattern.test(line))) {
      return index;
    }
  }
  return lines.length;
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

  const normalizedLines = withoutTags
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim());

  // Cut at the first publisher-footer heading so the giant Featured Reports
  // sponsored-cards block (Trellis) or newsletter republish (ESG) doesn't end
  // up in the digest. Slicing BEFORE the per-line filter keeps the truncation
  // point stable even if patterns get re-ordered.
  const truncatedLines = normalizedLines.slice(0, findTruncationIndex(normalizedLines));

  const cleanLines = truncatedLines.filter(
    (line) => line.length > 0 && !isBoilerplateLine(line),
  );

  return cleanLines.join('\n\n');
}
