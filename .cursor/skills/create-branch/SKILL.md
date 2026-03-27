---
name: create-branch
description: 'Create Branch'
---

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
