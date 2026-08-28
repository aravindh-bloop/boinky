import React, { useCallback } from 'react';
import {
  type GestureResponderEvent,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { spring, PRESS_SCALE, PRESS_SCALE_SMALL } from './motion';
import { haptic } from './haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  children: React.ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** haptic on press-in. default 'tap'. false to disable */
  feedback?: 'tap' | 'press' | 'select' | false;
  /** smaller scale for chips / icons */
  compact?: boolean;
  hitSlop?: number;
}

/** Tappable surface that squishes + gives haptic feedback. The base of every button/card. */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  feedback = 'tap',
  compact,
  hitSlop,
}: Props) {
  const scale = useSharedValue(1);
  const target = compact ? PRESS_SCALE_SMALL : PRESS_SCALE;

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPressIn = useCallback(() => {
    scale.value = withSpring(target, spring.snappy);
    if (feedback) haptic[feedback]();
  }, [feedback, target, scale]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, spring.gentle);
  }, [scale]);

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      style={[style, animatedStyle, disabled && { opacity: 0.45 }]}
    >
      {children}
    </AnimatedPressable>
  );
}
