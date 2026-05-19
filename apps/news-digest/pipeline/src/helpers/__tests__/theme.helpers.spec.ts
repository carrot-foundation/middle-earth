import { describe, it, expect } from 'vitest';
import { applyThemesFilter, getEligibleThemes, parseThemesFilter } from '../theme.helpers.js';
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

describe('parseThemesFilter', () => {
  it('returns undefined for unset / empty input', () => {
    expect(parseThemesFilter(undefined)).toBeUndefined();
    expect(parseThemesFilter('')).toBeUndefined();
    expect(parseThemesFilter('   ')).toBeUndefined();
    expect(parseThemesFilter(',, ,')).toBeUndefined();
  });

  it('parses a comma-separated list, trimming whitespace', () => {
    expect(parseThemesFilter('Carrot Mentions')).toEqual(new Set(['Carrot Mentions']));
    expect(parseThemesFilter('Carrot Mentions, Carbon Markets')).toEqual(
      new Set(['Carrot Mentions', 'Carbon Markets']),
    );
    expect(parseThemesFilter('  Carrot Mentions  ,  Carbon Markets  ')).toEqual(
      new Set(['Carrot Mentions', 'Carbon Markets']),
    );
  });

  it('drops empty entries from a malformed list', () => {
    expect(parseThemesFilter('Carrot Mentions,,Carbon Markets,')).toEqual(
      new Set(['Carrot Mentions', 'Carbon Markets']),
    );
  });
});

describe('applyThemesFilter', () => {
  it('returns the input unchanged when no filter is provided', () => {
    const result = applyThemesFilter(THEMES, undefined);
    expect(result).toEqual([...THEMES]);
  });

  it('keeps only themes whose name is in the allowlist', () => {
    const result = applyThemesFilter(THEMES, new Set(['Carrot Mentions']));
    expect(result.map((theme) => theme.name)).toEqual(['Carrot Mentions']);
  });

  it('ignores unknown names without erroring', () => {
    const result = applyThemesFilter(THEMES, new Set(['Not A Real Theme', 'Carbon Markets']));
    expect(result.map((theme) => theme.name)).toEqual(['Carbon Markets']);
  });

  it('returns empty when the allowlist matches no themes', () => {
    const result = applyThemesFilter(THEMES, new Set(['Nothing Matches']));
    expect(result).toEqual([]);
  });
});
