# Scripts

This directory contains utility scripts for the middle-earth monorepo.

## version-ai-rules.js

Automated versioning script for `.ai/` folder rules.

### Purpose

Automatically updates version numbers in `.ai/manifest.json` and rule files based on conventional commit messages.

### Usage

**Automatic (via Husky):**

- Runs automatically after each commit via `.husky/post-commit` hook
- Only runs if `.ai/` files were changed in the commit

**Manual:**

```bash
pnpm version:ai
# or
node scripts/version-ai-rules.js
```

### Version Bump Logic

The script analyzes the last commit message and determines the version bump type:

- **BREAKING CHANGE** or `BREAKING:` → **Major** version bump (1.0.0 → 2.0.0)
- **feat** → **Minor** version bump (1.0.0 → 1.1.0)
- **fix**, **refactor**, **docs**, **style**, **test**, **chore**, **perf**, **build**, **ci** → **Patch** version bump (1.0.0 → 1.0.1)

### What Gets Updated

1. **manifest.json**:

   - Global `version` field
   - `lastUpdated` timestamp
   - All rule versions in metadata

2. **Rule files** (`.md` files in `categories/`):
   - Frontmatter `version` field
   - Frontmatter `lastUpdated` field

### Examples

```bash
# Commit with feat → minor bump
git commit -m "feat(ai): add new testing guidelines"
# Version: 1.0.0 → 1.1.0

# Commit with fix → patch bump
git commit -m "fix(ai): correct typo in commit guidelines"
# Version: 1.1.0 → 1.1.1

# Commit with BREAKING CHANGE → major bump
git commit -m "feat(ai): BREAKING CHANGE: restructure commit format"
# Version: 1.1.1 → 2.0.0
```

### Behavior

- **Skips if no .ai/ files changed**: Only runs when `.ai/` files are modified
- **Idempotent**: Safe to run multiple times
- **Non-destructive**: Only updates version fields, doesn't modify rule content
- **Automatic date updates**: Updates `lastUpdated` to current date

### Troubleshooting

If the script fails:

1. Check that `.ai/manifest.json` exists and is valid JSON
2. Verify rule files have YAML frontmatter
3. Ensure commit message follows Conventional Commits format
4. Check file permissions on `.ai/` directory
