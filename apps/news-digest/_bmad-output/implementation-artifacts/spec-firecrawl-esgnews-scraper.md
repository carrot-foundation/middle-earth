---
title: 'Migrate ESG News scraper from Playwright to Firecrawl'
type: 'feature'
created: '2026-05-18'
status: 'done'
baseline_commit: '0b738c4d4b67e5353ebca1715bdaeedbc1f59168'
context:
  - '{project-root}/apps/news-digest/_bmad-output/notes/spike-firecrawl-esgnews-2026-05-18.md'
  - '{project-root}/apps/news-digest/_bmad-output/project-context.md'
---

# Migrate ESG News scraper from Playwright to Firecrawl

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The ESG News scraper uses Playwright with hand-written CSS selectors (`article a`, `time`, `.author`) that break whenever the site changes layout, causing recurring reactive maintenance. ESG News is ~43% of digest volume.

**Approach:** Replace Playwright with Firecrawl HTTP API (validated in the Step 0 spike): `search` for layout-resilient discovery, `scrape` (markdown) for content, keeping the existing `sanitizeArticleText` barrier. No auth/seat-cap on ESG News, so it is migratable now (Carbon Pulse and Trellis are out of scope).

## Boundaries & Constraints

**Always:** Preserve the `RawArticle` output shape and orchestrator resilience contract (a scraper failure must not crash the pipeline). Keep `sanitizeArticleText` as the defense-in-depth barrier. Keep `MAX_ARTICLES_PER_THEME`, `MAX_ARTICLE_AGE_DAYS`, the Carbon-Pulse dup-title filter, `processedUrls` filtering, and the empty-after-sanitize skip. Firecrawl called via `fetch` mirroring `src/ai/article-processor.ts` (try/catch, check `response.ok`). Firecrawl API v2.

**Ask First:** Making `FIRECRAWL_API_KEY_SECRET_ARN` a *required* env var (would break the deployed pipeline before the secret exists). Default: make it optional.

**Never:** Touch Carbon Pulse (blocked on a subscription seat cap), Substack (stays RSS), or Trellis. No Firecrawl CLI in production code. No real network in tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | theme with results, fresh article | `RawArticle` with sanitized `fullContent`, `source:'esgnews'` | N/A |
| Already processed | result url in `processedUrls` | skipped | N/A |
| CP duplicate | title ≥50% word overlap with a `cpTitles` entry | skipped | N/A |
| Stale article | published > `MAX_ARTICLE_AGE_DAYS` ago | skipped | N/A |
| Chrome-only page | scrape markdown sanitizes to `''` | skipped (no empty article) | N/A |
| Search API failure | non-2xx / network error from `/v2/search` | theme yields 0 articles, continue other themes | logged, no throw past theme loop |
| Scrape API failure | non-2xx / network error from `/v2/scrape` | that article skipped | logged per-article |
| Missing API key | firecrawl key empty | `scrapeEsgNews` throws once; orchestrator try/catch logs it, pipeline continues | non-breaking |

</frozen-after-approval>

## Code Map

- `apps/news-digest/pipeline/src/scraper/esg-news.ts` -- rewrite: Playwright → Firecrawl search+scrape
- `apps/news-digest/pipeline/src/helpers/firecrawl.helpers.ts` -- NEW: `firecrawlSearch`/`firecrawlScrape` fetch wrappers (reusable for later Trellis migration)
- `apps/news-digest/pipeline/src/config.schema.ts` -- add optional `FIRECRAWL_API_KEY_SECRET_ARN` to `envSchema`
- `apps/news-digest/pipeline/src/types.ts` -- add `firecrawlApiKey: string` to `Secrets`
- `apps/news-digest/pipeline/src/main.ts` -- conditionally load firecrawl secret in `loadSecrets`
- `apps/news-digest/pipeline/src/orchestrator.ts` -- pass `config.secrets.firecrawlApiKey` to `scrapeEsgNews` (one call site)
- `apps/news-digest/pipeline/src/scraper/__tests__/esg-news.spec.ts` -- rewrite: mock `fetch`
- `apps/news-digest/pipeline/src/helpers/__tests__/firecrawl.helpers.spec.ts` -- NEW

## Tasks & Acceptance

**Execution:**
- [x] `src/helpers/firecrawl.helpers.ts` -- add `firecrawlSearch(query, apiKey)` → `{url,title}[]` from `data.web[]`, and `firecrawlScrape(url, apiKey)` → `{markdown, publishedTime, author}` from `data.markdown`/`data.metadata`; throw typed `FirecrawlError` on missing key or non-2xx
- [x] `src/scraper/esg-news.ts` -- rewrote `scrapeEsgNews(themes, processedUrls, cpTitles, firecrawlApiKey)`: per theme `firecrawlSearch("site:esgnews.com "+esgNewsSearchTerms)`; reused filter/dedup/age/sanitize logic; date from scrape metadata `article:published_time` else today; per-theme + per-article try/catch
- [x] `src/config.schema.ts` / `src/types.ts` / `src/main.ts` -- optional `FIRECRAWL_API_KEY_SECRET_ARN`; `Secrets.firecrawlApiKey`; conditional fetch (empty string if ARN unset)
- [x] `src/orchestrator.ts` -- passes `config.secrets.firecrawlApiKey` into `scrapeEsgNews` (one call site)
- [x] `src/scraper/__tests__/esg-news.spec.ts` + `src/helpers/__tests__/firecrawl.helpers.spec.ts` -- every I/O Matrix row covered with `fetch` mocked

