import { describe, it, expect } from 'vitest';
import { parseHumanDate } from '../carbon-pulse.js';

describe('parseHumanDate', () => {
  it.each<[string, string]>([
    ['2026-04-09', '2026-04-09'],
    ['April 9, 2026', '2026-04-09'],
    ['9 April 2026', '2026-04-09'],
    ['Apr 9, 2026', '2026-04-09'],
  ])('normalizes %s to ISO', (input, expected) => {
    expect(parseHumanDate(input)).toBe(expected);
  });

  it.each<[string]>([[''], ['garbage'], ['not-a-date']])(
    'returns empty string for unparseable input %s',
    (input) => {
      expect(parseHumanDate(input)).toBe('');
    },
  );
});
