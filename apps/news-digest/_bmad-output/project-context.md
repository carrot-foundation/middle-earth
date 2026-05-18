---
project_name: news-digest
user_name: CarrotDevelopers
date: 2026-05-18
sections_completed: [overview, layout, technology_stack, implementation_rules, deploy_runtime, distribution, gotchas, bmad_convention, pointers]
---

# Project Context for AI Agents — news-digest

_Critical rules and patterns AI agents must follow when implementing code in `apps/news-digest`. Focus is on **unobvious** details — not generic advice agents already know._

_Scope: `apps/news-digest/` only (`pipeline` + `infra`). Not the rest of the middle-earth monorepo. Mirrors the per-app BMAD convention from the `lorien` repo._

---

## 1. What this is

A daily news-intelligence pipeline. A scheduled **ECS Fargate** task (EventBridge cron) scrapes climate/circularity sources (Carbon Pulse, ESG News, Trellis, Substack RSS), cross-source dedups, summarizes each article with **Claude Haiku**, persists state + markdown to **S3**, then distributes to **Notion**, a **Gmail draft**, and **Slack**. There is no server and no API surface — it is a batch job that runs once per day and exits.

Two Nx projects:

- `news-digest-pipeline` (`apps/news-digest/pipeline`, `tags: app:news-digest, type:app, stack:node`) — the TypeScript job.
- `news-digest-infra` (`apps/news-digest/infra`, `stack:terraform`) — ECS/ECR/EventBridge/Secrets/S3/CloudWatch.

## 2. Code layout (`pipeline/src`)

- `main.ts` — entrypoint: parse env (Zod), load secrets from Secrets Manager, run pipeline, set `exitCode`.
- `orchestrator.ts` — the 12-step run; resilience and idempotency live here.
- `config.constants.ts` — `THEMES` (16: 5 daily / 9 weekly / 2 monthly), `SEGMENTS`, `NOTION_VALID_THEMES`, `SUBSTACK_PUBLICATIONS`, `FREQUENCY_DAYS`.
- `config.schema.ts` — Zod schemas: `envSchema`, `processedStateSchema`, secret schemas.
- `scraper/` — `carbon-pulse.ts`, `esg-news.ts`, `trellis.ts`, `substack.ts`.
- `ai/` — `article-processor.ts` (Claude call + fallback), `trellis-curator.ts`.
- `helpers/` — `content.helpers.ts` (sanitizer), `dedup.helpers.ts`, `theme.helpers.ts`, `markdown.helpers.ts`, `source.helpers.ts`.
- `distribution/` — `notion.ts`, `email.ts`, `email-template.helpers.ts`, `slack.ts`, `preview.ts`.
- `state/s3-store.ts` — load/save state + article markdown.
- `types.ts` — `RawArticle`, `ProcessedArticle`, `ProcessedState`, `PipelineResult`, `Secrets`, `ThemeConfig`.

## 3. Technology Stack & Versions

- **Node 22**, **TypeScript**, **ESM** (`"type": "module"` — relative imports MUST end in `.js`).
- **Build: esbuild bundle** (`--platform=node --target=node22 --format=esm`, externals `playwright`, `@aws-sdk/*`). NOT SWC — the rest of middle-earth builds with `@nx/js:swc`; this app does not.
- **Tests: Vitest** (`vitest.config.ts`, `coverage.provider: v8`, `include: src/**/*.spec.ts`). ⚠️ This contradicts the repo-wide rule (`.ai/rules/testing.md` and CLAUDE.md say Jest). For `apps/news-digest`, Vitest is correct.
- **Playwright `v1.59.0`** (pinned via the runtime image `mcr.microsoft.com/playwright:v1.59.0-noble`), run under **Xvfb** (`DISPLAY=:99`).
- **AI:** Claude model `claude-haiku-4-5-20251001`, raw `fetch` to `https://api.anthropic.com/v1/messages`, header `anthropic-version: 2023-06-01`. No SDK.
- **Validation:** Zod. **AWS SDK v3** (`@aws-sdk/client-secrets-manager`, S3). **pnpm 10.2.0**. Infra: Terraform.

## 4. Critical Implementation Rules

### Language / build

