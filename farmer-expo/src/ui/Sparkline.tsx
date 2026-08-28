import React, { useEffect, useMemo } from 'react';
import { Canvas, Path, Skia, LinearGradient, vec } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withTiming } from 'react-native-reanimated';
import { palette } from './tokens';

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}

/** Smooth animated area/line sparkline. */
export function Sparkline({
  data,
  width = 280,
  height = 64,
  color = palette.primary,
  fill = true,
}: Props) {
  const pad = 4;
  const { linePath, areaPath } = useMemo(() => {
    const pts = data.length ? data : [0, 0];
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range = max - min || 1;
    const stepX = (width - pad * 2) / Math.max(1, pts.length - 1);
    const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / range);

    const line = Skia.Path.Make();
    pts.forEach((v, i) => {
      const px = pad + i * stepX;
      const py = y(v);
      if (i === 0) line.moveTo(px, py);
      else {
        const prevX = pad + (i - 1) * stepX;
        const cx = (prevX + px) / 2;
        line.cubicTo(cx, y(pts[i - 1]), cx, py, px, py);
      }
    });

    const area = line.copy();
    area.lineTo(pad + (pts.length - 1) * stepX, height);
    area.lineTo(pad, height);
    area.close();

    return { linePath: line, areaPath: area };
  }, [data, width, height]);

  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 900 });
  }, [linePath, p]);
  const end = useDerivedValue(() => p.value);

  return (
    <Canvas style={{ width, height }}>
      {fill ? (
        <Path path={areaPath} style="fill" opacity={0.16}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
            colors={[color, color + '00']}
          />
        </Path>
      ) : null}
      <Path
        path={linePath}
        style="stroke"
        strokeWidth={2.5}
        strokeCap="round"
        strokeJoin="round"
        color={color}
        start={0}
        end={end}
      />
    </Canvas>
  );
}
