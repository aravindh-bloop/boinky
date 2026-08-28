import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { Canvas, Path, Skia, SweepGradient, vec } from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { palette } from './tokens';
import { Text } from './Text';

/** Organic spinner — a rotating gradient arc. */
export function Loader({ size = 44, label }: { size?: number; label?: string }) {
  const stroke = size * 0.12;
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    p.addArc({ x: stroke / 2, y: stroke / 2, width: size - stroke, height: size - stroke }, 0, 290);
    return p;
  }, [size, stroke]);

  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1);
  }, [rot]);

  const transform = useDerivedValue(() => [{ rotate: rot.value * Math.PI * 2 }]);
  const origin = vec(size / 2, size / 2);

  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <Canvas style={{ width: size, height: size }}>
        <Path
          path={path}
          style="stroke"
          strokeWidth={stroke}
          strokeCap="round"
          transform={transform}
          origin={origin}
        >
          <SweepGradient
            c={origin}
            colors={[palette.leaf, palette.primary, palette.leaf]}
          />
        </Path>
      </Canvas>
      {label ? (
        <Text variant="label" faint>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export function LoaderScreen({ label }: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas }}>
      <Loader size={52} label={label} />
    </View>
  );
}
