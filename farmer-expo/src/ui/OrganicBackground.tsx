import React from 'react';
import { StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
import { Canvas, Circle, Group, BlurMask, LinearGradient, vec, Rect } from '@shopify/react-native-skia';
import { palette } from './tokens';

interface Props {
  tint?: 'green' | 'harvest' | 'calm' | 'sunrise';
  height?: number;
  style?: ViewStyle;
}

/** Each tint fades from a soft wash at the top into the page canvas. */
const TINTS = {
  sunrise: { wash: palette.claySoft, glow: palette.sky2 },
  harvest: { wash: palette.honeySoft, glow: palette.honey },
  green: { wash: palette.primarySoft, glow: palette.leaf },
  calm: { wash: '#E7EEEF', glow: palette.info },
};

/**
 * A soft coloured wash behind a screen header — a top-down gradient into the
 * canvas with one diffuse glow. Static and memoised: a Skia blur is not
 * something to re-record when the screen above re-renders with new data.
 */
function OrganicBackgroundBase({ tint = 'sunrise', height = 240, style }: Props) {
  const { width } = useWindowDimensions();
  const t = TINTS[tint] ?? TINTS.sunrise;

  return (
    <Canvas style={[StyleSheet.absoluteFill, { height }, style]} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={[t.wash, palette.canvas]}
          positions={[0, 0.9]}
        />
      </Rect>
      <Group opacity={0.5}>
        <BlurMask blur={64} style="normal" />
        <Circle cx={width * 0.82} cy={height * 0.1} r={height * 0.42} color={t.glow} opacity={0.22} />
      </Group>
    </Canvas>
  );
}

export const OrganicBackground = React.memo(OrganicBackgroundBase);
