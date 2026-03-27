---
name: rule-testing
description: 'Middle Earth testing baseline guidelines (unit tests with Jest)'
---

# Rule testing

Apply this rule whenever work touches:
- `**/*.spec.ts`
- `**/*.spec.tsx`
- `**/*.test.ts`
- `**/*.test.tsx`

# Testing (Middle Earth)

## Unit tests (Jest)

- Tests live in `__tests__/` folders within the same directory as source files.
- Filename pattern: `*.spec.ts(x)`.
- Use framework-specific testing libraries (e.g., Testing Library for React).
- Use shared testing helpers when available; keep tests short and behavior-focused.
- Aim for 100% coverage where feasible; write tests that target behavior, not implementation details.

## Fixtures and data

- Use `faker` for generating random inputs where helpful.
- Prefer deterministic assertions over random expected values.

## Mocking

- Prefer `jest.mock` for external modules and `jest.spyOn` for side effects.
- Use table-driven tests with `it.each` for input/output matrices.

## Assertions

- Prefer `expect.objectContaining`/`not.objectContaining` for partial assertions.
- Disallow `.only` (lint rule enabled) and skipped tests except when justified.

## Running tests

```bash
# Test a specific project
pnpm nx test <project-name>

# Test all projects
pnpm nx run-many --target test
```
