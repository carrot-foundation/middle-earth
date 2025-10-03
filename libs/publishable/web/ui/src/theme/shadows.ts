import type { Shadows } from '@mui/material';

// MUI requires exactly 25 shadow values (0-24)
const TOTAL_MUI_SHADOWS = 25;
const CUSTOM_SHADOWS_COUNT = 3;

const dropShadow1 = '0px 1px 4px rgba(30, 30, 30, 0.15)';
const dropShadow2 = '0px 2px 8px rgba(30, 30, 30, 0.25)';

export const SHADOWS: Shadows = [
  'none',
  dropShadow1,
  dropShadow2,
  ...Array.from({ length: TOTAL_MUI_SHADOWS - CUSTOM_SHADOWS_COUNT }).fill(
    'none',
  ),
] as Shadows;
