---
epic: 1
story: 1
slug: email-auto-send
status: implemented
date: 2026-05-18
scope: apps/news-digest/pipeline
---

# Story 1.1 — Auto-send the digest email instead of creating a Gmail draft

## Problem

The pipeline calls `createGmailDraft` (`distribution/email.ts`) which POSTs to
`users/me/drafts`. The digest then sits as an **unsent draft** until someone
manually sends it. Downstream integrations read `market-intelligence@carrot.eco`
as a source; a draft that is never sent (or sent days late) makes those
integrations miss days and miss their ingestion time window. Slack, by contrast,
is posted automatically in the same run.

## Goal

Send the digest email automatically, from the same run that posts Slack, to the
same recipient (`GMAIL_TO`, default `market-intelligence@carrot.eco`). No manual
step. No draft.

## Decisions (locked with requester)

- **Clean cutover**: `createGmailDraft` is replaced by `sendGmailMessage`; the
  draft path is removed entirely. `SKIP_EMAIL` still skips the channel.
- **Same run, sequential**: keep the orchestrator order Notion → email → Slack
  (seconds apart, same run). No `Promise.all`; preserves per-channel error
  isolation, which matches the existing resilience pattern.

## Acceptance criteria

1. `sendGmailMessage(html, to, date, credentials)` POSTs to
   `https://gmail.googleapis.com/gmail/v1/users/me/messages/send` with body
   `{ raw }` (the RFC822 message — no `{ message: { raw } }` draft envelope).
2. Success returns `{ success: true, messageId }`. Token-refresh failure and any
   non-2xx from Gmail return `{ success: false, error }` (no throw escapes).
3. **Idempotency**: a same-day re-run does NOT send a second email. A new state
   field `emailSentAt` mirrors `slackPostedAt` — if `state.emailSentAt` starts
   with today, the email step is skipped and treated as already sent.
4. `PipelineResult.emailDraftCreated` is renamed to `emailSent`; the summary log
   reads `Email: sent | failed`.
5. Old persisted state (no `emailSentAt`) still parses (Zod `.optional().default('')`).
6. `DRY_RUN` still skips email; `SKIP_EMAIL` still skips email.
7. Vitest green for the app; `nx lint news-digest-pipeline` clean.

## Task list

- [x] TDD: rewrote `distribution/__tests__/email.spec.ts` for `sendGmailMessage`
      (endpoint, `{ raw }` body, success → `messageId`, both failure paths).
- [x] `distribution/email.ts`: `createGmailDraft` → `sendGmailMessage`,
      `GmailDraftResult`/`draftId` → `GmailSendResult`/`messageId`, endpoint +
      body change. `refreshAccessToken` / `buildRawEmail` intact.
- [x] `types.ts`: `ProcessedState.emailSentAt: string`; `PipelineResult.emailSent`.
- [x] `config.schema.ts`: `processedStateSchema.emailSentAt` default `''`.
- [x] `state/s3-store.ts`: `EMPTY_STATE.emailSentAt = ''` (+ spec assertions).
- [x] `orchestrator.ts`: import + return-type rename; email block uses
      `sendGmailMessage`, same-day guard added; `emailSentAt` persisted in both
      `saveStateSafely` calls; all `emailDraftCreated` literals + summary log fixed.
- [x] Verify: `npx vitest run` → 134/134 green; `pnpm nx build` green. Repo
      `lint` target is broken at environment level (`@nx/linter:eslint`
      resolution) — pre-existing, unrelated to this change. `tsc --noEmit`
      surfaces only pre-existing errors in untouched files.
- [x] Live smoke test (`scripts/test-email-send.ts`, 2026-05-18): real
      Secrets Manager creds + new `sendGmailMessage`, sent to the authenticated
      account's own address (resolved at runtime via `users/me/profile`), NOT
      the prod list. Result: `success` with a returned `messageId`. Confirms
      scope, token, send path, and template rendering end-to-end.
- [ ] Deploy: `pnpm nx docker-push news-digest-pipeline` (ECR `:latest`) — the
      scheduled run only picks up the change after this. Pending go-ahead.

## Out of scope / follow-up (not code in this story)

- **OAuth scope risk — VERIFIED CLOSED (2026-05-18).** The `news-digest/gmail-credentials`
  secret's refresh token was inspected via token refresh + tokeninfo. Granted
  scope is `https://www.googleapis.com/auth/gmail.compose`, which the Gmail API
  authorizes for `users.messages.send` (the official `gmail.compose` description
  is "Create, read, update, and delete drafts. Send messages and drafts").
  No re-consent or secret rotation needed. Refresh token still valid (no
  `invalid_grant`).
- **Deploy** — the scheduled run uses the ECR `:latest` image. This code change
  has no effect on the daily run until `pnpm nx docker-push news-digest-pipeline`
  is run. Separate, explicit step.
