---
id: create-branch
name: create-branch
description: 'Create Branch'
when_to_use:
  - 'When starting new work that needs a feature branch'
  - 'When on main and need to create a branch before committing'
  - 'When the user says "create branch" or "new branch"'
workflow:
  - 'Gather context (type, scope, ticket ID, description)'
  - 'Generate branch name following naming conventions'
  - 'Validate length, format, and specificity'
inputs:
  - 'Optional: ClickUp task ID, branch type, and description'
outputs:
  - 'New git branch following naming conventions'
references:
  - .ai/rules/branch-naming.md
---

# Create Branch Skill

## Instructions

Generate Git branch name following Conventional Commit conventions.

### 1. Gather context

- Primary purpose (feat, fix, refactor, etc.)
- Scope from `.ai/rules/commit.md` (config, lib, release, ai)
- Ticket ID if applicable
- Summary in 3-6 kebab-case keywords

### 2. Choose format

- Preferred: `<type>/<short-description>`
- With scope: `<type>/<scope>-<short-description>`
- With ticket: append `-<TICKET>`

### 3. Validate

- Length <=60 characters
- Lowercase, kebab-case only
- No prohibited punctuation
- Specific and meaningful description

### 4. Challenge points

- Filler words? → Demand specifics
- Length >60 chars? → Suggest trimming
- Multiple concerns? → Separate branches
