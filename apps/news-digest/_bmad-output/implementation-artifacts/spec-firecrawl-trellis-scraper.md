---
title: 'Migrate Trellis scraper from Playwright to Firecrawl'
type: 'feature'
created: '2026-05-19'
status: 'done'
baseline_commit: '6d92aeb40ad459d26800fbf5dcbc35ab318c0478'
context:
  - '{project-root}/apps/news-digest/_bmad-output/notes/spike-firecrawl-esgnews-2026-05-18.md'
  - '{project-root}/apps/news-digest/_bmad-output/implementation-artifacts/spec-firecrawl-esgnews-scraper.md'
  - '{project-root}/apps/news-digest/_bmad-output/project-context.md'
---

# Migrate Trellis scraper from Playwright to Firecrawl

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Trellis scraper uses Playwright + CSS selectors (`a[href*="/article/"]`, `.post-content`, listing-card probing) across two flows — per-theme search and an AI-curated homepage/listing pool — and breaks on layout change (same scraper-rot pain as ESG News). ~7% of digest volume.

**Approach:** Replace Playwright with the shared Firecrawl client (`firecrawl.helpers.ts`, already on this branch from the stacked ESG PR #31). Per-theme flow mirrors the ESG migration. Curation flow: build the `TrellisCandidate[]` pool from Firecrawl `search` (description ⇒ excerpt) instead of listing-DOM scraping; keep `curateTrellisArticles` (Claude) unchanged; scrape + sanitize each pick. Add `sanitizeArticleText` (Trellis lacks it today — defense-in-depth per brainstorm Robustness #7).

## Boundaries & Constraints

**Always:** Preserve `RawArticle` shape, orchestrator resilience (a scraper failure must not crash the pipeline), and the curation flow's existing failure-tolerance (curator/API failure ⇒ `curated = []`, per-theme continues). Keep `MAX_ARTICLES_PER_THEME` (1), `MAX_ARTICLE_AGE_DAYS` (30), `CANDIDATE_POOL_SIZE` (15), `processedUrls` + per-theme-pick exclusion, skip-undated (parity with esg/carbon-pulse), and 402/429-aborts-theme (same `FirecrawlError` handling as `esg-news.ts`). Reuse `firecrawl.helpers.ts`. `firecrawlApiKey` threaded exactly like `esg-news.ts`.

**Ask First:** None expected. Default decisions (documented in Design Notes): (a) extend `firecrawlSearch` to also return `description` (backward-compatible — ESG unaffected); (b) candidates carry `excerpt` from search `description` and `date = ''` — no per-candidate metadata scrape (15×/run is too costly per the spike); freshness enforced only at the curated-pick scrape.

**Never:** Touch ESG News, Carbon Pulse, Substack, or `ai/trellis-curator.ts` (decoupled — stays as-is). No per-candidate metadata scrapes. No Firecrawl CLI in product code. No real network in tests. No new secret wiring (already in place from #31).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Theme happy path | theme search hit, fresh dated article | one `RawArticle` (`source:'trellis'`), sanitized body | N/A |
| Already processed | url in `processedUrls` | skipped (no scrape) | N/A |
| Undated pick | scrape metadata has no publish date | skipped | N/A |
| Stale article | published > 30d | skipped | N/A |
| Chrome-only page | scrape markdown sanitizes to `''` | skipped | N/A |
| Theme search failure | non-2xx/network on `/v2/search` | theme yields 0, other themes continue | logged, no throw past theme loop |
| Article scrape failure | non-2xx/network on `/v2/scrape` | that article skipped | logged per-article |
| Quota/limit (402/429) | Firecrawl quota or rate limit | aborts the theme | `FirecrawlError` rethrown to theme handler |
| Curation pool | search returns N web results | up to 15 `TrellisCandidate` {url,title,excerpt=description,date:''}, excluding processed + per-theme picks | empty pool ⇒ skip curation (existing log) |
| Curator picks | `curateTrellisArticles` returns picks | each pick scraped+sanitized → `RawArticle` with curator `mainTheme` | curator/API failure ⇒ `curated=[]`, pipeline continues |
| Missing API key | firecrawl key empty | `scrapeTrellis` throws once; orchestrator try/catch logs it, pipeline continues | non-breaking |

</frozen-after-approval>

## Code Map

- `apps/news-digest/pipeline/src/scraper/trellis.ts` -- rewrite: Playwright → Firecrawl (both flows)
- `apps/news-digest/pipeline/src/helpers/firecrawl.helpers.ts` -- extend `firecrawlSearch` result with optional `description` (backward-compatible)
- `apps/news-digest/pipeline/src/ai/trellis-curator.ts` -- UNCHANGED (decoupled; consumes `TrellisCandidate[]`)
- `apps/news-digest/pipeline/src/orchestrator.ts` -- pass `config.secrets.firecrawlApiKey` to `scrapeTrellis` (one call site)
- `apps/news-digest/pipeline/src/scraper/__tests__/trellis.spec.ts` -- rewrite: mock `fetch`, stub curator boundary
- `apps/news-digest/pipeline/src/helpers/__tests__/firecrawl.helpers.spec.ts` -- update for `description` field

## Tasks & Acceptance

**Execution:**
- [x] `src/helpers/firecrawl.helpers.ts` -- add `description: string` to `FirecrawlSearchResult` (from `data.web[].description`, default `''`); keep url/title filtering
- [x] `src/scraper/trellis.ts` -- rewrite `scrapeTrellis(themes, processedUrls, anthropicApiKey, firecrawlApiKey)`: theme flow via `firecrawlSearch("site:trellis.net "+trellisSearchTerms)` + `firecrawlScrape` + `sanitizeArticleText`; curation flow builds pool from `firecrawlSearch` (broad recent trellis.net query, `description`⇒excerpt, `date:''`), keeps `curateTrellisArticles`, scrapes+sanitizes picks; preserve filters/limits/skip-undated/402-abort; per-theme + per-article + curation-flow try/catch
- [x] `src/orchestrator.ts` -- pass `config.secrets.firecrawlApiKey` into `scrapeTrellis`
- [x] `src/scraper/__tests__/trellis.spec.ts` + `src/helpers/__tests__/firecrawl.helpers.spec.ts` -- cover every I/O Matrix row; `fetch` mocked; curator mocked at module boundary
**Acceptance Criteria:**
- Given the firecrawl key is unset, when the pipeline runs, then Trellis logs an error and the rest of the pipeline still completes (no crash).
- Given Firecrawl returns theme + pool results, when `scrapeTrellis` runs, then output is `RawArticle[]` identical in shape to the Playwright version, the curator is invoked with `TrellisCandidate[]` (excerpt from search description), and `orchestrator.ts` changes by exactly one argument.
- Given the suite, when `npx vitest run` runs in `apps/news-digest/pipeline`, then all tests pass with no real network.

## Design Notes

`curateTrellisArticles` is fully decoupled (`TrellisCandidate{url,title,date,excerpt}` → `CuratedPick[]`); it stays byte-for-byte unchanged. Candidate `date` was previously read from listing DOM or a per-article meta fetch; replicating that with Firecrawl means 15 scrapes/run (~15cr) — rejected on cost (spike). Instead candidates carry `date:''`; the curator still ranks on title+excerpt (its prompt prefers recency only "when relevance is similar"), and freshness is strictly enforced at the curated-pick `firecrawlScrape` (metadata `article:published_time` → skip-undated + 30d age check, same as ESG). Curation pool query: a broad recency-biased `site:trellis.net` sustainability/climate query (the curator assigns themes afterward), `limit = CANDIDATE_POOL_SIZE`. `firecrawlSearch` gains an optional `description` (Firecrawl `data.web[].description`); ESG ignores it (backward-compatible) but its existing test asserting `toEqual` must be updated to include the new field.

_Clarification (post-#31 review):_ the binding rule "same FirecrawlError handling as esg-news.ts" now resolves to **break-and-keep-partial** on 402/429 (esg-news.ts was changed in PR #31 review from `throw` to `break`, preserving already-collected articles). The frozen I/O-matrix wording "FirecrawlError rethrown to theme handler" is superseded by this — mirror the *current* esg-news.ts (break, keep partial; also adopt its `URL().hostname` domain check and cap-on-successful-extractions loop). Reusing `firecrawlSearch` also means ESG's `firecrawl.helpers.spec.ts` "maps data.web" test must be updated for the new `description` field.

## Verification

**Commands:**
- `cd apps/news-digest/pipeline && npx vitest run` -- ✅ 155/155 passed (17 files; +3 review-driven tests), no real network
- `pnpm nx build news-digest-pipeline` -- ✅ esbuild bundle succeeded
- `pnpm nx lint news-digest-pipeline` -- known NOT runnable in this env (pre-existing nx/eslint tooling); conventions followed manually

## Review Outcome (step-04)

3-agent adversarial review (blind / edge-case / acceptance). Acceptance auditor: full PASS, no spec deviations, no loopback. Patches applied (no spec change): P1 quota short-circuits theme loop **and** curation (was one-frame-deep); P2 excerpt cap (`MAX_EXCERPT_LENGTH`) + title fallback; P3 over-request pool (`*2`) so host/exclude filtering still reaches 15; P4 `isTrellisArticleUrl` requires in-domain host **and** `/article/` path (SSRF-surface + parity); P5 dedupe repeated curator picks. +3 regression tests (P6). Deferred (shared with esg-news, parity): unbounded scrape attempts/theme, aggregate non-quota circuit-breaker, `parseDate` UTC-slice boundary — see `deferred-work.md`.

## Suggested Review Order

**Firecrawl client extension**

- Backward-compatible `description` added for the curation excerpt; ESG unaffected
  [`firecrawl.helpers.ts:29`](../../pipeline/src/helpers/firecrawl.helpers.ts#L29)

**Trellis scraper — entry point & flows**

- Start here: the two-flow orchestration (per-theme → quota gate → curation)
  [`trellis.ts:158`](../../pipeline/src/scraper/trellis.ts#L158)
- Quota short-circuit: theme loop AND curation skipped on 402/429 (review P1)
  [`trellis.ts:188`](../../pipeline/src/scraper/trellis.ts#L188)
- Per-theme flow: search → cap-on-success → scrape; mirrors esg-news.ts
  [`trellis.ts:92`](../../pipeline/src/scraper/trellis.ts#L92)
- Shared scrape+freshness+sanitize barrier (skip-undated parity)
  [`trellis.ts:50`](../../pipeline/src/scraper/trellis.ts#L50)
- Curation pool from search (excerpt=description capped, date:''); curator untouched
  [`trellis.ts:132`](../../pipeline/src/scraper/trellis.ts#L132)
- Curated-pick dedupe + per-pick quota break (review P5)
  [`trellis.ts:203`](../../pipeline/src/scraper/trellis.ts#L203)
- Article-URL hardening: in-domain host + `/article/` path (review P4)
  [`trellis.ts:26`](../../pipeline/src/scraper/trellis.ts#L26)

**Wiring & tests (peripherals)**

- One-line orchestrator call-site change (firecrawlApiKey threaded like esg-news)
  [`orchestrator.ts:257`](../../pipeline/src/orchestrator.ts#L257)
- Scraper tests (both flows, all I/O rows + 3 review-driven), curator mocked, fetch mocked
  [`trellis.spec.ts:1`](../../pipeline/src/scraper/__tests__/trellis.spec.ts#L1)
