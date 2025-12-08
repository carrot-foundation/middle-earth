# Scripts

This directory contains utility scripts for the middle-earth monorepo.

## version-ai-rules.js

Automated versioning script for `.ai/` folder rules using `standard-version`.

### Purpose

Automatically updates version numbers in `.ai/manifest.json` and rule files based on conventional commit messages using the `standard-version` library.

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

The script uses `standard-version` which analyzes commit messages following Conventional Commits:

- **BREAKING CHANGE** or `BREAKING:` → **Major** version bump (1.0.0 → 2.0.0)
- **feat** → **Minor** version bump (1.0.0 → 1.1.0)
- **fix**, **refactor**, **docs**, **style**, **test**, **chore**, **perf**, **build**, **ci** → **Patch** version bump (1.0.0 → 1.0.1)

The version bump type is determined from the last commit message.

### What Gets Updated

1. **manifest.json** (via `standard-version`):
   - Global `version` field
   - `lastUpdated` timestamp (updated manually in script)
   - All rule versions in metadata (updated manually in script)

2. **Rule files** (`.md` files in `categories/` via `update-ai-frontmatter-versions.js`):
   - Frontmatter `version` field
   - Frontmatter `lastUpdated` field

The `update-ai-frontmatter-versions.js` script runs as a `standard-version` prerelease hook to sync frontmatter versions with `manifest.json`.

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

### Configuration

Configuration is in `.versionrc.json`:
- Skips changelog, commit, and tag generation
- Updates `.ai/manifest.json` version
- Runs `update-ai-frontmatter-versions.js` as prerelease hook

### Troubleshooting

If the script fails:

1. Check that `.ai/manifest.json` exists and is valid JSON
2. Verify rule files have YAML frontmatter
3. Ensure commit message follows Conventional Commits format
4. Check file permissions on `.ai/` directory
5. Verify `standard-version` is installed: `pnpm list standard-version`
6. Check `.versionrc.json` configuration is valid
