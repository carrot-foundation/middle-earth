---
id: code-preservation
intent: 'Code preservation rules - never delete or revert code without explicit approval'
scope:
  - '*'
requirements:
  - 'Never delete or revert code without explicit user approval'
  - 'Preserve all existing changes when fixing issues'
  - 'Prefer minimal fixes over broad rewrites'
anti_patterns:
  - 'Deleting code as a shortcut to fix errors'
  - 'Reverting unrelated work to resolve conflicts'
  - 'Broad rewrites when a targeted fix suffices'
---

# Code Preservation Rule

## Rule body

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
