import {
  createTheme,
  type ThemeOptions as MuiTheme,
} from '@mui/material/styles';
import '@mui/lab/TimelineDot';

import type { Background, PrimitiveColor, Stroke, Text } from './palette';

import { BORDER } from './border';
import { COMPONENTS } from './components';
import { COLORS, PRIMITIVE_COLORS } from './palette';
import { RADIUS } from './radius';
import { SHADOWS } from './shadows';
import { TYPOGRAPHY } from './typography';

const {
  AIRFORCE_BLUE,
  AMERICAN_ORANGE,
  CULTURED,
  GREEN,
  RED,
  STONE_COLD,
  TIFFANY_BLUE,
  YELLOW,
} = PRIMITIVE_COLORS;

const { BACKGROUND, STROKE, TEXT } = COLORS;

declare module '@mui/material/styles' {
  interface Palette {
    airforceBlue: PaletteOptions['primary'];
    brand: PaletteOptions['primary'];
    cultured: PaletteOptions['primary'] & typeof CULTURED;
    green: PrimitiveColor;
    red: Palette['primary'];
    stroke: Stroke;
    tertiary: PrimitiveColor;
    yellow: PaletteOptions['primary'];
  }

  interface PaletteOptions {
    airforceBlue: PaletteOptions['primary'];
    brand: PaletteOptions['primary'];
    cultured: PaletteOptions['primary'] & typeof CULTURED;
    green: PrimitiveColor;
    red: PaletteOptions['primary'];
    stroke: Stroke;
    tertiary: PrimitiveColor;
    yellow: PaletteOptions['primary'];
  }

  interface Theme {
    border: typeof BORDER;
    radius: typeof RADIUS;
  }

  interface ThemeOptions {
    border: typeof BORDER;
    radius: typeof RADIUS;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface PaletteColor extends PrimitiveColor {}

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface TypeBackground extends Background {}

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface TypeText extends Text {}
}

declare module '@mui/material/styles' {
  interface TypographyVariants {
    body1Italic: TypographyVariantsOptions['body1'];
    body1Link: TypographyVariantsOptions['body1'];
    body1Medium: TypographyVariantsOptions['body1'];
    body1SingleLine: TypographyVariantsOptions['body1'];
    body1SingleLineStrong: TypographyVariantsOptions['body1'];
    body1Strong: TypographyVariantsOptions['body1'];
    body2Medium: TypographyVariantsOptions['body1'];
    body2SingleLine: TypographyVariantsOptions['body1'];
    body2SingleLineStrong: TypographyVariantsOptions['body1'];
    body2Strong: TypographyVariantsOptions['body1'];
    h3Slab: TypographyVariantsOptions['h1'];
    h4Slab: TypographyVariantsOptions['h1'];
    h5Slab: TypographyVariantsOptions['h1'];
    h5Strong: TypographyVariantsOptions['h1'];
  }

  interface TypographyVariantsOptions {
    body1Italic: TypographyVariantsOptions['body1'];
    body1Link: TypographyVariantsOptions['body1'];
    body1Medium: TypographyVariantsOptions['body1'];
    body1SingleLine: TypographyVariantsOptions['body1'];
    body1SingleLineStrong: TypographyVariantsOptions['body1'];
    body1Strong: TypographyVariantsOptions['body1'];
    body2Medium: TypographyVariantsOptions['body1'];
    body2SingleLine: TypographyVariantsOptions['body1'];
    body2SingleLineStrong: TypographyVariantsOptions['body1'];
    body2Strong: TypographyVariantsOptions['body1'];
    h3Slab: TypographyVariantsOptions['h1'];
    h4Slab: TypographyVariantsOptions['h1'];
    h5Slab: TypographyVariantsOptions['h1'];
    h5Strong: TypographyVariantsOptions['h1'];
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    brand: true;
    'brand.dark': true;
    'brand.secondary': true;
    neutral: true;
    'neutral.secondary': true;
    white: true;
  }
}

declare module '@mui/material/TextField' {
  interface TextFieldPropsColorOverrides {
    white: true;
  }
}

declare module '@mui/material/SvgIcon' {
  interface SvgIconPropsColorOverrides {
    white: true;
  }
}

declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
    gradient: true;
    red: true;
  }
}

declare module '@mui/lab/TimelineDot' {
  interface TimelineDotPropsColorOverrides {
    red: true;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    body1Italic: true;
    body1Link: true;
    body1Medium: true;
    body1SingleLine: true;
    body1SingleLineStrong: true;
    body1Strong: true;
    body2Medium: true;
    body2SingleLine: true;
    body2SingleLineStrong: true;
    body2Strong: true;
    h3Slab: true;
    h4Slab: true;
    h5Slab: true;
    h5Strong: true;
  }
}

export const MUI_THEME: MuiTheme = {
  border: BORDER,
  breakpoints: {
    values: {
      lg: 1280,
      md: 960,
      sm: 600,
      xl: 1920,
      xs: 0,
    },
  },
  components: COMPONENTS,
  palette: {
    airforceBlue: AIRFORCE_BLUE,
    background: { default: CULTURED[100], ...BACKGROUND },
    brand: {
      ...TIFFANY_BLUE,
      main: TIFFANY_BLUE['600'],
    },
    cultured: CULTURED,
    divider: '#E9ECEF',
    green: GREEN,
    mode: 'light',
    primary: {
      ...STONE_COLD,
      main: STONE_COLD['400'],
    },
    red: {
      ...RED,
      main: RED['400'],
    },
    secondary: {
      ...TIFFANY_BLUE,
      main: TIFFANY_BLUE['400'],
    },
    stroke: STROKE,
    tertiary: AMERICAN_ORANGE,
    text: {
      ...TEXT,
      primary: TEXT.neutral.primary,
      secondary: TEXT.neutral.tertiary,
    },
    yellow: YELLOW,
  },
  radius: RADIUS,
  shadows: SHADOWS,
  shape: {
    borderRadius: 4,
  },
  typography: TYPOGRAPHY,
};

export const theme = createTheme(MUI_THEME);
