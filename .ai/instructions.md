# Carrot Foundation AI Instructions

This document provides a comprehensive overview of the Carrot Foundation's development guidelines. These are **general organizational standards** that apply across all projects, though **specific project guidelines may override these standards** when documented at the project level.

## Code Style Guidelines

**Reference**: `.ai/code-styles.md`

### Key Principles
- **Naming**: Use descriptive names, avoid abbreviations, functions are verbs, variables are nouns
- **Structure**: One responsibility per module, organize by file type (`*.constants.ts`, `*.types.ts`, `*.helpers.ts`, `*.dtos.ts`)
- **Control Flow**: Favor guard clauses and early returns, keep nesting ≤ 2 levels
- **Dependencies**: Use path aliases from `tsconfig.base.json`, respect ESLint module boundaries
- **Error Handling**: Validate inputs with `typia` assertions, enrich errors with context
- **Testing**: Tests in `__tests__` folders using `*.spec.ts(x)`, strive for 100% coverage
- **Performance**: Prefer pure functions and immutable data structures
- **Formatting**: End files with single trailing empty line, run formatter/linter with `--fix`

## TypeScript Guidelines

**Reference**: `.ai/typescript.md`

### Compiler Requirements
- Follow `tsconfig.base.json` settings: `strict` mode, `verbatimModuleSyntax`, `noUnusedLocals/Parameters`
- Use provided path aliases, avoid relative imports (`../../..`)
- No `any` or unsafe casts, favor precise types

### Module Organization
- Import from library barrels (`src/index.ts`), avoid deep imports
- Export public types from barrels
- Explicit return types for exported functions and public APIs

### Best Practices
- Use `Result`-like patterns for error handling
- Input validation with `typia` at module boundaries
- Leverage `type-fest` utilities and `@project-name/shared/types`
- Follow ESLint config (Airbnb, SonarJS, Unicorn, Security, Promise, Perfectionist, Prettier)
- Avoid default exports except when required by frameworks or intentional API design

## Commit Message Standards

**Reference**: `.ai/commit.md`

### Format Requirements
- **Structure**: `<type>(optional scope): <description>`
- **MUST** follow Conventional Commits specification
- **MUST** use imperative mood (add, fix, update)
- **MUST** start description with lowercase letter
- **MUST NOT** end description with period
- **MUST** keep header ≤ 100 characters
- **SHOULD** keep description ≤ 72 characters

### Common Types (by frequency)
1. `feat` - new feature/functionality
2. `fix` - bug fix/error correction
3. `refactor` - code restructuring without functional changes
4. `docs` - documentation changes only
5. `test` - adding/modifying tests
6. `style` - formatting changes (no logic changes)
7. `perf` - performance improvements
8. `build` - build system/dependency changes
9. `ci` - CI/CD configuration changes
10. `chore` - maintenance tasks
11. `revert` - revert previous commit

### Scoping Strategy
- Use domain as primary scope when affecting specific business domain/entity
- Optionally append main scope to domain using `/` for clarity
- Check `commitlint.config.js` for latest scope definitions

## Pull Request Guidelines

**Reference**: `.ai/pull_request.md`

### Workflow Process
1. **Gather Information**: Use git commands to analyze changes and affected projects
2. **Assess Context**: Ask for clarification if commits/changes are unclear
3. **Create Description**: Follow `.github/pull_request_template.md` structure
4. **Output Command**: Provide GitHub CLI command for manual execution

### PR Title Format
- **Clear and descriptive** (NOT Conventional Commit format)
- **Start with capital letter**, sentence case
- **Aim for 50-60 characters maximum**
- **Focus on outcome**, not implementation
- **Use plain English**, avoid technical jargon

### Description Requirements
- **MUST** use existing template at `.github/pull_request_template.md`
- **Remove** sections that don't apply (no empty/N/A sections)
- **Remove all HTML comments** (`<!-- -->`) after addressing content
- **Include** specific file paths, commands, testing instructions
- **Save** to `tmp/pull-requests/{branch-name}.md`
- **Complete** all applicable checklist items

### Information Gathering Commands
```bash
git log --oneline <base-branch>..HEAD
git diff --stat <base-branch>..HEAD
git diff <base-branch>..HEAD --name-only
pnpm nx show projects --affected  # if available
```

