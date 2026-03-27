# AGENTS.md

Middle Earth AI instructions for Codex, Claude, and Cursor with equal capability parity.

## Equality rule

- Cursor, Claude, and Codex are treated as equals.
- No platform is primary for instruction definition.
- Canonical source: `.ai/`.

## Canonical workflow

1. Edit canonical files in `.ai/`.
2. Run `pnpm ai:sync` to regenerate platform adapters.
3. Run `pnpm ai:check` to validate parity and links.

## Current capability counts

- Rules: 11
- Skills: 9
- Agents/Roles: 2

## Available skills

- `check` - Run Middle Earth quality gates (lint, test, build) without committing. Runs AI instruction checks when .ai/ files are affected.
- `commit` - Commit Changes
- `create-branch` - Create Branch
- `create-clickup-task` - Create ClickUp Task
- `create-pr` - Create Pull Request
- `debug` - Structured debugging workflow for errors, test failures, build issues, and unexpected behavior in the Middle Earth monorepo.
- `finish-work` - End-to-end workflow to ship code changes as a PR. Creates branch, runs quality gates, commits changes, and creates PR.
- `review-pr` - Review pull requests for quality, correctness, and adherence to Middle Earth project standards.
- `unit-test` - Run and write Jest unit tests following Middle Earth patterns.

## Rule mappings

- `rule-branch-naming` - Git branch naming conventions aligned with Conventional Commits
- `rule-clickup-task` - ClickUp task creation and refinement standards
- `rule-code-comments` - Code comment guidelines for all languages
- `rule-code-preservation` - Code preservation rules - never delete or revert code without explicit approval
- `rule-code-style` - Middle Earth code style conventions (TypeScript/JavaScript)
- `rule-commit` - Conventional Commit message standards with Middle Earth scopes
- `rule-documentation` - Markdown documentation standards
- `rule-pull-request` - Pull request workflow and quality standards
- `rule-pull-request-description` - Pull request description format and content standards
- `rule-testing` - Middle Earth testing baseline guidelines (unit tests with Jest)
- `rule-typescript` - Middle Earth TypeScript baseline guidelines (compiler, modules, best practices)

## Agent roles

- `debugger` - Debugging specialist for errors, test failures, and unexpected behavior. Use proactively when you hit failures that need root-cause analysis.
- `verifier` - Validates completed work. Use after tasks are marked done to confirm implementations are functional and meet project standards.

## Canonical references

- `.ai/README.md`
- `.ai/DEFINITIONS.md`
- `.ai/STANDARDS.md`
- `.ai/PARITY_MATRIX.md`
- `.ai/PROJECT_CONTEXT.md`

## Runtime adapter paths

- Cursor: `.cursor/rules/`, `.cursor/skills/`, `.cursor/agents/`
- Claude: `.claude/settings.json`, `.claude/skills/`, `.claude/agents/`
- Codex: `.agents/skills/`, `AGENTS.md`

## Setup commands (workspace)

- Install deps: `pnpm install`
- Run lint (affected): `pnpm lint:affected`
- Run tests: `pnpm nx affected --target test`
- Build: `pnpm nx affected --target build`
- Validate AI instructions: `pnpm ai:check`

# Middle Earth Project Context

Project-specific knowledge for AI assistants working on Middle Earth. This content is appended to the generated CLAUDE.md adapter.

## Project Overview

Middle Earth is a monorepo for Carrot Foundation's publishable libraries. It contains shared packages consumed by other Carrot repos. There are no applications — only publishable libraries.

- **@carrot-foundation/eslint-config-carrot** — Shared ESLint configuration
- **@carrot-foundation/web-logger** — Pino-based logger utility for web applications
- **@carrot-foundation/web-ui** — React UI component library (MUI-based, atomic design)

## Technology Stack

- **Monorepo**: Nx 21.6.3 workspace with pnpm 10.2.0
- **Node**: 22.20.0 (see `.nvmrc`)
- **Language**: TypeScript 5.3.3 (strict mode, verbatimModuleSyntax)
- **Frontend**: React 19, Next.js 15.5.4, MUI 7.x
- **Logging**: Pino 10.x
- **Build**: SWC (swc/cli, swc/core)
- **Testing**: Jest 29.4.1 with @nx/jest
- **Linting**: ESLint 8.56.0 (Airbnb, SonarJS, Unicorn, Security, Perfectionist, Prettier)
- **Release**: Semantic Release 22.0.12 with independent versioning
- **Git Hooks**: Husky 9.x with lint-staged
- **Commit Linting**: Commitlint with cz-git

