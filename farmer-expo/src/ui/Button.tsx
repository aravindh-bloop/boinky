import React from 'react';
import { ActivityIndicator, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, palette, radius, shadow, space } from './tokens';
import { Text } from './Text';
import { PressableScale } from './Pressable';
import { haptic } from './haptics';

type Variant = 'primary' | 'soft' | 'ghost' | 'danger';
type Size = 'md' | 'lg' | 'sm';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  full?: boolean;
  style?: ViewStyle;
}

const heights: Record<Size, number> = { sm: 40, md: 48, lg: 56 };

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  icon,
  full = true,
  style,
}: Props) {
  const h = heights[size];
  const shape: ViewStyle = {
    height: h,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.xl,
    alignSelf: full ? 'stretch' : 'flex-start',
  };

  const fg =
    variant === 'primary' || variant === 'danger'
      ? palette.onPrimary
      : variant === 'soft'
        ? palette.primaryDeep
        : palette.primary;

  const inner = (
    <>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <Text variant="subhead" color={fg} style={{ fontFamily: 'NunitoSans_700Bold' }}>
            {title}
          </Text>
        </>
      )}
    </>
  );

  const handlePress = () => {
    if (variant === 'danger') haptic.warning();
    onPress();
  };

  if (variant === 'primary') {
    return (
      <PressableScale
        onPress={handlePress}
        disabled={disabled || loading}
        feedback="press"
        style={[{ borderRadius: radius.lg }, shadow.e2, style as ViewStyle]}
      >
        <LinearGradient
          colors={gradients.canopy}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={shape}
        >
          {inner}
        </LinearGradient>
      </PressableScale>
    );
  }

  const bg =
    variant === 'soft'
      ? palette.primarySoft
      : variant === 'danger'
        ? palette.danger
        : 'transparent';
  const border = variant === 'ghost' ? { borderWidth: 1.5, borderColor: palette.primary } : null;

  return (
    <PressableScale
      onPress={handlePress}
      disabled={disabled || loading}
      feedback="press"
      style={[shape, { backgroundColor: bg }, border, style as ViewStyle]}
    >
      {inner}
    </PressableScale>
  );
}

export function IconPill({
  children,
  onPress,
  bg = palette.surface,
}: {
  children: React.ReactNode;
  onPress: () => void;
  bg?: string;
}) {
  return (
    <PressableScale onPress={onPress} compact style={[pillStyle, { backgroundColor: bg }, shadow.e1]}>
      <View>{children}</View>
    </PressableScale>
  );
}

const pillStyle: ViewStyle = {
  width: 44,
  height: 44,
  borderRadius: radius.pill,
  alignItems: 'center',
  justifyContent: 'center',
};
