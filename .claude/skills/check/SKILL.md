---
name: check
description: 'Run Middle Earth quality gates (lint, test, build) without committing. Runs AI instruction checks when .ai/ files are affected.'
---

Run the appropriate quality gates for the Middle Earth Nx monorepo and report failures.

### Affected (default)

```bash
pnpm lint:affected
pnpm nx affected --target test
pnpm nx affected --target build
```

### AI instructions (when .ai/ files are affected)

```bash
pnpm ai:check
```

### All (optional)

```bash
pnpm lint:all
pnpm nx run-many --target test
pnpm nx run-many --target build
pnpm pkgJsonLint
```

### Reporting

- List failing command(s)
- Show the first relevant error blocks
- Identify the owning project(s)
- Recommend the minimal next action
