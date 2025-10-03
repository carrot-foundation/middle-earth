import type { Paths } from 'type-fest';

import { defaultTo } from 'remeda';

import { COLORS, type Stroke } from './palette';

interface BorderOptions {
  default: string;
  focus: string;
  icon: {
    large: string;
    medium: string;
    small: string;
  };
}

export const borderOptions: BorderOptions = {
  default: '1px solid',
  focus: '2px solid',
  icon: {
    large: '3px solid',
    medium: '2px solid',
    small: '1.6px solid',
  },
};

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function getObjectNestedValueFromPath(
  initialValue: unknown,
  pathParts: string[],
): unknown {
  // eslint-disable-next-line unicorn/no-array-reduce
  return pathParts.reduce<unknown>((object, part) => {
    if (
      isObject(object) &&
      Object.prototype.hasOwnProperty.call(object, part)
    ) {
      // eslint-disable-next-line security/detect-object-injection
      return object[part] ?? null;
    }

    return null;
  }, initialValue);
}

console.log('test');

export const BORDER = (
  value: Paths<BorderOptions>,
  color: NonNullable<Paths<Stroke>>,
) => {
  const borderValue = String(
    defaultTo(
      getObjectNestedValueFromPath(borderOptions, String(value).split('.')),
      borderOptions.default,
    ),
  );
  const borderColor = String(
    defaultTo(
      getObjectNestedValueFromPath(COLORS.STROKE, String(color).split('.')),
      '',
    ),
  );

  return `${borderValue} ${borderColor}`;
};