**Acceptance Criteria:**
- Given the firecrawl key is unset, when the pipeline runs, then ESG News logs an error and the rest of the pipeline still completes (no crash).
- Given Firecrawl returns results, when `scrapeEsgNews` runs, then returned articles are identical in shape to the previous Playwright output (same `RawArticle` fields, sanitized content) and `orchestrator.ts` needs no logic change beyond passing the key.
- Given the full suite, when `npx vitest run` executes in `apps/news-digest/pipeline`, then all tests pass with no real network.

## Design Notes

Firecrawl v2 (validated in spike): `POST https://api.firecrawl.dev/v2/search` `{query,limit}` → `{data:{web:[{url,title,description}]}}`; `POST https://api.firecrawl.dev/v2/scrape` `{url,formats:["markdown"],onlyMainContent:true}` → `{data:{markdown,metadata}}`. Auth: `Authorization: Bearer <key>`. Cost note (spike): plain markdown scrape ≈1cr (kept), `/extract` not used here (premium). Deploy gate: the `news-digest/firecrawl-api-key` secret is not yet provisioned in AWS — code ships deployable; infra/secret is a separate prerequisite.

## Verification

**Commands:**
- `cd apps/news-digest/pipeline && npx vitest run` -- ✅ 152/152 passed (17 files; +6 review-driven tests; no regressions)
- `pnpm nx build news-digest-pipeline` -- ✅ esbuild bundle succeeded
- `pnpm nx lint news-digest-pipeline` -- ⚠️ NOT RUNNABLE in this environment: nx fails with `Unable to resolve @nx/linter:eslint`; direct `eslint` reports these paths as `File ignored because of a matching ignore pattern`; the `oxlint` target has no config. Pre-existing tooling state, unrelated to this change. Conventions followed manually (ESM `.js` imports, explicit return types, `readonly`, mirrors `ai/article-processor.ts`). Commit-time `cspell`/`commitlint` hooks still apply.

## Suggested Review Order

**Firecrawl client (design entry point)**

- Start here: the v2 `fetch` client + typed error — the whole design pivots on this
  [`firecrawl.helpers.ts:84`](../../pipeline/src/helpers/firecrawl.helpers.ts#L84)
- Resilience core: AbortSignal timeout, network-error + non-JSON wrapping into `FirecrawlError`
  [`firecrawl.helpers.ts:43`](../../pipeline/src/helpers/firecrawl.helpers.ts#L43)
- `FirecrawlError` carries `status` so callers can act on 402/429
  [`firecrawl.helpers.ts:16`](../../pipeline/src/helpers/firecrawl.helpers.ts#L16)

**ESG News scraper rewrite**

- New discovery+extract loop replacing Playwright; same `RawArticle` contract
  [`esg-news.ts:28`](../../pipeline/src/scraper/esg-news.ts#L28)
- Freshness fix: skip undated articles instead of stamping "today" (carbon-pulse parity)
  [`esg-news.ts:57`](../../pipeline/src/scraper/esg-news.ts#L57)
- Quota/rate-limit (402/429) aborts the theme rather than burning the loop
  [`esg-news.ts:88`](../../pipeline/src/scraper/esg-news.ts#L88)
- `sanitizeArticleText` retained as the defense-in-depth barrier
  [`esg-news.ts:68`](../../pipeline/src/scraper/esg-news.ts#L68)
- Missing-key throws once → orchestrator try/catch keeps the pipeline alive
  [`esg-news.ts:104`](../../pipeline/src/scraper/esg-news.ts#L104)

**Secret wiring (deploy-gate safety)**

- Optional ARN — does not break the deployed pipeline before the secret exists
  [`config.schema.ts:31`](../../pipeline/src/config.schema.ts#L31)
- Conditional load, empty-string sentinel when unset
  [`main.ts:34`](../../pipeline/src/main.ts#L34)
- One-line call-site change in the orchestrator
  [`orchestrator.ts:247`](../../pipeline/src/orchestrator.ts#L247)
- `Secrets` type addition
  [`types.ts:98`](../../pipeline/src/types.ts#L98)

**Tests (peripherals)**

- Client: request contract (v2 URL/Bearer/body), non-2xx, non-JSON, network error
  [`firecrawl.helpers.spec.ts:1`](../../pipeline/src/helpers/__tests__/firecrawl.helpers.spec.ts#L1)
- Scraper: all 8 I/O-matrix rows + cap + undated-skip + 402-abort, `fetch` mocked
  [`esg-news.spec.ts:1`](../../pipeline/src/scraper/__tests__/esg-news.spec.ts#L1)