## Branch Naming Conventions

**Reference**: `.ai/pull_request.md`

### Preferred Patterns
```text
<type>/<short-description>[-<TICKET>]
<type>/<scope>-<short-description>[-<TICKET>]
```

### Examples
```text
feat/web-add-real-time-dashboard
fix/smart-contracts-prevent-overflow
CARROT-123/feat/app-implement-auth-flow
```

## ClickUp Task Management Guidelines

**Reference**: `.ai/clickup-task-creation.md`

### Core Principles
- **Question everything**: Challenge assumptions, suggest improvements, prevent poorly-scoped work
- **Be concise**: Provide necessary context without being text-heavy
- **Be practical**: Include code snippets and specific implementation hints when helpful
- **Be ruthless with scope**: Aggressively suggest breaking down large tasks
- **Remove noise**: Delete optional sections that don't add value

### Task Metadata Requirements
- **Category**: Feature | Bug | Tech. Debt | Spike | Other
- **Scope**: Back | Front | Infra | Web3 | Other
- **Priority**: Low | Normal | High | Urgent
- **Effort (Fibonacci)**: 1 (≤1 day) | 2 (1-2 days) | 3 (2-3 days) | 5 (3-5 days)

### Task Template Structure
- **TL;DR**: Single sentence with context (max 25 words) - remove if redundant
- **Context**: Why this exists, background - remove if not adding value
- **Business Rules**: Specific constraints or requirements as checklist
- **Value Delivery**: Why, Value, For whom (always required)
- **Implementation Suggestions**: Architecture hints, code snippets, gotchas - remove if not specific
- **References**: Direct links to resources - remove if none provided
- **Definition of Done**: Specific, testable completion criteria as checklist (always required)

### Workflow Approach
1. **Context Gathering**: Ask about problem, affected component, beneficiaries, expected effort
2. **Critical Analysis**: Challenge scope, urgency, clarity, and approach
3. **Task Creation**: Use active criticism, question vague requirements
4. **DoD Creation**: Match checklist to task type (Feature/Bug/Tech. Debt/Spike)
5. **Template Optimization**: Remove sections that don't add value

### Assistant Execution Rules
- Always set Category and Scope using custom fields, not tags
- Use emojis consistently in titles when appropriate
- Return task link after creation for user review
- Provide follow-up instructions: review description, remove blank lines, add sprint points, verify formatting
- Use `@{ClickUp}` MCP when performing these tasks

## Important Reminders

1. **Project-Specific Overrides**: Always check for project-specific guidelines that may supersede these general standards
2. **Template Usage**: PR descriptions MUST use existing templates when available
3. **Quality Gates**: Ask for clarification when commits, changes, or business context is unclear
4. **Web3/Fintech Context**: Consider Carrot Foundation's business domain when making decisions
5. **Tooling Integration**: Leverage ESLint, Prettier, and other configured tools
6. **Documentation**: Keep guidelines current and reference `commitlint.config.js` for latest scopes

## AI Usage Guidelines

**CRITICAL**: This instructions.md file provides only a **summary** of the guidelines. When working with specific tasks or when users ask for detailed guidance:

1. **Always read the source files** mentioned in the references when you need complete details
2. **Read each guideline file separately** when implementing specific features (e.g., read `.ai/commit.md` when creating commits, `.ai/pull_request.md` when creating PRs)
3. **Cross-reference multiple files** when tasks span multiple domains (e.g., TypeScript + Code Style guidelines)
4. **Verify current content** by reading the actual files rather than relying solely on this summary
5. **Ask for clarification** if guideline files are unclear or conflicting

**File References for Direct Reading**:
- `.ai/code-styles.md` - Complete code style guidelines
- `.ai/typescript.md` - Full TypeScript-specific standards  
- `.ai/commit.md` - Detailed commit message specifications
- `.ai/pull_request.md` - Complete PR workflow and template requirements
- `.ai/clickup-task-creation.md` - Complete click task creation guideline

This ensures you have the most current and complete guidance for each specific task.

These guidelines ensure consistency across the Carrot Foundation organization while maintaining flexibility for project-specific requirements.
