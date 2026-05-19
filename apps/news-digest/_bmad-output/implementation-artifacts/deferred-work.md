# Deferred Work

Pre-existing issues surfaced incidentally during review — not caused by the work that exposed them.

## `isDuplicateOfCarbonPulse` heuristic is asymmetric / false-positive-prone

- **Surfaced by:** blind-hunter review of `spec-firecrawl-esgnews-scraper` (2026-05-18).
- **Where:** `apps/news-digest/pipeline/src/scraper/esg-news.ts` (`isDuplicateOfCarbonPulse`) — logic copied verbatim from the original Playwright scraper; **not introduced** by the Firecrawl migration.
- **Issue:** overlap ratio is `overlap / cpWords.size` (coverage of the Carbon Pulse title), not a symmetric/Jaccard similarity. A short CP title (e.g. "Carbon Markets Update") whose long words all appear in a longer, topically-different ESG title yields ratio 1.0 → the ESG article is dropped. Words are filtered to `length > 3`; threshold `>= 0.5`.
- **Suggested fix (later, focused):** use `overlap / Math.min(cpWords.size, esgWords.length)` or a Jaccard ratio, and require `cpWords.size >= 3` before allowing a match. Add a short-CP-title false-positive regression test. Note the same dedup heuristic may exist in other scrapers — fix consistently.

## Unbounded scrape attempts per theme (cost ceiling)

- **Surfaced by:** blind/edge review of `spec-firecrawl-trellis-scraper`
  (2026-05-19).
- **Where:** `esg-news.ts` and `trellis.ts` — both iterate up to
  `SEARCH_LIMIT` (10) candidates calling the paid `firecrawlScrape` until
  `MAX_ARTICLES_PER_THEME` *successful* pushes. Worst case (all early
  candidates undated/stale/empty) ≈ 10 paid scrapes/theme.
- **Why deferred:** the cap-on-success behavior is shared by both scrapers
  (intentional parity, itself a #31 review fix). Bounding attempts in Trellis
  only would break parity; do it consistently across esg + trellis as one
  focused change.
- **Suggested fix:** add a per-theme attempt cap
  (e.g. `MAX_ARTICLES_PER_THEME + slack`) applied identically in both scrapers.

## No aggregate failure circuit-breaker before curation

- **Surfaced by:** blind/edge review of `spec-firecrawl-trellis-scraper`
  (2026-05-19).
- **Where:** `trellis.ts` `scrapeTrellis` — if every per-theme search fails
  with non-quota errors (provider degraded), the code still proceeds to
  `collectCandidates` + the Anthropic curation call. (Quota 402/429 is already
  short-circuited; this is the non-quota all-fail case.) Pre-existing
  structural pattern from the Playwright version.
- **Suggested fix:** track per-theme failure count; skip curation if all
  themes failed.

## `parseDate` UTC-slice off-by-one at the freshness boundary

- **Surfaced by:** blind/edge review (2026-05-19) — not a Trellis regression.
- **Status update (#32):** the duplicated per-scraper `parseDate` was extracted
  to the shared `helpers/date.helpers.ts` (esg-news + trellis now import it),
  so this is now fixable in **one place** rather than "esg + trellis together".
- **Issue:** a timezone-shifted publish time can shift the UTC-sliced date by a
  day, flipping inclusion at exactly `MAX_ARTICLE_AGE_DAYS`.
- **Suggested fix:** in `helpers/date.helpers.ts`, compare timestamps from the
  raw published time instead of round-tripping through a UTC date-only string;
  add 29/30/31-day boundary tests in `date.helpers.spec.ts`.
