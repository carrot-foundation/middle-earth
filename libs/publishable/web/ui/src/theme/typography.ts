import type {
  TypographyStyleOptions,
  TypographyVariantsOptions,
} from '@mui/material/styles/createTypography';

import { Roboto, Roboto_Slab } from 'next/font/google';

export const roboto = Roboto({
  display: 'swap',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});
export const robotoSlab = Roboto_Slab({
  display: 'swap',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const roundLineHeight = (fontSizeRem: number, lineHeightPercentage: number) => {
  const fontSizePx = fontSizeRem * 16;
  const lineHeight = (fontSizePx * lineHeightPercentage) / 100;

  return `${Math.round(lineHeight)}px`;
};

const BODY_1: TypographyStyleOptions = {
  fontFamily: roboto.style.fontFamily,
  fontSize: '1rem',
  fontWeight: 400,
  letterSpacing: 0,
  lineHeight: roundLineHeight(1, 140),
};

const BODY_2: TypographyStyleOptions = {
  fontFamily: roboto.style.fontFamily,
  fontSize: '0.875rem',
  fontWeight: 400,
  letterSpacing: 0,
  lineHeight: roundLineHeight(0.875, 140),
};

const H_3: TypographyStyleOptions = {
  fontFamily: roboto.style.fontFamily,
  fontSize: '2rem',
  fontWeight: 400,
  letterSpacing: 0,
  lineHeight: roundLineHeight(2, 120),
};

const H_4: TypographyStyleOptions = {
  fontFamily: roboto.style.fontFamily,
  fontSize: '1.5rem',
  fontWeight: 500,
  letterSpacing: 0,
  lineHeight: '100%',
};

const H_5: TypographyStyleOptions = {
  fontFamily: roboto.style.fontFamily,
  fontSize: '1.25rem',
  fontWeight: 400,
  letterSpacing: 0,
  lineHeight: '120%',
};

export const TYPOGRAPHY: TypographyVariantsOptions = {
  body1: BODY_1,
  body1Italic: {
    ...BODY_1,
    fontStyle: 'italic',
  },
  body1Link: {
    ...BODY_1,
    textDecorationLine: 'underline',
  },
  body1Medium: { ...BODY_1, fontWeight: 500 },
  body1SingleLine: {
    ...BODY_1,
    lineHeight: roundLineHeight(1, 80),
  },
  body1SingleLineStrong: {
    ...BODY_1,
    fontWeight: 600,
    letterSpacing: '-0.01em',
    lineHeight: roundLineHeight(1, 80),
  },
  body1Strong: {
    ...BODY_1,
    fontWeight: 600,
  },
  body2: BODY_2,
  body2Medium: { ...BODY_2, fontWeight: 500 },
  body2SingleLine: {
    ...BODY_2,
    lineHeight: '100%',
  },
  body2SingleLineStrong: {
    ...BODY_2,
    fontWeight: 600,
    lineHeight: '100%',
  },
  body2Strong: { ...BODY_2, fontWeight: 600 },
  button: {
    fontSize: '1rem',
    fontWeight: 600,
    letterSpacing: 0,
    lineHeight: '1.5rem',
  },
  caption: {
    fontSize: '0.75rem',
    fontWeight: 500,
    letterSpacing: 0,
    lineHeight: '1.25rem',
  },
  fontFamily: roboto.style.fontFamily,
  h1: {
    fontFamily: robotoSlab.style.fontFamily,
    fontSize: '4.5rem',
    fontWeight: 500,
    letterSpacing: '-0.01em',
    lineHeight: roundLineHeight(4.5, 120),
  },
  h2: {
    fontFamily: robotoSlab.style.fontFamily,
    fontSize: '3rem',
    fontWeight: 500,
    letterSpacing: 0,
    lineHeight: roundLineHeight(3, 120),
  },
  h3: H_3,
  h3Slab: {
    ...H_3,
    fontFamily: robotoSlab.style.fontFamily,
    fontWeight: 500,
  },
  h4: H_4,
  h4Slab: {
    ...H_4,
    fontFamily: robotoSlab.style.fontFamily,
    fontWeight: 500,
  },
  h5: H_5,
  h5Slab: {
    ...H_5,
    fontFamily: robotoSlab.style.fontFamily,
    fontWeight: 500,
  },
  h5Strong: {
    ...H_5,
    fontWeight: 500,
  },
};
