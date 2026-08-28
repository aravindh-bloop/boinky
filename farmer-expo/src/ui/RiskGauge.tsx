import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
  LinearGradient,
  vec,
  BlurMask,
  Group,
} from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { palette, riskLevel, type } from './tokens';
import { Text } from './Text';

type Level = 'low' | 'medium' | 'high';

interface Props {
  score: number; // 0..100
  level: Level;
  size?: number;
  label?: string;
}

const START = 135;
const SWEEP = 270;

const COLORS: Record<Level, [string, string]> = {
  low: ['#7CC96A', '#4B9A3E'],
  medium: ['#E7B35C', '#C4892E'],
  high: ['#D9744F', '#B24A2C'],
};

/** Skia arc gauge — sweeps from 0 to `score` on mount, glows softly. */
export function RiskGauge({ score, level, size = 200, label }: Props) {
  const stroke = size * 0.11;
  const track = useMemo(() => {
    const rect = {
      x: stroke / 2 + 2,
      y: stroke / 2 + 2,
      width: size - stroke - 4,
      height: size - stroke - 4,
    };
    const p = Skia.Path.Make();
    p.addArc(rect, START, SWEEP);
    return p;
  }, [size, stroke]);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      120,
      withTiming(Math.max(0, Math.min(1, score / 100)), { duration: 1100 }),
    );
  }, [score, progress]);

  const end = useDerivedValue(() => progress.value);
  const [c0, c1] = COLORS[level];

  return (
    <View style={{ width: size, height: size * 0.78, alignItems: 'center', justifyContent: 'center' }}>
      <Canvas style={{ width: size, height: size }}>
        <Path
          path={track}
          style="stroke"
          strokeWidth={stroke}
          strokeCap="round"
          color={palette.surfaceSunken}
        />
        <Group>
          <Path
            path={track}
            style="stroke"
            strokeWidth={stroke}
            strokeCap="round"
            start={0}
            end={end}
          >
            <LinearGradient start={vec(0, size)} end={vec(size, 0)} colors={[c0, c1]} />
            <BlurMask blur={6} style="solid" />
          </Path>
        </Group>
      </Canvas>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ ...type.hero, fontSize: size * 0.26, color: riskLevel[level].fg }}>
          {Math.round(score)}
        </Text>
        <Text variant="label" faint>
          {label ?? `${riskLevel[level].label} risk`}
        </Text>
      </View>
    </View>
  );
}
