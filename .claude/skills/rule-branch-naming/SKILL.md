---
name: rule-branch-naming
description: 'Git branch naming conventions aligned with Conventional Commits'
---

# Rule branch-naming

Apply this rule whenever work touches:
- `*`

# Branch naming (Middle Earth)

## Format

- Preferred: `<type>/<short-description>`
- With scope: `<type>/<scope>-<short-description>`
- With ticket: `<type>/<short-description>-<TICKET>` or `<TICKET>/<type>/<short-description>`

## Rules

- Use lowercase and kebab-case
- Use only letters, digits, hyphens, and slashes
- Keep branches <= 60 characters
- Avoid generic words like `update`, `changes`, `stuff`
- Match branch `type` and `scope` to commit messages

## Special branches

- Long-lived: `main`
- Release: `release/<version>`
- Hotfix: `hotfix/<short-description>`
- Automated: `renovate/*`

## Examples

- `feat/add-button-component`
- `feat/lib-add-theme-provider`
- `fix/logger-handle-null-context`
- `chore/config-update-eslint-rules`
- `CARROT-123/feat/lib-add-share-component`