- Every relative import ends in `.js` (ESM + bundler). Adding a file means importing it as `./x.js`, never `./x`.
- esbuild marks `playwright` and `@aws-sdk/*` external — they are provided by the runtime image / installed deps, not bundled. Don't add deep imports that defeat this.
- Build is `npx esbuild ... src/main.ts` (see `project.json` `build` and `Dockerfile`). There is no SWC/tsc emit step.

### Testing

- **Use Vitest, not Jest**, in this app. `*.spec.ts` inside `__tests__/`. Run: `cd apps/news-digest/pipeline && npx vitest run` (or `pnpm nx test news-digest-pipeline`). `globals: true` (no need to import `describe/it/expect`).
- TDD for sanitization/scraper changes: write the failing spec first (there is precedent — `content.helpers.spec.ts`, scraper regression specs).
- `cspell` runs in pre-commit — invented proper nouns in fixtures (e.g. real person names) will fail the commit; use generic phrasing in test fixtures.

### Resilience (orchestrator)

- Every scraper/distributor is wrapped so a single failure **does not crash the run**: `try/catch` pushing to `errors[]`, and `Promise.allSettled` for batched work (Notion, Claude, S3 saves).
- The process exits **1 when `result.errors.length > 0`** even though the digest may have been produced. A non-empty `errors[]` is not necessarily a pipeline failure (e.g. one source timed out) — read the errors, don't assume total failure.
- Concurrency caps are deliberate: `AI_CONCURRENCY = 5`, `NOTION_CONCURRENCY = 3`. Bursting Claude at 5 can hit transient `429/529` → those become fallbacks (see below). Don't raise blindly.

### Scraped-content sanitization (defense-in-depth)

- `sanitizeArticleText` (`helpers/content.helpers.ts`) is the **single barrier** that strips site chrome (share buttons, breadcrumbs, `<noscript>` `<img>`, author bios, newsletter signups, date-filter widgets) from `fullContent`, regardless of which scraper produced it.
- **Never** write raw `article.fullContent` to Notion, S3 markdown, or the Claude prompt. It MUST pass through `sanitizeArticleText` first (already wired in `notion.ts`, `markdown.helpers.ts`, `article-processor.ts`).
- An all-chrome page sanitizes to `''` — callers treat `''` as "skip, don't publish an empty/garbage article". Preserve that contract.
- Scrapers rot when source DOM changes; the sanitizer is the durable defense. Extend its patterns rather than patching individual scrapers when new chrome leaks.

### Claude processing

