import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { palette, type } from './tokens';

type Variant = keyof typeof type;

interface Props extends RNTextProps {
  variant?: Variant;
  color?: string;
  center?: boolean;
  muted?: boolean;
  faint?: boolean;
}

export function Text({
  variant = 'body',
  color,
  center,
  muted,
  faint,
  style,
  ...rest
}: Props) {
  const resolved =
    color ?? (faint ? palette.textFaint : muted ? palette.textMuted : palette.text);
  const base: TextStyle = {
    ...type[variant],
    color: resolved,
    textAlign: center ? 'center' : undefined,
  };
  return <RNText style={[base, style]} {...rest} />;
}
