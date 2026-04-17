import { describe, it, expect } from 'vitest';
import { sourceLabel } from '../source.helpers.js';

describe('sourceLabel', () => {
  it.each<['carbon-pulse' | 'esgnews' | 'trellis', string]>([
    ['carbon-pulse', 'Carbon Pulse'],
    ['esgnews', 'ESG News'],
    ['trellis', 'Trellis'],
  ])('maps %s to %s', (source, expected) => {
    expect(sourceLabel(source)).toBe(expected);
  });
});
