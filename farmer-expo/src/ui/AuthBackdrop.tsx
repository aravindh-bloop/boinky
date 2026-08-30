import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  RadialGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';

/**
 * The scene behind the auth screen: a deep-green field gradient, a soft glow
 * where the India map sits, and faint topographic contour rings above and
 * below it — echoing an agricultural survey map. Fully static, so memoised.
 */
function AuthBackdropBase({ glowCenterY }: { glowCenterY: number }) {
  const { width, height } = useWindowDimensions();
  const cx = width / 2;

  // concentric contour rings, clipped by the screen so only arcs show
  const ring = (baseY: number, from: number) =>
    [0, 1, 2, 3, 4].map((i) => (
      <Circle
        key={`${baseY}-${i}`}
        cx={cx}
        cy={baseY}
        r={from + i * 46}
        style="stroke"
        strokeWidth={1}
        color="#5DA34E"
        opacity={0.1 - i * 0.012}
      />
    ));

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={['#0C1D13', '#163021', '#0B1A11']}
          positions={[0, 0.5, 1]}
        />
      </Rect>

      {/* glow behind the map */}
      <Circle cx={cx} cy={glowCenterY} r={width * 0.62}>
        <RadialGradient
          c={vec(cx, glowCenterY)}
          r={width * 0.62}
          colors={['rgba(93,163,78,0.38)', 'rgba(59,122,63,0.10)', 'rgba(12,29,19,0)']}
          positions={[0, 0.55, 1]}
        />
      </Circle>

      {/* contour rings */}
      <Group>
        <BlurMask blur={0.6} style="normal" />
        {ring(-70, 120)}
        {ring(height + 60, 130)}
      </Group>
    </Canvas>
  );
}

export const AuthBackdrop = React.memo(AuthBackdropBase);
