---
name: rule-bmad
description: 'BMAD tool/output split and per-app artifact convention for Middle Earth'
---

# Rule bmad

Apply this rule whenever work touches:
- `_bmad/**`
- `_bmad-output/**`
- `apps/*/_bmad-output/**`

# BMAD in Middle Earth

BMAD is how planning, drafting, and shipping work is captured. The split between **tool** and **output** is deliberate — read this before touching anything under `_bmad/` or `_bmad-output/`.

## The split: tool vs output

**Per-machine (installer scaffolding, reinstalled by each dev):**

- `_bmad/*` — agents, workflows, expansion packs (`bmm`, `bmb`, `cis`, `core`, `tea`), generated config (`config.yaml`, `config.user.toml`).
- `.claude/skills/bmad-*/` — skill copies the BMAD installer writes; not authored by hand.

**Team-shared (the canal of context — this is what is committed):**

- `_bmad/custom/` — exception inside the scaffolding. Team-built customizations land here and survive a reinstall.
- `_bmad-output/` (root) — monorepo/infra-wide artifacts only (cross-app brainstorms, charter).
- `apps/<app>/_bmad-output/` — same structure, scoped to one app. App-level work belongs here, **never** at the root.

Inside any `_bmad-output/` you get the same five buckets:

- `project-context.md` — living summary; the entrypoint for any human or agent ramping into the scope.
- `brainstorming/` — exploratory sessions (one dated MD per session).
- `planning-artifacts/` — PRDs, briefs, charter, editorial passes.
- `implementation-artifacts/` — stories, plans, dev specs (`<epic>-<story>-<slug>.md`).
- `research/`, `notes/` — supporting material.

## Onboarding flow

1. Ensure `_bmad/` is installed on your machine (BMAD installer).
2. Read `apps/<app>/_bmad-output/project-context.md` for the app you'll touch (and root `_bmad-output/project-context.md` if it exists, for the monorepo picture).
3. Check `apps/<app>/_bmad-output/implementation-artifacts/` for the active story before writing code.
4. When you finish, regenerate `project-context.md` via `bmad-generate-project-context` if the scope shifted, and commit new artifacts.

## Commit convention

Middle Earth commitlint scopes are `config | lib | release | ai`. There is no dedicated `bmad` scope. Commit BMAD artifacts under the closest existing scope (e.g. `docs(ai): ...` or `docs(lib): ...` when shipped with the code they unblock) until/unless a `bmad` scope is added to `commitlint.config`.

## Pitfalls

- **Editing under `_bmad/`** outside `_bmad/custom/` — wiped on the next reinstall.
- **Artifacts at the wrong level** — app work goes in `apps/<app>/_bmad-output/`, not the root.
- **Stale `project-context.md`** — regenerate when an epic ships or the stack changes; stale context misleads every later BMAD session.
- **Real data** — never commit real PII / real person names into BMAD artifacts (org-wide rule; `cspell` runs in pre-commit).
