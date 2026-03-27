---
name: commit
description: 'Commit Changes'
---

Generate Conventional Commit messages following project standards and create the commit(s).

### 1. Analyze repository state

- Review current branch and changes
- Identify ClickUp task linkage if available
- Check for logical groupings

### 2. Propose commit plan

**Batch mode (default):**
- Group changes by purpose or domain
- Draft commit messages per `.ai/rules/commit.md`
- Middle Earth scopes: `config`, `lib`, `release`, `ai`

**Single mode:**
- Determine type and scope from changes
- Craft concise commit message (<=72 chars)

### 3. Execute

- Stage files and create commit(s)
- **Never** use `--no-verify` (hooks + lint-staged must run)
- If hooks fail: fix the issues and retry

### 4. Challenge points

- Mixed concerns? → Suggest splitting
- Logic changes without tests? → Question coverage
- Header >72 chars? → Help trim
