---
id: create-pr
name: create-pr
description: 'Create Pull Request'
when_to_use:
  - 'When ready to create a pull request from current branch'
  - 'After commits are pushed and PR is needed'
  - 'When the user says "create PR" or "open PR"'
workflow:
  - 'Review branch commits, diff stats, and affected files'
  - 'Critically analyze size, clarity, and red flags'
  - 'Create PR description following template standards'
  - 'Save description file and output gh pr create command'
inputs:
  - 'Current branch commits, optional base branch (default: main)'
outputs:
  - 'PR description file and gh pr create command'
references:
  - .ai/rules/pull-request.md
  - .ai/rules/pull-request-description.md
  - .ai/rules/code-preservation.md
---

# Create Pr Skill

## Instructions

Create PR following project conventions with critical analysis.

### 1. Gather context

- Review current branch and commit history
- Check diff stats and affected files
- Confirm base branch (default: `main`)

### 2. Find PR template

Search for `.github/pull_request_template.md`. If not found, use a sensible default.

### 3. Critical analysis

- **Size**: Lines/files changed vs limits (>400 lines? suggest split)
- **Clarity**: Commit message quality, business value
- **Red flags**: No tests? Breaking changes? Vague commits?

### 4. Create description

- Craft clear title (NOT conventional commit format)
- Fill sections per `.ai/rules/pull-request-description.md`
- Remove empty sections and HTML comments

### 5. Save and output

- Save to `tmp/pull-requests/{sanitized-branch}.md`
- Output `gh pr create` command:

```bash
gh pr create \
  -a @me \
  -r carrot-foundation/developers \
  -R carrot-foundation/middle-earth \
  -t "PR Title Here" \
  -B main \
  -F tmp/pull-requests/{sanitized-branch}.md
```
