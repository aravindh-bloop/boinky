import React, { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { palette, radius, space } from './tokens';
import { spring } from './motion';
import { Text } from './Text';
import { PressableScale } from './Pressable';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  // container has 4px padding each side; the pill lives inside that inset
  const seg = w > 8 ? (w - 8) / options.length : 0;
  const x = useSharedValue(0);

  React.useEffect(() => {
    if (seg > 0) x.value = withSpring(idx * seg, spring.gentle);
  }, [idx, seg, x]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], width: seg }));

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={{
        flexDirection: 'row',
        backgroundColor: palette.surfaceSunken,
        borderRadius: radius.pill,
        padding: 4,
      }}
    >
      {seg > 0 && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: 4,
              backgroundColor: palette.surface,
              borderRadius: radius.pill,
              shadowColor: '#3D2E1E',
              shadowOpacity: 0.08,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            },
            pill,
          ]}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            onPress={() => onChange(o.value)}
            feedback="select"
            style={{ flex: 1, paddingVertical: space.sm, alignItems: 'center' }}
          >
            <Text variant="bodyStrong" color={active ? palette.primaryDeep : palette.textMuted}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