- Any Claude failure (non-2xx, empty content, parse error, network) falls back **silently** to `parseFallback` (sanitized lede, empty `keyPoints`, empty `segment`, `isFallback: true`). The pipeline still "succeeds".
- Symptom→cause: if **all** articles are fallbacks (`Claude: N processed, N fallbacks`) and summaries look like raw ledes, suspect **Anthropic credit exhaustion** (HTTP 400 "credit balance too low") — that is a billing action, NOT a code bug. A handful of fallbacks among many is usually transient `529 overloaded`.
- Keep `MODEL`, `anthropic-version`, and the JSON-only prompt contract intact. The model strips ```` ```json ```` fences defensively — keep that.

### Idempotency & validation

- `orchestrator.ts`: if state already has articles with `processedAt` starting today, it **skips scraping** and only re-distributes. To validate a code change end-to-end without mutating production state, run with a **throwaway `S3_STATE_KEY`** and a throwaway `S3_ARTICLES_PREFIX`.
- To make a validation run fast, seed the throwaway state's `themeLastProcessed` with today's date for all weekly/monthly themes → only the 5 daily themes stay eligible (daily themes are always eligible: `FREQUENCY_DAYS.daily === 0`).
- State auto-prunes articles older than `STATE_RETENTION_DAYS = 90`.

### State / config invariants

- Article `source` is a **closed enum**: `carbon-pulse | esgnews | trellis | a16z-crypto`. Adding a source means updating: `types.ts` unions, `processedStateSchema` enum (`config.schema.ts`), and the `articlesBySource` init objects in `orchestrator.ts`. Missing the Zod enum makes old state fail to parse.
- All runtime config is env-driven and Zod-validated (`envSchema`). Secrets are **ARNs resolved at runtime** via Secrets Manager — never inline secrets or URLs. Defaults live in `envSchema` (e.g. `NOTION_DATABASE_ID`, `GMAIL_TO=market-intelligence@carrot.eco`, `SLACK_CHANNEL_ID`).

## 5. Deploy & Runtime

- The scheduled run executes the **ECR image `:latest`**. A code fix has **no effect** on the daily run until the image is rebuilt and pushed: `pnpm nx docker-push news-digest-pipeline` (depends on `docker-build`; `scripts/docker-push.sh` does ECR login + tag + push). `docker-build` uses `buildx --platform linux/amd64`.
- Infra is Terraform via Nx: `pnpm nx tf news-digest-infra --configuration=plan|apply|init|validate|fmt`, `tf-lint`. ECS Fargate task `1024/2048`, container name `${app}-pipeline`, logs to CloudWatch `awslogs` group, image `:latest`, env wired in `ecs.tf`, schedule in `eventbridge.tf`, secrets in `secrets.tf`.
- Local email preview without distributing: `pnpm nx preview-email news-digest-pipeline`.

## 6. Distribution & flags

- Channels: Notion DB (default id in `envSchema`), Gmail draft (`GMAIL_TO`), Slack (`SLACK_CHANNEL_ID`). Slack is skipped if already posted today (`slackPostedAt`).
- Flags (env, string `'true'`): `DRY_RUN` (skip ALL distribution), `SKIP_NOTION`, `SKIP_EMAIL`, `SKIP_SLACK`. Use `DRY_RUN=true` + a throwaway state key for safe validation; combine `SKIP_*` to exercise one channel.

## 7. Known fragilities / gotchas

- **Carbon Pulse scraping is flaky**: login (`carbon-pulse.com/login/`) intermittently times out (Playwright 30 s default) → 0 CP articles + `errors:1` + `exitCode 1`, but other sources still produce the digest. Intermittent, not a regression by itself.
- **Listing/ticker pages**: Carbon Pulse newsletter/ticker pages can be ingested as prose-heavy "articles" that the empty-check sanitizer does not fully drop. Known residual gap.
- **Silent degradation**: a digest that "looks bad" usually traces to (a) scraper chrome rot or (b) Anthropic credits — both are silent. Check the pipeline summary line and `claudeFallbacks` ratio first.
- Do not commit real PII / real person names in fixtures or artifacts (org-wide rule + `cspell`).

## 8. BMAD per-app convention (mirrors `lorien`)

- This file lives at `apps/news-digest/_bmad-output/project-context.md`. App-scoped BMAD artifacts go under `apps/<app>/_bmad-output/`, **never** at repo root. A root `_bmad-output/` (if created) is for monorepo/infra-wide artifacts only.
- Five buckets per app: `project-context.md` + `brainstorming/ planning-artifacts/ implementation-artifacts/ research/ notes/` (each with `.gitkeep`).
- `_bmad/` (installer scaffolding) is per-machine; only `_bmad/custom/` and `_bmad-output/` are team-shared. Regenerate this file via `bmad-generate-project-context` when the app's scope/stack shifts — stale context misleads every later session.
- The convention is documented canonically in `.ai/rules/` and synced to adapters via `pnpm ai:sync`. Note: middle-earth commitlint scopes are `config|lib|release|ai` — there is no `bmad` scope yet (lorien has one); commit BMAD artifacts under an existing scope unless one is added.

## 9. Pointers (read on demand)

- Orchestration & resilience → `pipeline/src/orchestrator.ts`
- Sanitization barrier → `pipeline/src/helpers/content.helpers.ts`
- Claude + fallback → `pipeline/src/ai/article-processor.ts`
- Config/env/state contracts → `pipeline/src/config.schema.ts`, `pipeline/src/config.constants.ts`, `pipeline/src/types.ts`
- Deploy → `pipeline/project.json`, `pipeline/Dockerfile`, `pipeline/scripts/docker-push.sh`, `infra/src/*.tf`
- Memory (cross-session): `news-digest-scraper-rot`, `news-digest-anthropic-credits`, `news-digest-deploy-ecr`
