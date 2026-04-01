import { describe, it, expect } from 'vitest';
import { getEligibleThemes } from '../theme.helpers.js';
import { THEMES } from '../../config.constants.js';

describe('getEligibleThemes', () => {
  const today = '2026-03-27';

  it('returns all daily themes when no prior processing', () => {
    const result = getEligibleThemes(THEMES, {}, today);
    const dailyThemes = THEMES.filter((t) => t.frequency === 'daily');
    expect(result).toEqual(expect.arrayContaining(dailyThemes));
  });

  it('returns weekly theme when last processed more than 7 days ago', () => {
    const themeLastProcessed = { 'Carbon Markets': '2026-03-15' };
    const result = getEligibleThemes(THEMES, themeLastProcessed, today);
    expect(result.find((t) => t.name === 'Carbon Markets')).toBeDefined();
  });

  it('skips weekly theme when last processed less than 7 days ago', () => {
    const themeLastProcessed = { 'Carbon Markets': '2026-03-25' };
    const result = getEligibleThemes(THEMES, themeLastProcessed, today);
    expect(result.find((t) => t.name === 'Carbon Markets')).toBeUndefined();
  });

  it('returns monthly theme when last processed more than 30 days ago', () => {
    const themeLastProcessed = { 'Verification & Auditing': '2026-02-20' };
    const result = getEligibleThemes(THEMES, themeLastProcessed, today);
    expect(result.find((t) => t.name === 'Verification & Auditing')).toBeDefined();
  });

  it('skips monthly theme when last processed less than 30 days ago', () => {
    const themeLastProcessed = { 'Verification & Auditing': '2026-03-10' };
    const result = getEligibleThemes(THEMES, themeLastProcessed, today);
    expect(result.find((t) => t.name === 'Verification & Auditing')).toBeUndefined();
  });

  it('returns weekly theme when never processed before', () => {
    const result = getEligibleThemes(THEMES, {}, today);
    expect(result.find((t) => t.name === 'Carbon Markets')).toBeDefined();
  });
});
