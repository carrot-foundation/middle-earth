type RadiusOptions = 'full' | 0 | 100 | 200 | 400;

export const RADIUS = (value: RadiusOptions) =>
  value === 'full' ? '9999px' : `${(value * 4) / 100}px`;
