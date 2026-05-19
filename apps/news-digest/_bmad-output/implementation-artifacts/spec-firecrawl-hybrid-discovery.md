# Spec — Hybrid discovery for Firecrawl scrapers (PR #36)

**Date:** 2026-05-19
**Author:** quick-dev session
**Replaces:** Firecrawl `/search` discovery introduced in PRs #31 (ESG News) and #32 (Trellis).
**Status:** Draft — awaiting approval

## Problem

The 2026-05-19 validation runs proved that **Firecrawl `/v2/search` cannot deliver recency** on the publishers we crawl:

| Source | Mechanism | Recall (16-theme test, 30-day window) |
|---|---|---|
| Old Playwright (pre-PRs #31/#32) | navigate site's own `/?s=` page, extract links | prod baseline ~5 ESG + ~1 Trellis per *daily-only* run |
| Firecrawl `/search` (PRs #31/#32) | Google-style web search | 4 ESG + 3 Trellis across **16 themes** (regression) |
| Firecrawl `/search` + `tbs=qdr:m` (PR #34) | recency filter on the search | **0** results — `tbs` is binary-fatal when the upstream index lacks dates, which is exactly the case for `esgnews.com` / `trellis.net` (confirmed via direct API A/B, PR #35 reverted it) |

Root cause of the regression: Firecrawl's `/search` proxies an external web index that does not have machine-readable publish dates for these publishers' permalinks. The old Playwright code never went through that index — it hit each site's own WordPress search page (default sort: date-desc) and read date-ordered links straight from the HTML.

## Goal

Restore the recency the old scrapers had **without bringing Playwright back**. Keep Firecrawl as the fetch layer (it still kills Cloudflare bypass + selector rot on article bodies, the original migration win). Replace only the discovery step.

## Approach: hybrid listing-scrape

For each publisher, **Firecrawl-`scrape` the publisher's own date-ordered listing/search page**, then parse article links out of the returned markdown.

### ESG News

- Per-theme discovery URL: `https://esgnews.com/?s=<URL-encoded theme.esgNewsSearchTerms>`
- WordPress site search; default ordering is publish-date-desc
- Extract markdown links pointing at `esgnews.com` permalinks (exclude tag/category/archive index pages — the same pattern that produced 16 "Missing/invalid publish date" entries before)
- Per chosen candidate: `firecrawlScrape(articleUrl)` → existing freshness filter + `sanitizeArticleText`
- `MAX_ARTICLES_PER_THEME = 2` (unchanged)

### Trellis — per-theme

- Per-theme discovery URL: `https://trellis.net/?s=<URL-encoded theme.trellisSearchTerms>`
- WordPress site search, same recency property
- Extract anchors matching `isTrellisArticleUrl` (in-domain + `/article/` path — unchanged)
- Per chosen candidate: `firecrawlScrape(articleUrl)` → existing freshness + sanitize
- `MAX_ARTICLES_PER_THEME = 1` (unchanged)

### Trellis — curation pool

- Broad pool discovery URL: `https://trellis.net/articles/` (the publisher's full articles index — same URL the old Playwright code used as `LISTING_URL`)
- Single scrape per pipeline run (not per theme)
- Extract `/article/` links; keep `CANDIDATE_POOL_SIZE * 2` over-request
- `curateTrellisArticles` (unchanged), then per-pick `firecrawlScrape`

## Helper to add

`firecrawl.helpers.ts` — one new exported function:

```ts
export function extractMarkdownLinks(
  markdown: string,
  predicate: (link: { url: string; title: string }) => boolean,
): Array<{ url: string; title: string }>
```

- Regex over standard markdown link syntax `[title](url)`
- Trim title; drop empty titles
- Apply `predicate` for host/path filtering (so each scraper keeps its own rules)
- De-dupe by URL preserving first-seen order

Kept narrow on purpose — link extraction is the only generic piece. Per-source predicates (host check, `/article/` path, exclude index pages) stay in the scrapers next to the rest of their domain logic.

## What stays exactly as is

- `firecrawlScrape` (article fetch) — already the right shape; this PR only changes discovery
- `MAX_ARTICLE_AGE_DAYS = 30` freshness filter — still the safety net for any non-recent slip-through
- `sanitizeArticleText` — defense-in-depth on the article body
- Quota / 402 / 429 handling (`break`-keep-partial, `isQuotaError` in Trellis)
- `seenUrls` cross-theme dedup
- `isDuplicateOfCarbonPulse`
- `parseDate` shared helper
- `THEMES_FILTER` env + plumbing (PR #34, retained)
- Substack RSS (no Firecrawl)
- Carbon Pulse Playwright flow (still gated on the seat cap [[news-digest-carbonpulse-login-seatcap]])

## What goes away

- `firecrawlSearch` helper export (no remaining callers after this PR)
- Its tests in `firecrawl.helpers.spec.ts`
- The `/search`-result filter loop in `esg-news.ts` / `trellis.ts`

## Cost model

Per discovery: **1 scrape** (the listing page) — independent of how many candidates it yields. Per article kept: **1 scrape** (the article body). Compared to the `/search` path, the per-discovery cost is identical (1 cr) but recall is recovered.

Projected with this design:

| Scope | Listing scrapes | Article scrapes | ≈ credits |
|---|---|---|---|
| 1 theme | 2 (ESG + Trellis per-theme) + 1 (Trellis curation, shared) | ≤ 2 + ≤ 1 + curated picks (~3) | ~9–11 |
| 5 daily | 5 ESG + 5 Trellis per-theme + 1 curation | ≤ 10 + ≤ 5 + ~5 curated | ~30–35 |
| 16 themes | 16 + 16 + 1 | ≤ 32 + ≤ 16 + ~5 | ~85–100 |

Comfortably inside the 1,000-cr/mo free tier even on prod's 16-theme worst case (~12 cr/day with rotation).

## Risks and mitigations

1. **WordPress `/?s=` returns "no results" HTML pages.** Markdown extraction would yield no `/article/` or `esgnews.com` permalink matches → empty candidate list → `Found 0` log line. Acceptable failure mode (mirrors current "no candidates" outcome) — no scrapes wasted.
2. **Listing markdown carries menu / footer / pagination links.** The predicate-based filter (host + path pattern) handles this — same defense-in-depth as the post-scrape `sanitizeArticleText`.
3. **WordPress search may need a brief JS render.** Firecrawl `/scrape` enables JS rendering by default; if a particular site needs explicit options we add them in the helper. Initial assumption: defaults suffice.
4. **Trellis curation broad pool may return many candidates.** `CANDIDATE_POOL_SIZE * 2 = 30` cap stays; the curator decides which to scrape.
5. **A listing scrape can transient-fail (502 like the validation run saw).** Catch + log + continue; same pattern as the article-scrape failure path already in both scrapers.

## Out of scope

- URL-date pre-filter (`/YYYY/MM/...` permalink pattern) — deferred; not needed if listings are date-ordered.
- Schema-driven `/extract` — premium credits, not justified at current recall expectations.
- Carbon Pulse migration — still gated on the subscription seat cap.

## Tests (Vitest)

- `firecrawl.helpers.spec.ts` — `extractMarkdownLinks`: standard markdown, empty input, no matches, dedup preserving order, predicate-based filtering, malformed markdown safety.
- `esg-news.spec.ts` — mock `fetch` to return a listing-page markdown (real-ish: ~10 article links + menu noise), assert: only article permalinks reach scraping, `MAX_ARTICLES_PER_THEME` cap, freshness + sanitize integration, cross-theme `seenUrls` dedup, `isDuplicateOfCarbonPulse` exclusion.
- `trellis.spec.ts` — same shape for the per-theme path + the curation broad-pool path; quota short-circuit; `isTrellisArticleUrl` filter; curator dedupe.
- All previously green tests must remain green (172 → expected ~175+ post-PR).

## Validation plan

After merge:

1. Rebuild `firecrawl-validation` image from new main.
2. Run isolated ECS task with `THEMES_FILTER="Methane & Super Pollutants"` (`DRY_RUN=true`, throwaway S3 prefix as before).
3. Inspect CloudWatch logs:
   - Listing scrapes succeeded (no 502/404)?
   - `extractMarkdownLinks` produced non-zero candidates?
   - At least one of ESG/Trellis returns ≥ 1 article (the same theme returned 0 with both pre-`tbs` and `tbs` paths — non-zero now is the proof).
4. Spot-check the article content (sanitization quality, dates).
5. Only if green → rebuild `:latest` and ship.

Expected cost of validation: ~9–11 cr.
