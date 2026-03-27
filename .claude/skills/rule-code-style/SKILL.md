---
name: rule-code-style
description: 'Middle Earth code style conventions (TypeScript/JavaScript)'
---

# Rule code-style

Apply this rule whenever work touches:
- `*`

# Code style (Middle Earth)

## Naming and clarity

- Use descriptive names; avoid abbreviations unless industry-standard (URL, ID, API).
- Functions are verbs; variables are nouns.
- Prefer explicit return types for exported functions and public APIs.

## Structure and files

- Cohesion-first: one responsibility per module.
- Organize by file type when it helps:
  - `*.constants.ts`: constants and enums
  - `*.types.ts`: types and interfaces
  - `*.helpers.ts`: pure functions/utilities
- Use barrels (`src/index.ts`) for library exports; no deep imports.

## Control flow

- Favor guard clauses and early returns; keep nesting shallow (≤ 2 levels).
- Avoid deeply nested ternaries; extract small functions.

## Dependencies and imports

- Prefer path aliases defined in `tsconfig.base.json` (`@middle-earth/libs/publishable/*`).
- Respect Nx module boundaries and tags.

## Error handling and validation

- Validate inputs at boundaries.
- Enrich errors with context; avoid silent failures.

## Performance and DX

- Prefer pure functions and immutable data structures where possible.
- Avoid premature optimization; measure first. Keep components and modules small and composable.

## Formatting and tooling

- End files with a single trailing newline.
- After editing files, run formatter and linter with `--fix`.
