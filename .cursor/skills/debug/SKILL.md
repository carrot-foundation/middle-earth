---
name: debug
description: 'Structured debugging workflow for errors, test failures, build issues, and unexpected behavior in the Middle Earth monorepo.'
---

Structured debugging workflow for Middle Earth. Find the root cause, apply the minimal fix, and verify.

### 1. Capture

- Full error message and stack trace
- Command that triggered the error
- Recent changes (`git diff` and `git log --oneline -5`)

### 2. Categorize

| Type       | Symptoms                     | First steps                                   |
| ---------- | ---------------------------- | --------------------------------------------- |
| TypeScript | Type errors, missing exports | Check types, imports, `tsconfig.base.json`    |
| Lint       | ESLint violations            | Run `pnpm lint:affected`, check rule config   |
| Unit test  | Jest assertion failures      | Read test output, check test logic and stubs  |
| Build      | SWC compilation errors       | Check imports, module boundaries, Nx deps     |
| Nx         | Workspace/cache issues       | Run `pnpm nx reset`, check `project.json`     |

### 3. Common Middle Earth issues

- **Path alias issues**: `@middle-earth/libs/publishable/*` vs relative imports
- **Missing exports**: Check barrel (`src/index.ts`) exports
- **Stale Nx cache**: Run `pnpm nx reset`
- **Module boundary violations**: Check project tags

### 4. Fix strategy

1. **Minimal change**: Fix only what is broken
2. **Root cause**: Address the underlying issue, not symptoms
3. **No collateral damage**: Do not modify unrelated code

### 5. Verify

```bash
pnpm lint:affected
pnpm nx affected --target test
pnpm nx affected --target build
```
