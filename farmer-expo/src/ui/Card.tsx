import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { palette, radius, shadow, space } from './tokens';
import { PressableScale } from './Pressable';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  /** 'flat' = hairline only · 'raised' = hairline + a whisper of shadow · 'sunken' = inset */
  elevation?: 'flat' | 'raised' | 'sunken';
  padded?: boolean;
  accent?: string;
}

export function Card({
  children,
  onPress,
  style,
  elevation = 'flat',
  padded = true,
  accent,
}: Props) {
  const base: ViewStyle = {
    backgroundColor: elevation === 'sunken' ? palette.surfaceSunken : palette.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: elevation === 'sunken' ? palette.border : palette.hairline,
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
