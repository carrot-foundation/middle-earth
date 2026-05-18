# Spike — Step 0 (part 2): Firecrawl anti-rot architecture on ESG News

**Date:** 2026-05-18 · **Account:** Firecrawl Personal · **Tool:** firecrawl-cli 1.16.2 · **Disposable** (no pipeline code touched)

ESG News chosen as the no-auth / no-seat-cap source to validate the brainstorm's anti-rot architecture (`Search` discovery + `/extract` by intent) — the lowest-regret path (Paradox #9), in parallel with resolving the Carbon Pulse seat cap.

## Verdict: ✅ Architecture validated — with a quantified cost knob

| Test | Result | Evidence |
|---|---|---|
| Discovery via `firecrawl search "site:esgnews.com <theme terms>"` | ✅ **PASS — fully layout-resilient** | Returned real article `{title,url,description}` directly (`data.web[]`), ~1.5s, ~2 cr/10 results. No DOM parsing, no selectors → immune to listing redesign. |
| Extraction via `scrape -f json --schema-file` (`/extract` by intent) | ✅ **PASS — perfectly clean** | `{title,author,date,body}` all correct; body = 5,466 chars of clean prose, **0 chrome lines** (no share/newsletter/editorial-bio/related/breadcrumb). Layout-independent. |
| Extraction via plain markdown (`onlyMainContent` default) | ⚠️ **Still dirty** | 25 chrome-marker lines. Confirms brainstorm Robustness #7 — the content-boundary problem persists on the cheap path; `sanitizeArticleText` still needed there. |
| Auth / Cloudflare / seat cap | ✅ **None** | ESG News is open — unlike Carbon Pulse, it is production-ready to migrate now. |

## The cost knob (honest refinement of the brainstorm)

Measured credit cost (Personal account, free tier 1,000/mo):

- `search` (discovery): ~2 cr / 10 results.
- plain markdown `scrape`: ~1 cr / page (but output still chrome-dirty → keep `sanitizeArticleText`).
- `/extract` schema `scrape` (LLM extraction): **~5 cr / article** (~49s) — clean, but the premium path.

Rough monthly extrapolation (real volume ~11 kept/day, ESG ≈ 43%):

- **`/extract` everywhere:** ESG alone ≈ 5 themes × ~2 cr search + ~5 articles × ~5 cr ≈ ~35 cr/day → ~770/mo **ESG only**; adding Carbon Pulse + Trellis → **likely > 1,000/mo → needs a paid tier** (Hobby $16/5k or Standard $83/100k).
- **`search` + markdown + existing `sanitizeArticleText`:** ESG ≈ ~15 cr/day → ~330/mo; all sources together plausibly **< 1,000/mo → fits the free tier**.

So the earlier brainstorm conclusion ("free tier is not the blocker") holds **only for the cheap path**. The cleanest path (`/extract`) revives cost as a real, now-quantified consideration.

## Implications for the brainstorm decision (O3)

- The **anti-rot architecture is proven**: `search`-based discovery kills listing/selector rot entirely; `/extract` kills chrome entirely when used.
- Lowest-regret production design: **`firecrawl search` for discovery + plain markdown `scrape` + keep `sanitizeArticleText`** as the durable chrome barrier (consistent with brainstorm Robustness #7 and prior memory). Reserve `/extract` for sources/pages where markdown+sanitizer is insufficient.
- This **removes per-site CSS selectors** (the main maintenance pain) without the `/extract` credit premium — delivering most of criterion A (less maintenance) while staying in the free tier.
- ESG News (and Trellis, similar) can migrate now; Carbon Pulse remains gated on the subscription seat cap (see `spike-firecrawl-carbon-pulse-2026-05-18.md`).

## Recommended next steps

1. Implement ESG News behind the existing `scrapeEsgNews` interface: `firecrawl search "site:esgnews.com <esgNewsSearchTerms>"` for discovery → `scrape --format markdown` per article → `sanitizeArticleText` → `RawArticle[]`. Keep the orchestrator unchanged.
2. Add a per-run Firecrawl credit budget + alert; throttle to the free-tier 2-concurrent limit.
3. A/B the digest output (Firecrawl-ESG vs Playwright-ESG) for one cycle before cutting over.
4. Carbon Pulse: pursue the seat-cap resolution separately, then re-run its Q3.

## Artifacts

Disposable `/tmp/esg-spike/` (no secrets — public article data only; removed post-spike). Total credits for both spikes (CP + ESG, many iterations): 1,400 → 1,341 ≈ **59 credits**.
