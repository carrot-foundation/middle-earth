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
