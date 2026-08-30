import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { palette, radius, shadow, space } from './tokens';
import { PressableScale } from './Pressable';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  /** 'flat' = hairline only, 'raised' = soft shadow (default), 'sunken' = inset feel */
  elevation?: 'flat' | 'raised' | 'sunken';
  padded?: boolean;
  accent?: string;
}

export function Card({
  children,
  onPress,
  style,
  elevation = 'raised',
  padded = true,
  accent,
}: Props) {
  const base: ViewStyle = {
    backgroundColor: elevation === 'sunken' ? palette.surfaceSunken : palette.surface,
    borderRadius: radius.xl,
    // a crisp hairline edge under a soft shadow — the "premium card" look
    borderWidth: 1,
    borderColor: elevation === 'raised' ? palette.hairline : palette.border,
    padding: padded ? space.lg : 0,
    gap: space.sm,
    ...(elevation === 'raised' ? shadow.e1 : null),
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
