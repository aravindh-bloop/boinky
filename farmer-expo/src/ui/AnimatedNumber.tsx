import React, { useEffect, useState } from 'react';
import { type TextStyle } from 'react-native';
import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Text } from './Text';
import { timing } from './motion';

interface Props {
  value: number;
  /** decimals to show */
  precision?: number;
  suffix?: string;
  prefix?: string;
  variant?: React.ComponentProps<typeof Text>['variant'];
  color?: string;
  style?: TextStyle;
  duration?: number;
}

/** Counts up/down to `value` with an ease-out. */
export function AnimatedNumber({
  value,
  precision = 0,
  suffix = '',
  prefix = '',
  variant = 'title',
  color,
  style,
  duration = 700,
}: Props) {
  const sv = useSharedValue(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    sv.value = withTiming(value, { duration, easing: timing.slow.easing });
  }, [value, duration, sv]);

  useAnimatedReaction(
    () => sv.value,
    (v) => {
      runOnJS(setDisplay)(v);
    },
  );

  const shown = precision > 0 ? display.toFixed(precision) : Math.round(display).toString();

  return (
    <Text variant={variant} color={color} style={style}>
      {prefix}
      {shown}
      {suffix}
    </Text>
  );
}
