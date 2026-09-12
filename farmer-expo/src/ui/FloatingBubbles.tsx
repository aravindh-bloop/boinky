import React from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { palette } from './tokens';

interface Bubble {
  size: number;
  top: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  color: string;
  opacity: number;
  duration: number;
  range: number;
}

// Vivid, more-saturated greens — deliberately punchier than the app's muted
// sage palette, so the bubbles read as clearly green rather than grey-green.
const VIVID = ['#2E8B3D', '#3FA34D', '#4CAF50', '#66BB6A', '#1B5E20', '#43A047'];

const BUBBLES: Bubble[] = [
  { size: 150, top: '-3%', left: -40, color: VIVID[0]!, opacity: 0.3, duration: 6200, range: 14 },
  { size: 90, top: '3%', right: -24, color: VIVID[2]!, opacity: 0.26, duration: 5000, range: 10 },
  { size: 56, top: '13%', left: 36, color: VIVID[3]!, opacity: 0.28, duration: 4400, range: 8 },
  { size: 190, top: '9%', right: -70, color: VIVID[4]!, opacity: 0.22, duration: 7200, range: 16 },
  { size: 46, top: '1%', left: '46%', color: VIVID[1]!, opacity: 0.28, duration: 3800, range: 9 },
  { size: 34, top: '17%', right: '30%', color: VIVID[5]!, opacity: 0.26, duration: 4200, range: 7 },
  { size: 66, top: '22%', left: 8, color: VIVID[2]!, opacity: 0.24, duration: 5600, range: 10 },
  { size: 120, top: '30%', left: -50, color: VIVID[0]!, opacity: 0.2, duration: 6800, range: 12 },
  { size: 70, top: '40%', right: -20, color: VIVID[1]!, opacity: 0.22, duration: 5400, range: 11 },
  { size: 44, top: '46%', left: '12%', color: VIVID[3]!, opacity: 0.24, duration: 4000, range: 8 },
  { size: 80, top: '52%', right: '38%', color: VIVID[4]!, opacity: 0.2, duration: 6200, range: 12 },
  { size: 100, top: '58%', right: '8%', color: VIVID[0]!, opacity: 0.2, duration: 6000, range: 13 },
  { size: 36, top: '64%', left: '55%', color: VIVID[5]!, opacity: 0.22, duration: 3600, range: 7 },
  { size: 58, top: '70%', left: 12, color: VIVID[2]!, opacity: 0.24, duration: 4600, range: 9 },
  { size: 150, top: '76%', left: -60, color: VIVID[3]!, opacity: 0.26, duration: 7400, range: 15 },
  { size: 42, top: '82%', right: '20%', color: VIVID[1]!, opacity: 0.24, duration: 4200, range: 8 },
  { size: 60, top: '88%', right: -20, color: VIVID[4]!, opacity: 0.22, duration: 4800, range: 9 },
  { size: 40, top: '95%', left: '30%', color: VIVID[0]!, opacity: 0.24, duration: 4200, range: 8 },
];

function FloatBubble({ b }: { b: Bubble }) {
  const t = useSharedValue(0);

  React.useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: b.duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [b.duration]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (t.value - 0.5) * 2 * b.range }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: b.size,
          height: b.size,
          borderRadius: b.size / 2,
          backgroundColor: b.color,
          opacity: b.opacity,
          top: b.top,
          left: b.left,
          right: b.right,
        },
        animStyle,
      ]}
    />
  );
}

/**
 * Soft, slow-bobbing green circles used as ambient decoration behind a whole
 * screen. Render as the FIRST child of a `flex: 1` container, before any
 * scrollable/opaque content, so it sits at the very back and only shows
 * through gaps in whatever is layered on top of it.
 */
export function FloatingBubbles() {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {BUBBLES.map((b, i) => (
        <FloatBubble key={i} b={b} />
      ))}
    </View>
  );
}
