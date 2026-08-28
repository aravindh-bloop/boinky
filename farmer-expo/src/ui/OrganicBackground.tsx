import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { Canvas, Circle, Group, BlurMask, LinearGradient, vec, Rect } from '@shopify/react-native-skia';
import { useWindowDimensions } from 'react-native';

interface Props {
  tint?: 'green' | 'harvest' | 'calm';
  height?: number;
  style?: ViewStyle;
}

const TINTS = {
  green: { a: '#3B7A3F', b: '#5DA34E', base0: '#EAF3E2', base1: '#FBF8F1' },
  harvest: { a: '#DDA24C', b: '#C57B54', base0: '#F8EACF', base1: '#FBF8F1' },
  calm: { a: '#6FA3A9', b: '#8CA982', base0: '#E6EFEA', base1: '#FBF8F1' },
};

/** Soft blurred organic blobs behind a header. Purely decorative, cheap to render. */
export function OrganicBackground({ tint = 'green', height = 260, style }: Props) {
  const { width } = useWindowDimensions();
  const t = TINTS[tint];

  return (
    <Canvas style={[StyleSheet.absoluteFill, { height }, style]} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[t.base0, t.base1]} />
      </Rect>
      <Group opacity={0.5}>
        <BlurMask blur={40} style="normal" />
        <Circle cx={width * 0.15} cy={height * 0.25} r={height * 0.42} color={t.a} opacity={0.35} />
        <Circle cx={width * 0.9} cy={height * 0.1} r={height * 0.36} color={t.b} opacity={0.3} />
        <Circle cx={width * 0.7} cy={height * 0.55} r={height * 0.3} color={t.a} opacity={0.22} />
      </Group>
    </Canvas>
  );
}
