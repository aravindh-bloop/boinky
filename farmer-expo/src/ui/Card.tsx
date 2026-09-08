import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { palette, radius, shadow, space } from './tokens';
import { PressableScale } from './Pressable';

type Tint = 'sky' | 'green' | 'coral' | 'gold' | 'iris';

const TINT: Record<Tint, { bg: string; border: string }> = {
  sky: { bg: palette.skySoft, border: '#C4DBEC' },
  green: { bg: palette.primarySoft, border: '#CFDEB8' },
  coral: { bg: palette.coralSoft, border: '#EFCBB6' },
  gold: { bg: palette.goldSoft, border: '#E8D2A2' },
  iris: { bg: palette.irisSoft, border: '#D2CBEB' },
};

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  /** 'flat' = hairline only · 'raised' = hairline + a whisper of shadow · 'sunken' = inset */
  elevation?: 'flat' | 'raised' | 'sunken';
  /** A soft category-coloured background instead of white. */
  tint?: Tint;
  padded?: boolean;
  accent?: string;
}

export function Card({
  children,
  onPress,
  style,
  elevation = 'flat',
  tint,
  padded = true,
  accent,
}: Props) {
  const tc = tint ? TINT[tint] : null;
  const base: ViewStyle = {
    backgroundColor: tc ? tc.bg : elevation === 'sunken' ? palette.surfaceSunken : palette.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: tc ? tc.border : elevation === 'sunken' ? palette.border : palette.hairline,
    padding: padded ? space.lg : 0,
    gap: space.sm,
    ...(elevation === 'raised' ? shadow.e0 : null),
    ...(accent ? { borderLeftWidth: 3, borderLeftColor: accent } : null),
  };

  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={[base, style as ViewStyle]}>
        {children}
      </PressableScale>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}
