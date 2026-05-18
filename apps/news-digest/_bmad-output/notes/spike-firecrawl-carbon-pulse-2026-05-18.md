# Spike — Step 0: Firecrawl C-B feasibility on Carbon Pulse

**Date:** 2026-05-18 · **Account:** Firecrawl Personal (1,400 cr) · **Tool:** firecrawl-cli 1.16.2 · **Disposable** (no pipeline code touched)

Gate question (from `brainstorming-session-2026-05-18-1511.md`): can Firecrawl do C-B for Carbon Pulse — `Interact` login **behind Cloudflare** + hold session + `/extract` — within free-tier cost and the run window?

## Verdict: Firecrawl tech ✅ — blocked by a Carbon Pulse **account seat limit**, not by Firecrawl

| Gate sub-question | Result | Evidence |
|---|---|---|
| Q1 — Cloudflare bypass | ✅ **PASS** | `scrape https://carbon-pulse.com/login/ --profile` → HTTP 200, real login form, ~4s, ~1 cr. No residential proxy. This is exactly where prod Playwright is fragile. |
| Q2 — Login automation | ✅ **PASS (technically)** | Real URM form selectors are `#username` / `#password` / `[name=login]` (not WP defaults). With correct selectors Firecrawl filled + submitted the membership login correctly. |
| Q3 — Authenticated session/content | ❌ **BLOCKED — by account licensing, not Firecrawl** | Login rejected with: *"Maximum number of active logins found for the account … please logout from another device to continue."* The CP subscription enforces a **max concurrent active-logins cap** that is already saturated (prod Playwright pipeline / lingering sessions / human use). |
| Cost | ✅ **Negligible** | Whole messy spike (≈8 scrapes + screenshots + 2 `interact` sessions + iterations) = **49 credits** of 1,400. Steady-state would be a fraction. Free-tier is decisively not the constraint. |

## Key findings

1. **Firecrawl is technically sound for Carbon Pulse.** Cloudflare bypass is clean and fast with no proxy; `--profile` persists session; `--actions`/`interact` drive the login. The Playwright-CP fragility (CF timeout) does not reproduce on Firecrawl.
2. **The real blocker is a Carbon Pulse subscription constraint** — a concurrent-login seat cap on the shared account — which is **independent of Firecrawl** and also implicitly constrains the current pipeline. You cannot run Playwright-CP and Firecrawl-CP in parallel on the same account (migration constraint), and Firecrawl-CP alone still competes with humans/other sessions for seats.
3. **URM form selectors documented** for the eventual implementation: username `#username`, password `#password`, submit `[name="login"]`; search/discovery form is `#search-filter-form-1438` (`?sfid=1438`), consistent with the prod scraper's `?sfid=1438&_sf_s=` URL.
4. **Credential handling reality (C-B trust note):** C-B sends the Carbon Pulse credentials to Firecrawl's cloud browser to perform the login. Acceptable for a spike; for production it is a third-party-trust decision to record.

## Impact on the brainstorm decision

The GO / target-O3 decision **stands**. The gate is **refined**: the true prerequisite for C-B on Carbon Pulse is **resolving the CP concurrent-login seat limit** (a procurement/ops action — dedicated automation seat, higher concurrent-login tier, or strict session coordination), **not** "does Firecrawl work" (it does).

## Recommended next steps

1. **Unblock CP account:** get a dedicated login seat for automation (or raise the concurrent-login tier / coordinate logout). Procurement/ops task — owner needed.
2. **Re-run Q3 in a free-seat window:** pause the prod scraper briefly (or after other devices log out) and validate the full chain: profile login → `Search`/`?sfid=1438` discovery → `/extract` schema → content cleanliness vs Playwright + `sanitizeArticleText`.
3. **Parallelise via Paradox #9:** validate `Search` + `/extract` on **ESG News first** (no auth, no seat limit) — proves the anti-rot architecture cheaply and immediately while the CP account issue is resolved in parallel. This is the lowest-regret path and is consistent with the brainstorm's own de-risking insight.

## Artifacts

Disposable working dir `/tmp/cp-spike/` (password-bearing action files deleted post-spike). No production state or pipeline code modified. Firecrawl sessions stopped.
