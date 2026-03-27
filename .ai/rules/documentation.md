---
id: documentation
intent: 'Markdown documentation standards'
scope:
  - '**/*.md'
requirements:
  - 'Primary header as first line; overview within first 200 words'
  - 'Proper header hierarchy (no skipped levels)'
  - 'Always specify language for code blocks'
  - 'Use descriptive link text; prefer relative links'
anti_patterns:
  - 'Skipping header levels (h1 -> h3)'
  - 'Code blocks without language specification'
  - 'Using click here as link text'
---

# Documentation Rule

## Rule body

# Documentation standards

## Document structure

- Primary header (`# Title`) as the first line
- Overview/Description within the first 200 words
- Proper hierarchy — no skipped header levels (h1 -> h2 -> h3)
- Sentence case for headers

## Formatting

- Use `-` for unordered lists consistently
- Always specify language for code blocks
- Use backticks for inline code
- Use descriptive link text; avoid "click here"
- Prefer relative links for internal documentation

## Line length

- Soft limit: 80 characters
- Hard limit: 120 characters (exceptions for tables, URLs, code)

## File naming

- Use kebab-case for file names
- `README.md` for directory overviews
- `CHANGELOG.md` for version history
