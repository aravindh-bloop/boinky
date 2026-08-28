import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { STAGGER_MS, STAGGER_MAX_MS } from './motion';

interface RevealProps {
  children: React.ReactNode;
  index?: number;
  delay?: number;
  from?: 'bottom' | 'top' | 'scale';
  style?: ViewStyle;
}

/** Fast, subtle entrance. Total stagger is capped so lists never feel laggy. */
export function Reveal({ children, index = 0, delay = 0, from = 'bottom', style }: RevealProps) {
  const total = Math.min(delay + index * STAGGER_MS, delay + STAGGER_MAX_MS);
  const entering =
    from === 'top'
      ? FadeInUp.duration(220).delay(total)
      : from === 'scale'
        ? FadeIn.duration(200).delay(total)
        : FadeInDown.duration(220).delay(total);

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

export function Stagger({
  children,
  gap = 12,
  startDelay = 0,
}: {
  children: React.ReactNode;
  gap?: number;
  startDelay?: number;
}) {
  const items = React.Children.toArray(children);
  return (
    <View style={{ gap }}>
      {items.map((child, i) => (
        <Reveal key={i} index={i} delay={startDelay}>
          {child}
        </Reveal>
      ))}
    </View>
  );
}
