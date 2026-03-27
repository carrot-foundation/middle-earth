---
name: finish-work
description: 'End-to-end workflow to ship code changes as a PR. Creates branch, runs quality gates, commits changes, and creates PR.'
---

End-to-end workflow from code changes to PR-ready state.

### 1. Capture context

- Review repository state (branch, changes)
- Identify ClickUp task reference if available

### 2. Branch

- Check current branch against `.ai/rules/branch-naming.md`
- On `main` or violations → create new branch
- Compliant → confirm and proceed

### 3. Quality gates

Run affected checks:

```bash
pnpm lint:affected
pnpm nx affected --target test
pnpm nx affected --target build
```

On failure → fix issues, re-run until green.

### 4. Commit

- Run `/commit` workflow (batch mode by default)
- Include ClickUp task reference when applicable
- **Never** use `--no-verify`

### 5. Push and create PR

- Push branch to remote
- Run `/create-pr` workflow
- Full critical analysis (size, clarity, red flags)
- Output `gh pr create` command

### 6. Summary

- Branch name
- Quality gate results
- Commit summary
- PR file location and command
