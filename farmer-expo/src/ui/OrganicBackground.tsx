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

/**
 * Soft blurred organic blobs behind a header. Purely decorative and fully static,
 * so it is memoised — a 40px Skia blur mask is not something to re-record every
 * time the screen above it re-renders with new data.
 */
function OrganicBackgroundBase({ tint = 'green', height = 260, style }: Props) {
  const { width } = useWindowDimensions();
  const t = TINTS[tint];

  return (
    <Canvas style={[StyleSheet.absoluteFill, { height }, style]} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[t.base0, t.base1]} />
      </Rect>
      <Group opacity={0.42}>
        <BlurMask blur={48} style="normal" />
        <Circle cx={width * 0.12} cy={height * 0.22} r={height * 0.44} color={t.a} opacity={0.3} />
        <Circle cx={width * 0.94} cy={height * 0.06} r={height * 0.38} color={t.b} opacity={0.26} />
        <Circle cx={width * 0.72} cy={height * 0.6} r={height * 0.26} color={t.a} opacity={0.16} />
      </Group>
    </Canvas>
  );
}

export const OrganicBackground = React.memo(OrganicBackgroundBase);
