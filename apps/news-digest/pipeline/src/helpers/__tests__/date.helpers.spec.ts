import { describe, it, expect } from 'vitest';
import { parseDate } from '../date.helpers.js';

describe('parseDate', () => {
  // Timezone-deterministic inputs only — the UTC-slice timezone boundary
  // behaviour is intentionally unchanged and tracked in deferred-work.md.
  it.each([
    ['2026-05-10T08:00:00Z', '2026-05-10'],
    ['2026-05-10', '2026-05-10'],
    ['2026-03-09T12:00:00.000Z', '2026-03-09'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it.each(['', 'not-a-date', '   ', 'tomorrow'])(
    'returns "" for unparseable input %j',
    (input) => {
      expect(parseDate(input)).toBe('');
    },
  );
});
