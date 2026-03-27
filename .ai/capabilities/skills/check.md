---
id: check
name: check
description: 'Run Middle Earth quality gates (lint, test, build) without committing. Runs AI instruction checks when .ai/ files are affected.'
when_to_use:
  - 'Before committing to validate nothing is broken'
  - 'After making changes to run quality gates'
  - 'When CI fails and you need to reproduce locally'
workflow:
  - 'Run affected quality gates (lint, test, build)'
  - 'Run AI instruction checks if .ai/ files are affected'
  - 'Report failures with project names and suggested fixes'
inputs:
  - 'Optional: "all" to run workspace-wide checks'
outputs:
  - 'Pass/fail report with failing project names and first error blocks'
references:
  - .ai/rules/testing.md
---

# Check Skill

## Instructions

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
