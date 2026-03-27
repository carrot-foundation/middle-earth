---
id: typescript
intent: 'Middle Earth TypeScript baseline guidelines (compiler, modules, best practices)'
scope:
  - '**/*.ts'
  - '**/*.tsx'
requirements:
  - 'Respect tsconfig.base.json strict settings'
  - 'Use path aliases (@middle-earth/libs/publishable/*); no relative ../../..'
  - 'No any or unsafe casts; favor precise types and narrowing'
  - 'Explicit return types for exported functions'
anti_patterns:
  - 'Using any or type assertions without justification'
  - 'Deep relative imports (../../..)'
  - 'Default exports unless required by framework'
---

# Typescript Rule

## Rule body

# TypeScript (Middle Earth)

## Compiler and language

- Respect `tsconfig.base.json`: `strict` true, `verbatimModuleSyntax`, `noUnusedLocals/Parameters`.
- Use the provided path aliases (`@middle-earth/libs/publishable/*`); do not import via relative `../../..`.
- No `any` or unsafe casts; favor precise types and narrowing.

## Modules and barrels

- Import from library barrels (`src/index.ts`). Avoid deep imports into internal files.
- Keep public types exported from the barrel.

## Functions and variables

- Prefer explicit function return types for exported functions and public APIs.
- Meaningful identifiers; no 1-2 letter names; avoid abbreviations unless industry-standard.
- Use early returns and narrow unions with type guards.
- Organize constants, helpers, and types by file: `*.constants.ts`, `*.helpers.ts`, `*.types.ts`.

## Error handling

- Use `Result`-like patterns or typed errors. Do not swallow errors; add context.
- Prefer `type-fest` utility types where possible.

## Lint integration

- Follow root ESLint config (Airbnb base/typescript, SonarJS, Unicorn, Security, Promise, Perfectionist, Prettier).
- Avoid default exports unless required by a framework (e.g., Next.js pages/layouts).
