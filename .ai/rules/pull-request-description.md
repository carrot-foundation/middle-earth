---
id: pull-request-description
intent: 'Pull request description format and content standards'
scope:
  - '*'
requirements:
  - 'Follow .github/pull_request_template.md structure'
  - 'Remove sections that do not apply'
  - 'Include specific file paths, commands, and testing instructions'
  - 'Remove all HTML comments from final description'
anti_patterns:
  - 'Leaving placeholder text in description'
  - 'Empty sections or N/A markers'
  - 'Generic descriptions without specific context'
---

# Pull Request Description Rule

## Rule body

# PR description standards (Middle Earth)

## Template requirements

- **Follow** `.github/pull_request_template.md` structure exactly
- **Remove** sections that do not apply (do not leave empty or "N/A")
- **Include** specific file paths, commands, and testing instructions
- **Focus** on user/business value in summary and context
- **Complete** all checklist items or explain why they do not apply
- **No placeholders** — all content must be meaningful and specific
- **Remove all HTML comments** after addressing their content

## Section handling

- **Deployment Notes**: Only include if there are actual deployment considerations. If none, omit the section.
- **Related Links**: Only include if there are actual links. If none, omit the section.
- **Checkboxes**: Check completed items, leave unchecked items that need action.

## Comment handling

- Remove all HTML comments (`<!-- -->`) from the final PR description
- Address comment content before removing
- Clean, production-ready markdown without development artifacts
