import { FREQUENCY_DAYS } from '../config.constants.js';
import type { ThemeConfig } from '../types.js';

export function getEligibleThemes(
  themes: readonly ThemeConfig[],
  themeLastProcessed: Readonly<Record<string, string>>,
  today: string,
): ThemeConfig[] {
  const todayMs = new Date(today).getTime();

  return themes.filter((theme) => {
    const minDays = FREQUENCY_DAYS[theme.frequency];
    if (minDays === undefined) return false;
    if (minDays === 0) return true;

    const lastProcessed = themeLastProcessed[theme.name];
    if (!lastProcessed) return true;

    const lastMs = new Date(lastProcessed).getTime();
    const daysSince = (todayMs - lastMs) / (1000 * 60 * 60 * 24);

    return daysSince >= minDays;
  });
}

/**
 * Parse the comma-separated `THEMES_FILTER` env var into a normalized set of
 * theme names. Whitespace around each name is trimmed; empty entries dropped.
 * Returns `undefined` when the input is unset/blank, signalling "no filter".
 *
 * Operational knob for cheap one-theme validation runs — `daily` themes are
 * unconditionally eligible (`minDays === 0` in `getEligibleThemes`), so state
 * pre-seeding alone cannot drop below 5 themes.
 */
export function parseThemesFilter(raw: string | undefined): Set<string> | undefined {
  if (!raw) return undefined;
  const names = raw.split(',').map((name) => name.trim()).filter((name) => name.length > 0);
  if (names.length === 0) return undefined;
  return new Set(names);
}

/**
 * Restrict `themes` to those whose name appears in `allowed`. When `allowed`
 * is `undefined` the input list is returned unchanged (no filter active).
 */
export function applyThemesFilter(
  themes: readonly ThemeConfig[],
  allowed: ReadonlySet<string> | undefined,
): ThemeConfig[] {
  if (!allowed) return [...themes];
  return themes.filter((theme) => allowed.has(theme.name));
}
