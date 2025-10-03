interface PaletteColorShades {
  primary: string;
  'primary-active'?: string;
  'primary-bright'?: string;
  'primary-contrast'?: string;
  'primary-dark'?: string;
  'primary-hover'?: string;
  quaternary?: string;
  secondary: string;
  'secondary-active'?: string;
  'secondary-bright'?: string;
  'secondary-contrast'?: string;
  'secondary-hover'?: string;
  tertiary?: string;
  'tertiary-active'?: string;
  'tertiary-hover'?: string;
}

export interface PaletteColorVariants {
  brand?: PaletteColorShades;
  danger?: PaletteColorShades;
  disabled?: PaletteColorShades | string;
  disabledSecondary?: string;
  disabledTertiary?: string;
  miscellaneous?: PaletteColorShades;
  neutral?: PaletteColorShades;
  positive?: PaletteColorShades;
  subtle?: PaletteColorShades;
  warning?: PaletteColorShades;
}

export interface PrimitiveColor {
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  1000: string;
}

const STONE_COLD: PrimitiveColor = {
  100: '#EFEFEF',
  200: '#E6E6E6',
  300: '#CCCCCC',
  400: '#5A5A5A',
  500: '#515151',
  600: '#484848',
  700: '#444444',
  800: '#363636',
  900: '#282828',
  1000: '#1F1F1F',
} as const;

const TIFFANY_BLUE: PrimitiveColor = {
  100: '#E6F7F7',
  200: '#CCEFF0',
  300: '#99DFE0',
  400: '#00AEB2',
  500: '#008B8E',
  600: '#007A7D',
  700: '#00686B',
  800: '#005759',
  900: '#004647',
  1000: '#003435',
} as const;

const AMERICAN_ORANGE: PrimitiveColor = {
  100: '#FEF3E6',
  200: '#FEE7CC',
  300: '#FDCF99',
  400: '#F98800',
  500: '#C76D00',
  600: '#AE5F00',
  700: '#955200',
  800: '#7D4400',
  900: '#643600',
  1000: '#4B2900',
} as const;

const CULTURED: PrimitiveColor = {
  100: '#FFFFFF',
  200: '#F7F7F7',
  300: '#F5F5F5',
  400: '#EFEFEF',
  500: '#E5E5E5',
  600: '#DADADA',
  700: '#D6D6D6',
  800: '#C7C7C7',
  900: '#ADADAD',
  1000: '#949494',
} as const;

const GREEN: PrimitiveColor = {
  100: '#E8F7EF',
  200: '#D0EFDE',
  300: '#A1DFBE',
  400: '#14AE5C',
  500: '#108B4A',
  600: '#0E7A40',
  700: '#0C6837',
  800: '#0A572E',
  900: '#06341C',
  1000: '#042312',
} as const;

const YELLOW: PrimitiveColor = {
  100: '#FDF8E8',
  200: '#FBF0D1',
  300: '#F8E2A3',
  400: '#EDB618',
  500: '#BE9213',
  600: '#A67F11',
  700: '#8E6D0E',
  800: '#775B0C',
  900: '#5F490A',
  1000: '#473707',
} as const;

const RED: PrimitiveColor = {
  100: '#FDE9E9',
  200: '#FBD3D2',
  300: '#F7A7A5',
  400: '#EC221F',
  500: '#BD1B19',
  600: '#A51816',
  700: '#8E1413',
  800: '#761110',
  900: '#5E0E0C',
  1000: '#470A09',
} as const;

const AIRFORCE_BLUE: PrimitiveColor = {
  100: '#E6EBF5',
  200: '#CCD6EB',
  300: '#99ADD6',
  400: '#335CAD',
  500: '#003399',
  600: '#00297A',
  700: '#00246B',
  800: '#001F5C',
  900: '#001A4D',
  1000: '#00143D',
} as const;

