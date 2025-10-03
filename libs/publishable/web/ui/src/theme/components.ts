import type { ThemeOptions } from '@mui/material';

import { COLORS, PRIMITIVE_COLORS } from './palette';

export const COMPONENTS: Required<ThemeOptions>['components'] = {
  MuiAlert: {
    styleOverrides: {
      filledError: {
        backgroundColor: PRIMITIVE_COLORS.RED[500],
      },
      filledSuccess: {
        backgroundColor: PRIMITIVE_COLORS.GREEN[500],
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        '&.Mui-disabled': {
          backgroundColor: COLORS.BACKGROUND.disabled.primary,
          border: `1px solid ${COLORS.STROKE.disabled.primary}`,
          color: COLORS.TEXT.disabledSecondary,
        },
        '&:hover': {
          boxShadow: 1,
        },
        '.MuiButton-icon': {
          fontSize: 16,
        },
        borderRadius: 8,
        lineHeight: '80%',
        padding: 12,
        variants: [
          {
            props: { color: 'white', variant: 'contained' },
            style: {
              '&:hover': {
                backgroundColor: COLORS.BACKGROUND.neutral['primary-hover'],
              },
              backgroundColor: COLORS.BACKGROUND.neutral.primary,
              color: COLORS.TEXT.neutral.primary,
            },
          },
          {
            props: { color: 'neutral', variant: 'contained' },
            style: {
              '&:active': {
                borderColor: COLORS.STROKE.neutral.primary,
              },
              '&:hover': {
                backgroundColor: COLORS.BACKGROUND.neutral['secondary-hover'],
              },
              backgroundColor: COLORS.BACKGROUND.neutral.secondary,
              color: COLORS.TEXT.neutral.secondary,
            },
          },
          {
            props: { color: 'brand', variant: 'contained' },
            style: {
              '&:active': {
                borderColor: COLORS.STROKE.brand.primary,
              },
              '&:hover': {
                backgroundColor: COLORS.BACKGROUND.brand['primary-hover'],
              },
              backgroundColor: COLORS.BACKGROUND.brand.primary,
              color: COLORS.TEXT.neutral.secondary,
            },
          },
          {
            props: { color: 'brand.dark', variant: 'contained' },
            style: {
              '&:hover': {
                backgroundColor: COLORS.BACKGROUND.brand['primary-hover'],
              },
              backgroundColor: COLORS.BACKGROUND.brand['primary-dark'],
              color: COLORS.TEXT.neutral.secondary,
            },
          },
          {
            props: { color: 'brand.secondary', variant: 'contained' },
            style: {
              '&:active': {
                borderColor: COLORS.STROKE.brand.secondary,
              },
              '&:hover': {
                backgroundColor: COLORS.BACKGROUND.brand['secondary-hover'],
              },
              backgroundColor: COLORS.BACKGROUND.brand.secondary,
              color: COLORS.TEXT.neutral.secondary,
            },
          },
          {
            props: { color: 'neutral', variant: 'outlined' },
            style: {
              '&:active': {
                backgroundColor: COLORS.BACKGROUND.neutral['primary-active'],
                borderColor: COLORS.STROKE.neutral.primary,
              },
              '&:hover': {
                backgroundColor: COLORS.BACKGROUND.neutral['primary-hover'],
              },
              borderColor: COLORS.STROKE.neutral.primary,
              borderStyle: 'solid',
              borderWidth: '1px',
              color: COLORS.TEXT.neutral.primary,
            },
          },
          {
            props: { color: 'brand', variant: 'outlined' },
            style: {
              '&:active': {
                backgroundColor: COLORS.BACKGROUND.subtle['primary-active'],
                borderColor: COLORS.STROKE.brand.primary,
              },
              '&:hover': {
                backgroundColor: COLORS.BACKGROUND.subtle['primary-hover'],
              },
              borderColor: COLORS.STROKE.brand.primary,
              borderStyle: 'solid',
              borderWidth: '1px',
              color: COLORS.TEXT.brand.primary,
            },
          },
          {
            props: { color: 'brand.secondary', variant: 'outlined' },
            style: {
              '&:active': {
                backgroundColor: COLORS.BACKGROUND.subtle['primary-active'],
                borderColor: COLORS.STROKE.brand.secondary,
              },
              '&:hover': {
                backgroundColor: COLORS.BACKGROUND.subtle['primary-hover'],
              },
              borderColor: COLORS.STROKE.brand.secondary,
              borderStyle: 'solid',
              borderWidth: '1px',
              color: COLORS.TEXT.brand.secondary,
            },
          },
          {
            props: { color: 'neutral', variant: 'text' },
            style: {
              '&:active': {
                backgroundColor: COLORS.BACKGROUND.neutral['primary-active'],
              },
              '&:hover': {
                backgroundColor: COLORS.BACKGROUND.neutral['primary-hover'],
              },
              color: COLORS.TEXT.neutral.primary,
            },
          },
          {
            props: { color: 'brand', variant: 'text' },
            style: {
              '&:active': {
                backgroundColor: COLORS.BACKGROUND.brand['primary-active'],
              },
              '&:hover': {
                backgroundColor: COLORS.BACKGROUND.brand['primary-hover'],
              },
              color: COLORS.TEXT.brand.primary,
            },
          },
          {
            props: { color: 'brand.secondary', variant: 'text' },
            style: {
              '&:active': {
                backgroundColor: COLORS.BACKGROUND.subtle['secondary-active'],
              },
              '&:hover': {
                backgroundColor: COLORS.BACKGROUND.subtle['secondary-hover'],
              },
              color: COLORS.TEXT.brand.secondary,
            },
          },
          {
            props: { color: 'neutral.secondary', variant: 'text' },
            style: {
              '&:active': {
                borderColor: COLORS.STROKE.neutral.tertiary,
              },
              '&:hover': {
                backgroundColor: COLORS.BACKGROUND.neutral['tertiary-hover'],
              },
              backgroundColor: COLORS.BACKGROUND.neutral.tertiary,
              color: COLORS.TEXT.neutral.tertiary,
            },
          },
          {
            props: { size: 'small' },
            style: {
              padding: 8,
            },
          },
        ],
      },
    },
  },
  MuiLink: {
    defaultProps: {
      underline: 'hover',
    },
  },
  MuiSvgIcon: {
    defaultProps: {
      fontSize: 'medium',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    styleOverrides: {
      fontSizeLarge: {
        fontSize: '24px',
      },
      fontSizeMedium: {
        fontSize: '20px',
      },
      fontSizeSmall: {
        fontSize: '16px',
      },
    },
  },
  MuiTypography: {
    defaultProps: {
      variantMapping: {
        body1Italic: 'p',
        body1Link: 'p',
        body1Medium: 'p',
        body1SingleLine: 'p',
        body1SingleLineStrong: 'p',
        body1Strong: 'p',
        body2Medium: 'p',
        body2SingleLine: 'p',
        body2SingleLineStrong: 'p',
        body2Strong: 'p',
        h3Slab: 'h3',
        h5Slab: 'h5',
        h5Strong: 'h5',
      },
    },
  },
};
