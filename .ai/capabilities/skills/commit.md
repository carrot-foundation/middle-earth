---
id: commit
name: commit
description: 'Commit Changes'
when_to_use:
  - 'After completing a task and ready to commit'
  - 'When staging and committing code changes'
  - 'When the user says "commit" or asks to save changes'
workflow:
  - 'Review current branch and changes'
  - 'Identify ClickUp task linkage if available'
  - 'Check for logical groupings'
  - 'Draft commit messages per .ai/rules/commit.md'
  - 'Stage files and create commit(s)'
  - 'Never use --no-verify (hooks + lint-staged must run)'
inputs:
  - 'Staged and unstaged changes, optional commit mode (single/batch)'
outputs:
  - 'One or more git commits with conventional commit messages'
references:
  - .ai/rules/commit.md
  - .ai/rules/branch-naming.md
  - .ai/rules/code-preservation.md
---

# Commit Skill

## Instructions

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
