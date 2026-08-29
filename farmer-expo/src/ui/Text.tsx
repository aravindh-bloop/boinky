import React from 'react';
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
  StyleSheet,
} from 'react-native';
import { palette, type, tamilFontFor } from './tokens';
import { useI18n } from '../i18n';

type Variant = keyof typeof type;

interface Props extends RNTextProps {
  variant?: Variant;
  color?: string;
  center?: boolean;
  muted?: boolean;
  faint?: boolean;
  /** Skip auto-translation of a plain-string child (rare — e.g. already-localized data). */
  raw?: boolean;
}

export function Text({
  variant = 'body',
  color,
  center,
  muted,
  faint,
  raw,
  style,
  children,
  ...rest
}: Props) {
  const { lang, t } = useI18n();
  const resolved =
    color ?? (faint ? palette.textFaint : muted ? palette.textMuted : palette.text);
  const base: TextStyle = {
    ...type[variant],
    color: resolved,
    textAlign: center ? 'center' : undefined,
  };

  // Auto-translate a plain-string child. `t()` falls back to the string itself,
  // so names, numbers and already-localized backend prose pass through untouched.
  const kids = !raw && typeof children === 'string' ? t(children) : children;

  // In Tamil, remap whichever Latin family applies (base or style override) to
  // its Tamil counterpart, and let that win over `style`.
  let tamilOverride: TextStyle | null = null;
  if (lang === 'ta') {
    const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
    const fam = flat.fontFamily ?? base.fontFamily;
    const tamil = fam ? tamilFontFor[fam] : undefined;
    if (tamil) tamilOverride = { fontFamily: tamil };
  }

  return (
    <RNText style={[base, style, tamilOverride]} {...rest}>
      {kids}
    </RNText>
  );
}
