---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Adopting Firecrawl in the news-digest pipeline to crawl/scrape news (replace or augment the Playwright-based scrapers)'
session_goals: 'Reach a go/no-go decision on adopting Firecrawl and the integration approach (full replace vs hybrid-by-source vs only where Playwright struggles)'
selected_approach: 'ai-recommended'
techniques_used: ['Assumption Reversal', 'Morphological Analysis', 'Solution Matrix']
ideas_generated: 9
decision: 'GO — target O3 (Firecrawl everywhere except Substack RSS), gated by a Carbon Pulse C-B feasibility spike'
session_active: false
workflow_completed: true
context_file: 'apps/news-digest/_bmad-output/project-context.md (informal grounding)'
---

# Brainstorming Session Results

**Facilitator:** Antonio Marcos
**Date:** 2026-05-18

## Session Overview

**Topic:** Adopting Firecrawl (https://docs.firecrawl.dev/introduction) in the `news-digest` pipeline to crawl/scrape news — potentially replacing or augmenting the current Playwright-based scrapers (Carbon Pulse, ESG News, Trellis, Substack).

**Goals:** Reach a **go/no-go decision** on adopting Firecrawl in news-digest and the **integration approach** — full replacement of Playwright scrapers vs. hybrid (Firecrawl for some sources, keep others) vs. Firecrawl only where Playwright is fragile. Output: a clear recommendation.

### Context Guidance

Grounded informally on `apps/news-digest/_bmad-output/project-context.md`. Relevant facts: the pipeline runs on ECS Fargate (Playwright + Xvfb in a heavy `mcr.microsoft.com/playwright` image); scrapers are fragile (DOM rot; Carbon Pulse login times out intermittently; listing/ticker pages leak as articles); `sanitizeArticleText` is the single defense-in-depth barrier; Carbon Pulse requires authenticated login (secrets) + proxy; Substack is already RSS (no browser needed). Firecrawl free tier = 1000 pages.

### Session Setup

- **Desired outcome:** go/no-go decision + integration approach.
- **Technique approach:** AI-Recommended (facilitator selects techniques fit to a technical decision with convergence at the end).

### Grounding facts (verified 2026-05-18)

- **Firecrawl surfaces:** Scrape, Search, Crawl, Map, Interact (clicks/forms/login via prompt), Agent (autonomous). Output markdown/JSON, JS rendering + anti-bot/proxy built in, Node SDK + MCP server.
- **Free tier:** 1,000 credits/month (no rollover), 2 concurrent requests, low rate limits. Scrape/Crawl = 1 cr/page; Search = 2 cr/10 results; Interact = 2 cr/browser-min.
- **news-digest today:** runs 1×/day, ~28–66 articles/run → ~33 pages/day budget from the free tier. Sources: Carbon Pulse (authenticated login + proxy, fragile Playwright), ESG News (Playwright), Trellis (Playwright + AI), Substack (already RSS — no browser).

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** go/no-go on Firecrawl in news-digest + integration approach.

**Recommended Techniques:**

- **Assumption Reversal (deep):** invert the participant's two strong priors ("it will improve a lot", "1000 free pages is enough") to surface the real risk/opportunity space.
- **Morphological Analysis (deep):** decompose into source × method and enumerate the full replace/hybrid/surgical landscape without bias.
- **Solution Matrix (structured):** score candidate approaches against weighted criteria → produce the go/no-go recommendation.

**AI Rationale:** Decision-oriented technical session; needs targeted divergence on assumptions, systematic option mapping, then convergence to a defensible recommendation with a concrete next step.

---

## Phase 1 — Assumption Reversal

### Real data pulled (prod S3 `processed-articles.json`, 2026-05-18)

- 495 kept articles over 90-day retention. **Avg ~11 kept/day** (range 3–11 normal; spikes 23–27 on weekly-theme days). ~240 kept/month.
- Source split: carbon-pulse 225 (45%), esgnews 214 (43%), trellis 33 (7%), a16z-crypto/Substack 23 (5%).
- Theme cadence confirmed: 5 daily (every run), 9 weekly (~7d), 2 monthly (~30d). Weekly-theme days are the volume spikes.
- **Correction:** the earlier "~28–66 articles/day → free tier is the blocker" framing was wrong. 28 was an outlier-high fast validation run; 66 was unverified. Real volume is far lower.

### Ideas generated

**[Viability #1]: Free-tier blocker is NOT raw volume**
_Concept:_ ~240 kept/month sits well under 1,000 credits/month even with discovery + dedup-dropped overhead. The volume-ceiling argument collapses against real data.
_Novelty:_ inverts the participant's risk: the constraint was assumed to be page count; data shows it isn't.

**[Viability #2]: The real cost risk is Carbon Pulse auth via `Interact`**
_Concept:_ Carbon Pulse (45% of articles) needs an authenticated login. Firecrawl bills `Interact` at 2 credits/browser-minute; a multi-step login per run could dwarf article-scrape credits and is unpredictable.
_Novelty:_ relocates the cost question from "how many articles" to "how expensive is the one authenticated source" — a completely different decision driver.

**[Viability #3]: Free-tier concurrency (2) clashes with the pipeline (AI_CONCURRENCY 5)**
_Concept:_ Firecrawl free = 2 concurrent requests + low rate limits. The pipeline scrapes/processes in batches of 5. Firecrawl would force serialization or careful throttling, lengthening run time.
_Novelty:_ surfaces a non-obvious operational constraint independent of price/volume.

**[Viability #4]: Substack must stay RSS — never touch Firecrawl**
_Concept:_ Substack (5%) is already a clean RSS feed, zero browser. Routing it through Firecrawl spends credits to make clean data dirtier.
_Novelty:_ a "do-nothing" zone — the inversion shows part of "use Firecrawl for the news" is pure waste by design.

### Core assumption clarified by participant

The real driver is **NOT** cost or infra — it is **eliminating reactive maintenance**: today the code needs hand-fixing every time a source changes layout / ships dynamic HTML / adds Cloudflare. The load-bearing assumption is **A1′: "Firecrawl makes the crawl self-defending against layout change / dynamic HTML / Cloudflare, so maintenance drops."**

**🔄 Inversion of A1′ — "Firecrawl does NOT remove scraper rot; it relocates it"**

**[Robustness #5]: Selector brittleness genuinely dies (biggest real win)**
_Concept:_ Firecrawl returns clean markdown of any page regardless of DOM, with built-in anti-bot/proxy/stealth for Cloudflare. Hand-written CSS selectors (`.article-body`) and the Cloudflare-challenge firefighting — the actual recurring pain — largely disappear.
_Novelty:_ confirms the participant's intuition is right *for the specific pain they named* (selectors + Cloudflare), not for "scraping" in general.

**[Robustness #6]: Rot relocates to discovery, not extraction**
_Concept:_ You still must find *which* URLs are today's per-theme articles. Scraping a listing page as markdown still needs parsing that can break on listing redesigns. The resilient mechanism is `Search` (results as data) or `/extract` with a JSON schema (LLM extraction by intent, not selector).
_Novelty:_ reframes the design from "replace the scraper" to "replace selector-extraction with **schema/LLM extraction + Search-based discovery**" — that is the actual anti-rot architecture.

**[Robustness #7]: The content-boundary problem persists → `sanitizeArticleText` stays**
_Concept:_ Full-page markdown still carries nav/footer/related/newsletter chrome. `onlyMainContent`/`/extract` mitigate but don't eliminate it. The existing defense-in-depth barrier remains the durable safety net regardless of crawler.
_Novelty:_ kills the "Firecrawl makes the sanitizer obsolete" sub-assumption — consistent with prior project memory on scraper rot.

**[Robustness #8]: Maintenance is converted, not deleted (new vendor surface)**
_Concept:_ "Fix CSS after every layout change" becomes "maintain extraction schema/prompt + manage Firecrawl quota/version/outage." Net maintenance delta is favorable for the named pain but non-zero; a new external dependency/failure mode appears.
_Novelty:_ honest net: substantial reduction, not magic — the decision variable is the *maintenance delta*, not "maintenance → 0".

**Phase 1 close:** Participant confirms the target architecture is **schema/LLM extraction (`/extract`) + `Search` discovery** (not raw page-scrape), and the first target is **Carbon Pulse** (most maintenance pain: login + Cloudflare, 45% of volume).

---

## Phase 2 — Morphological Analysis (focused: Carbon Pulse)

**[Paradox #9]: The worst-pain source is also the worst-fit for Firecrawl**
_Concept:_ Carbon Pulse is picked because it hurts most — but it is the single hardest case for Firecrawl too: authenticated login *behind* Cloudflare, plus session/cookie continuity from login → article fetches, plus `Interact` billing (2 cr/browser-min) on every run's login. ESG News (no auth) is where Firecrawl most cleanly shines.
_Novelty:_ the rational de-risking order may be inverted from the pain order — proving Firecrawl on the *easy* source first (ESG News) validates the architecture cheaply; proving it on Carbon Pulse first is high-information but high-risk-of-disappointment.

### Source × Method matrix — Carbon Pulse

| Parameter | Options |
|---|---|
| **Discovery** | keep Playwright listing · Firecrawl `Search` (site-scoped query) · Firecrawl `Map` · Firecrawl `Crawl` |
| **Auth** | Firecrawl `Interact` (NL login each run) · inject pre-obtained session cookie · Playwright logs in → hand cookie to Firecrawl · drop auth (free/teaser content only) |
| **Extraction** | Firecrawl `/extract` + JSON schema (anti-rot) · Firecrawl scrape `onlyMainContent` + `sanitizeArticleText` · keep current Playwright extraction |
| **Safety net** | keep Playwright CP path as fallback · no fallback (Firecrawl only) |

_Combinations under evaluation:_

- **C-A (low-risk hybrid):** Playwright keeps the login (already works) → pass authenticated session/cookie to Firecrawl → Firecrawl `Search`/`Map` for discovery + `/extract` schema for content → keep Playwright CP as fallback. Kills selector+Cloudflare rot, avoids `Interact` login billing, lowest disappointment risk.
- **C-B (full Firecrawl):** Firecrawl `Interact` does login + `Search` + `/extract`, no Playwright for CP. Maximum simplification, but highest cost (Interact/run) and highest "does it actually hold the session?" risk.
- **C-C (validate elsewhere first):** Prove `Search`+`/extract` on **ESG News** (no auth) first; apply the proven pattern to Carbon Pulse only after the architecture is de-risked.

**Participant decision:** go with **C-B** (full Firecrawl on Carbon Pulse — `Interact` login + `Search` + `/extract`, no Playwright for CP), accepting the risk. Criteria weighting ranked: **A maintenance > C infra simplification > D run-window risk > B cost/free-tier**.

---

## Phase 3 — Solution Matrix (go/no-go)

Weights from participant ranking: A=4, C=3, D=2, B=1. Scores 1–5 (5 best).

| Criterion (weight) | O1 No-go (status quo) | O2 C-B Carbon Pulse only | O3 C-B CP + Search/extract on ESG+Trellis (all except Substack) |
|---|---|---|---|
| A — less maintenance (×4) | 1 | 4 | 5 |
| C — simplify infra (×3) | 2 | 2 | 5 |
| D — run-window risk (×2) | 3 | 3 | 2 |
| B — cost/free-tier (×1) | 5 | 4 | 3 |
| **Weighted total /50** | **21** | **32** | **42** |

**Decision: GO — target O3, gated by a Carbon Pulse C-B feasibility spike.**

Rationale: on the participant's own weighting, O3 wins decisively — it is the only option that both kills selector/Cloudflare rot across ~95% of volume **and** lets Playwright/Xvfb be removed entirely (the heavy Docker image disappears — the strongest hit on criterion C). O2 is a middle path (Playwright stays for ESG/Trellis, no infra win). No-go loses on everything the participant prioritises.

**Honest gate:** O3's score assumes C-B works on Carbon Pulse — Firecrawl holding an authenticated session **behind Cloudflare** via `Interact`. That is the single unverified, highest-risk element (Paradox #9). It must be proven before committing the full O3 scope.

---

## Idea Organization and Prioritization

**Thematic Organization:**

- **Theme 1 — Free-tier viability (de-risked):** Viability #1 (volume is not the blocker — ~240 kept/mo vs 1,000 credits), #4 (Substack stays RSS, zero credits). Pattern: the cost fear was based on a bad number; real data removed it.
- **Theme 2 — Where the rot really lives:** Robustness #5 (selector + Cloudflare pain genuinely dies), #6 (rot relocates to discovery → use `Search` + schema `/extract`), #7 (`sanitizeArticleText` stays as defense-in-depth), #8 (maintenance is converted, not deleted; new vendor surface). Pattern: the win is an **extraction-by-intent architecture**, not "replace the scraper".
- **Theme 3 — Carbon Pulse paradox & cost:** Viability #2 (`Interact` login billing is the real cost variable), #3 (free-tier 2-concurrent vs pipeline batch-of-5), Paradox #9 (worst-pain source = worst-fit for Firecrawl). Pattern: the hardest, riskiest piece is exactly the one chosen first.

**Prioritization Results:**

- **Top priority:** prove C-B on Carbon Pulse (the gate) — highest information, unblocks the whole O3 decision.
- **Quick win:** apply `Search` + `/extract` to ESG News (no auth) — most of the anti-rot benefit, lowest risk; safe even if CP spike fails.
- **Durable constraints (non-negotiable):** keep Substack on RSS; keep `sanitizeArticleText` regardless of crawler.

## Action Planning

**Step 0 — Carbon Pulse C-B feasibility spike (GATE).**
_Why:_ the entire O3 value is conditional on this; it is the only unproven element.
_Actions:_

1. Provision a Firecrawl API key; store as a new Secrets Manager secret (`news-digest/firecrawl-api-key`) and wire an env ARN exactly like the existing secrets pattern in `config.schema.ts` + `main.ts` (do not inline the key).
2. Build a throwaway script that, via Firecrawl: `Interact` to log into Carbon Pulse (credentials from the existing `carbon-pulse` secret) behind Cloudflare → keep the authenticated session → `Search`/`Map` to discover today's articles for 1–2 daily themes → `/extract` with a JSON schema mapping to `RawArticle` (title, url, date, author, body).
3. Measure: (a) does the authenticated session hold through extraction? (b) credits consumed per run (esp. `Interact` browser-minutes); (c) extracted-content cleanliness vs current Playwright + `sanitizeArticleText`; (d) wall-clock under the free-tier 2-concurrent limit.
_Success criteria:_ ≥ the article count Playwright currently returns for those themes, clean body text, credits/run extrapolating to < 1,000/month, run time within the daily window.
_Resources:_ Firecrawl free tier; existing `carbon-pulse` + `proxy` secrets; the prod state numbers in this doc as baseline.

**Step 1a — If the gate passes → roll out O3.**

1. Replace the Carbon Pulse scraper with the C-B flow behind the same `scrapeCarbonPulse` interface (return `RawArticle[]`; orchestrator unchanged).
2. Port ESG News and Trellis to `Search` + `/extract` schema.
3. Keep Substack on RSS; keep `sanitizeArticleText` as the defense-in-depth barrier (Robustness #7).
4. Remove Playwright + Xvfb from the Dockerfile → switch to a lightweight Node image (the criterion-C payoff).
5. Add free-tier guardrails: a per-run credit budget + alert; respect 2-concurrent (lower the scrape concurrency for Firecrawl calls; AI_CONCURRENCY for Claude is separate).

**Step 1b — If the gate fails → fallback scope.**

1. Carbon Pulse falls back to **C-A** (Playwright performs only the login → hand the authenticated cookie/session to Firecrawl for discovery + `/extract`).
2. Still migrate ESG News + Trellis to `Search` + `/extract` (most of the anti-rot benefit, no auth risk).
3. Playwright stays only for the CP login step → partial infra simplification.

_Success indicators (either path):_ measurable drop in reactive maintenance commits touching `scraper/*`; no increase in fallback/empty-article rate; monthly Firecrawl credits < 1,000; daily run stays within its window.

## Session Summary and Insights

**Key Achievements:**

- Reached a defensible **GO** decision with a concrete, risk-gated path — the stated session goal.
- Replaced an intuition-based premise with **real production data** (495 articles / ~11 kept/day / source split) mid-session; corrected a wrong free-tier framing honestly.
- Reframed the project from "use Firecrawl to crawl news" to "adopt **extraction-by-intent (`Search` + schema `/extract`)**; Firecrawl is the vehicle" — the actual anti-rot mechanism.

**Session Reflections:**

- The most valuable move was the participant challenging the "28–66 articles" number; pulling prod data flipped the cost analysis and sharpened the real risk (Carbon Pulse auth behind Cloudflare, not volume).
- The chosen first target (Carbon Pulse) is simultaneously the highest-pain and the highest-fit-risk for Firecrawl — hence the explicit feasibility gate before full commitment.
- Durable constraints preserved: Substack stays RSS; `sanitizeArticleText` remains regardless of crawler (consistent with prior project memory on scraper rot).

**Suggested next BMAD step:** run `bmad-quick-dev` to execute Step 0 (the Carbon Pulse C-B spike), or `bmad-product-brief` if this should become a tracked piece of work first. Artifacts for this app live in `apps/news-digest/_bmad-output/`.
