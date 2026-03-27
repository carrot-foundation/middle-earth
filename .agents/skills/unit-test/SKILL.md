---
name: unit-test
description: 'Run and write Jest unit tests following Middle Earth patterns.'
---

Run and write Jest unit tests following Middle Earth patterns.

### Running tests

```bash
# Test a specific project
pnpm nx test <project-name>

# Test all projects
pnpm nx run-many --target test
```

### File structure

Tests are colocated with source in `__tests__/` directories:

```
src/lib/
├── my-component.ts
├── __tests__/
│   └── my-component.spec.ts
```

### Test patterns

**React components (Testing Library):**

```typescript
import { render, screen } from '@testing-library/react';
import { Button } from '../button';

describe('Button', () => {
  it('renders with label', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

**Table-driven tests:**

```typescript
it.each([
  ['valid input', validData, true],
  ['invalid input', invalidData, false],
])('validates %s', (_, input, expected) => {
  expect(isValid(input)).toBe(expected);
});
```

### What NOT to do

- No `.only` in tests (disallowed by lint rule)
- No `any` type assertions
- No testing implementation details (test behavior)

### Coverage

Aim for 100% coverage where feasible. Use `expect.objectContaining` for flexible assertions.
