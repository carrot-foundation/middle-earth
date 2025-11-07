'use client';

import type { ButtonProps } from '@mui/material';

import { forwardRef } from 'react';

import { MuiButton } from './styles';
console.log('force-publish');
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (props, reference) => <MuiButton {...props} ref={reference} />,
);

Button.displayName = 'Button';
