import { describe, it, expect } from 'vitest';
import { sourceLabel, compactSourceLabel } from '../source.helpers.js';

describe('sourceLabel', () => {
  it.each<['carbon-pulse' | 'esgnews' | 'trellis' | 'a16z-crypto', string]>([
    ['carbon-pulse', 'Carbon Pulse'],
    ['esgnews', 'ESG News'],
    ['trellis', 'Trellis'],
    ['a16z-crypto', 'a16z crypto'],
  ])('returns label for %s', (source, expected) => {
    expect(sourceLabel(source)).toBe(expected);
  });
});

describe('compactSourceLabel', () => {
  it.each<['carbon-pulse' | 'esgnews' | 'trellis' | 'a16z-crypto', string]>([
    ['carbon-pulse', 'CP'],
    ['esgnews', 'ESG'],
    ['trellis', 'Trellis'],
    ['a16z-crypto', 'a16z'],
  ])('returns compact label for %s', (source, expected) => {
    expect(compactSourceLabel(source)).toBe(expected);
  });
});