## Architecture

### Directory Structure

```
libs/publishable/
  eslint-config-carrot/     # @carrot-foundation/eslint-config-carrot
  web/
    logger/                 # @carrot-foundation/web-logger
    ui/                     # @carrot-foundation/web-ui
      src/lib/
        atoms/              # Basic components (Button, Icons)
        molecules/          # Composed components (Share)
        theme/              # Theme configuration and providers
```

### Path Aliases

Defined in `tsconfig.base.json`:

- `@middle-earth/libs/publishable/eslint-config-carrot`
- `@middle-earth/libs/publishable/web/logger`
- `@middle-earth/libs/publishable/web/ui`

### UI Library (web-ui)

- Follows **atomic design**: atoms, molecules, theme
- Built on **MUI 7.x** with custom theme
- Uses **React 19** features

### Key Constraints

- **Libraries only**: No application code — all libraries in `libs/publishable/`
- **Publishable**: All libraries are published to npm under `@carrot-foundation/`
- **Independent versioning**: Each library versioned separately via semantic-release
- **Path aliases required**: Use `@middle-earth/libs/publishable/*`, NOT relative `../../..`

## Common Commands

### Development

```bash
# Build a library
pnpm nx build <project-name>

# Run tests
pnpm nx test <project-name>

# Run linting
pnpm nx lint <project-name>
```

### Affected Commands

```bash
# Lint affected projects
pnpm lint:affected                     # nx affected --target lint --fix

# Test affected projects (not available — use nx directly)
pnpm nx affected --target test

# Build affected projects (not available — use nx directly)
pnpm nx affected --target build
```

### Utilities

```bash
# Commitizen (guided commit message)
pnpm commit                            # czg

# Validate package.json files
pnpm pkgJsonLint                       # npmPkgJsonLint .

# Spell check
pnpm spellcheck                        # cspell (if configured)
```

## Code Standards

**Baseline standards**: see `.ai/rules/` for all rules.

### TypeScript

- **Strict mode**: `strict: true`, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`
- **Imports**: Use path aliases (`@middle-earth/libs/publishable/*`), NOT relative `../../..`
- **No `any`**: Favor precise types and narrowing
- **Return types**: Explicit for exported functions and public APIs
- **File organization**: `*.constants.ts`, `*.helpers.ts`, `*.types.ts`

### Testing

- **Jest** as test runner (NOT Vitest)
- **Unit tests**: `*.spec.ts(x)` in `__tests__/` folders
- **Mocking**: `jest.mock` for modules, `jest.spyOn` for side effects
- **Table-driven tests**: `it.each` for input/output matrices
- **Coverage**: Aim for 100% where feasible

## Commit Message Guidelines

### Quick Reference

- **Format**: `<type>(optional scope): <description>`
- **Types**: `feat`, `fix`, `refactor`, `docs`, `test`, `style`, `perf`, `build`, `ci`, `chore`, `revert`
- **Imperative mood**: "add", "fix", "update" (NOT "added", "fixed", "updated")
- **Lowercase**: Description starts with lowercase letter
- **No period**: Description does NOT end with a period

### Middle Earth Scopes

- **`config`**: Root-level configuration files (nx.json, tsconfig.base.json, ESLint, commitlint)
- **`lib`**: Libraries in `libs/publishable/`
- **`release`**: Versioning, releases, publishing
- **`ai`**: AI instructions and rules

### Examples

```
feat(lib): add Button component to UI library
chore(config): update ESLint rules for TypeScript files
chore(release): bump eslint-config-carrot to 0.9.0
refactor(lib): simplify logger initialization
```

## Nx Configuration

- **Plugins**: @nx/eslint/plugin, @nx/jest/plugin
- **Default Base**: main branch
- **Build**: `@nx/js:swc` compiler
- **Targets per library**: build, lint, test, types, package, publish, release
- **Project Tags**: `type:lib`

## Important Notes

- **Package Manager**: pnpm ONLY (enforced by `preinstall` script)
- **Node Version**: 22.20.0 (check `.nvmrc`)
- **Husky Hooks**: Git hooks for pre-commit linting via lint-staged
- **Renovate**: Dependency updates automated with config in `renovate.json`
- **No Docker**: Libraries only — no container builds
- **No Infrastructure**: No Terraform, no AWS resources

## Troubleshooting

### Clear Caches

```bash
pnpm nx reset
```

### Dependency Issues

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```
