---
name: review-pr
description: 'Review pull requests for quality, correctness, and adherence to Middle Earth project standards.'
---

Review PRs with focus on correctness, quality, and Middle Earth standards.

### Correctness

- Does the code do what the PR claims?
- Are edge cases handled?
- Are there potential runtime errors or type issues?

### Standards compliance

- **TypeScript**: Strict mode compliance, no `any`, explicit return types
- **Imports**: Path aliases (`@middle-earth/libs/publishable/*`), NOT relative imports
- **Testing**: Jest with proper patterns

### Quality

- Is the PR focused on one concern?
- Are changes minimal and necessary?
- Are there leftover TODOs, debug code, or commented-out blocks?

### PR hygiene

- Title is descriptive (not conventional commit format)
- Description explains what and why
- Size is reviewable (< 400 lines preferred)

### Feedback format

```markdown
## PR Review

### Critical (must fix)
- [Issue and location]

### Suggestions (should fix)
- [Issue and location]

### Nits (optional)
- [Minor improvements]

### Positive
- [What was done well]
```
