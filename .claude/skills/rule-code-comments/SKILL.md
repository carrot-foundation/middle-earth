---
name: rule-code-comments
description: 'Code comment guidelines for all languages'
---

# Rule code-comments

Apply this rule whenever work touches:
- `*`

# Code comments

## Core principles

- Favor self-documenting code; reach for comments only when the intent or constraints are not obvious from names and structure.
- Prefer explaining _why_ something exists, the invariants it relies on, or context that comes from outside the code.
- Avoid comments that simply restate the implementation, mirror type annotations, or paraphrase variable names.
- Delete or update comments whenever behavior changes — stale commentary is worse than none.

## When comments add value

- **Domain or business context**: capture rules, policies, or edge cases not evident from code.
- **Non-obvious algorithms or patterns**: explain unconventional control flow or defensive code paths.
- **Integration nuances**: document assumptions about external systems or data contracts.
- **Preconditions and invariants**: call out expectations that guide safe use.
- **Suppressed warnings**: pair `// @ts-expect-error` or lint suppressions with a justification.

Use TSDoc/JSDoc blocks sparingly for exported symbols when consumers need extra context beyond the type signature.

## When comments are harmful

- Obvious statements about what the code already says.
- Duplicating type information or parameter descriptions.
- Narrating straightforward control flow without additional insight.
- Commented-out code; rely on version control history.

## Hygiene

- Re-evaluate comments during code reviews and refactors.
- Do not include secrets, tokens, or sensitive identifiers.
- Reference external resources with stable links when they inform behavior.
- If a comment documents a temporary workaround, annotate it with the issue that will remove it.