const BACKGROUND = {
  brand: {
    primary: TIFFANY_BLUE[400],
    'primary-active': TIFFANY_BLUE[500],
    'primary-dark': TIFFANY_BLUE[600],
    'primary-hover': TIFFANY_BLUE[500],
    secondary: AMERICAN_ORANGE[400],
    'secondary-active': AMERICAN_ORANGE[500],
    'secondary-hover': AMERICAN_ORANGE[500],
  },
  danger: {
    primary: RED[500],
    'primary-active': RED[500],
    'primary-hover': RED[400],
    secondary: RED[100],
    'secondary-active': RED[300],
    'secondary-hover': RED[200],
  },
  disabled: {
    primary: CULTURED[500],
    secondary: CULTURED[900],
    tertiary: STONE_COLD[400],
  },
  miscellaneous: {
    primary: AIRFORCE_BLUE[500],
    secondary: AIRFORCE_BLUE[200],
    tertiary: AIRFORCE_BLUE[400],
  },
  neutral: {
    primary: CULTURED[100],
    'primary-active': CULTURED[200],
    'primary-hover': CULTURED[200],
    secondary: STONE_COLD[900],
    'secondary-active': STONE_COLD[800],
    'secondary-hover': STONE_COLD[800],
    tertiary: CULTURED[200],
    'tertiary-active': CULTURED[300],
    'tertiary-hover': CULTURED[300],
  },
  positive: {
    primary: GREEN[600],
    'primary-active': GREEN[600],
    'primary-hover': GREEN[500],
    secondary: GREEN[100],
    'secondary-active': GREEN[300],
    'secondary-hover': GREEN[200],
  },
  subtle: {
    primary: CULTURED[100],
    'primary-active': TIFFANY_BLUE[100],
    'primary-hover': TIFFANY_BLUE[100],
    secondary: CULTURED[100],
    'secondary-active': AMERICAN_ORANGE[100],
    'secondary-hover': AMERICAN_ORANGE[100],
  },
  warning: {
    primary: YELLOW[500],
    'primary-active': YELLOW[500],
    'primary-hover': YELLOW[400],
    secondary: YELLOW[100],
    'secondary-active': YELLOW[300],
    'secondary-hover': YELLOW[200],
  },
} as const satisfies PaletteColorVariants;

const STROKE = {
  brand: {
    primary: TIFFANY_BLUE[600],
    secondary: AMERICAN_ORANGE[500],
  },
  danger: {
    primary: RED[800],
    secondary: RED[300],
    tertiary: RED[400],
  },
  disabled: {
    primary: CULTURED[900],
    secondary: CULTURED[500],
    tertiary: STONE_COLD[400],
  },
  miscellaneous: {
    primary: AIRFORCE_BLUE[500],
    secondary: AIRFORCE_BLUE[200],
    tertiary: AIRFORCE_BLUE[400],
  },
  neutral: {
    primary: STONE_COLD[900],
    quaternary: CULTURED[100],
    secondary: STONE_COLD[700],
    tertiary: CULTURED[500],
  },
  positive: {
    primary: GREEN[800],
    secondary: GREEN[300],
    tertiary: GREEN[400],
  },
  subtle: {
    primary: CULTURED[300],
    secondary: TIFFANY_BLUE[300],
    tertiary: AMERICAN_ORANGE[300],
  },
  warning: {
    primary: YELLOW[800],
    secondary: YELLOW[300],
    tertiary: YELLOW[400],
  },
} as const satisfies PaletteColorVariants;

const TEXT = {
  brand: {
    primary: TIFFANY_BLUE[600],
    'primary-bright': TIFFANY_BLUE[400],
    'primary-contrast': TIFFANY_BLUE[100],
    secondary: AMERICAN_ORANGE[500],
    'secondary-bright': AMERICAN_ORANGE[400],
    'secondary-contrast': AMERICAN_ORANGE[100],
  },
  danger: {
    primary: RED[800],
    secondary: RED[300],
    tertiary: RED[400],
  },
  disabled: STONE_COLD[400],
  disabledSecondary: CULTURED[900],
  disabledTertiary: CULTURED[500],
  miscellaneous: {
    primary: AIRFORCE_BLUE[500],
    secondary: AIRFORCE_BLUE[200],
    tertiary: AIRFORCE_BLUE[400],
  },
  neutral: {
    primary: STONE_COLD[900],
    quaternary: STONE_COLD[400],
    secondary: CULTURED[100],
    tertiary: CULTURED[1000],
  },
  positive: {
    primary: GREEN[800],
    secondary: GREEN[300],
    tertiary: GREEN[400],
  },
  warning: {
    primary: YELLOW[800],
    secondary: YELLOW[300],
    tertiary: YELLOW[400],
  },
} as const satisfies PaletteColorVariants;

export const PRIMITIVE_COLORS = {
  AIRFORCE_BLUE,
  AMERICAN_ORANGE,
  CULTURED,
  GREEN,
  RED,
  STONE_COLD,
  TIFFANY_BLUE,
  YELLOW,
} as const;

export const COLORS = {
  BACKGROUND,
  STROKE,
  TEXT,
} as const;

export type Background = typeof BACKGROUND;
export type Stroke = typeof STROKE;
export type Text = typeof TEXT;
