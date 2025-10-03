'use client';

import type { ButtonProps } from '@mui/material';

import { forwardRef } from 'react';

import { MuiButton } from './styles';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (props, reference) => <MuiButton {...props} ref={reference} />,
);

Button.displayName = 'Button';
