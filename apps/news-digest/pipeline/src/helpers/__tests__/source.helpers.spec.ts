import { describe, it, expect } from 'vitest';
import { sourceLabel, compactSourceLabel } from '../source.helpers.js';

describe('sourceLabel', () => {
  it.each<['carbon-pulse' | 'esgnews' | 'trellis', string]>([
    ['carbon-pulse', 'Carbon Pulse'],
    ['esgnews', 'ESG News'],
    ['trellis', 'Trellis'],
  ])('maps %s to %s', (source, expected) => {
    expect(sourceLabel(source)).toBe(expected);
  });
});

describe('compactSourceLabel', () => {
  it.each<['carbon-pulse' | 'esgnews' | 'trellis', string]>([
    ['carbon-pulse', 'CP'],
    ['esgnews', 'ESG'],
    ['trellis', 'Trellis'],
  ])('maps %s to %s', (source, expected) => {
    expect(compactSourceLabel(source)).toBe(expected);
  });
});
