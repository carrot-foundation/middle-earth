---
name: rule-code-preservation
description: 'Code preservation rules - never delete or revert code without explicit approval'
---

# Rule code-preservation

Apply this rule whenever work touches:
- `*`

# Code preservation

## Core principle

Never delete, revert, or discard code without explicit user approval. When fixing bugs or resolving conflicts, preserve all existing changes.

## Requirements

- **Minimal changes**: Fix only what is broken.
- **Root cause**: Address the underlying issue, not symptoms.
- **No collateral damage**: Do not modify unrelated code.
- **Preserve existing changes**: Never discard work in progress.

## When modifying code

- Before deleting any code, explain why and get approval.
- When resolving merge conflicts, preserve both sides when possible.
- When fixing test failures, fix the test or the code — do not delete either.
- When refactoring, preserve behavior; rename instead of delete when practical.
