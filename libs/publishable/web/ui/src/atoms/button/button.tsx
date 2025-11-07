'use client';

import type { ButtonProps } from '@mui/material';

import { forwardRef } from 'react';

import { MuiButton as MButton } from './styles';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (props, reference) => <MButton {...props} ref={reference} />,
);

Button.displayName = 'Button';
