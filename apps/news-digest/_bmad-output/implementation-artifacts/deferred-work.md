# Deferred Work

Pre-existing issues surfaced incidentally during review — not caused by the work that exposed them.

## `isDuplicateOfCarbonPulse` heuristic is asymmetric / false-positive-prone

- **Surfaced by:** blind-hunter review of `spec-firecrawl-esgnews-scraper` (2026-05-18).
- **Where:** `apps/news-digest/pipeline/src/scraper/esg-news.ts` (`isDuplicateOfCarbonPulse`) — logic copied verbatim from the original Playwright scraper; **not introduced** by the Firecrawl migration.
- **Issue:** overlap ratio is `overlap / cpWords.size` (coverage of the Carbon Pulse title), not a symmetric/Jaccard similarity. A short CP title (e.g. "Carbon Markets Update") whose long words all appear in a longer, topically-different ESG title yields ratio 1.0 → the ESG article is dropped. Words are filtered to `length > 3`; threshold `>= 0.5`.
- **Suggested fix (later, focused):** use `overlap / Math.min(cpWords.size, esgWords.length)` or a Jaccard ratio, and require `cpWords.size >= 3` before allowing a match. Add a short-CP-title false-positive regression test. Note the same dedup heuristic may exist in other scrapers — fix consistently.
