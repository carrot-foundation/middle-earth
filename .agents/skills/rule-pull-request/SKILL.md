---
name: rule-pull-request
description: 'Pull request workflow and quality standards'
---

# Rule pull-request

Apply this rule whenever work touches:
- `*`

# Pull requests (Middle Earth)

## Workflow

1. Gather information: `git log`, `git diff --stat`, affected projects
2. Assess context sufficiency; ask for clarification if unclear
3. Create description following template
4. Save to `tmp/pull-requests/{sanitized-branch}.md`
5. Output `gh pr create` command for manual execution

## PR title format

- **Start with capital letter**, sentence case
- **Aim for 50-60 characters maximum**
- **Focus on outcome**, not implementation
- **Use plain English**, avoid jargon

## PR description

- **Always use** `.github/pull_request_template.md` when available
- Complete only applicable sections; remove the rest
- Remove all HTML comments after addressing content
- No placeholders — all content must be meaningful

## GitHub CLI output

```bash
gh pr create \
  -a @me \
  -r carrot-foundation/developers \
  -R carrot-foundation/middle-earth \
  -t "PR Title Here" \
  -B main \
  -F tmp/pull-requests/{sanitized-branch}.md
```
