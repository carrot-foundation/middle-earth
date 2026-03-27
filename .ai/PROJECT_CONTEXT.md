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
