import React, { useEffect } from 'react';
import { Dimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { palette } from './tokens';
import { Text } from './Text';

const { width: W, height: H } = Dimensions.get('window');

/**
 * The launch screen: a hand-drawn sunrise. A warm gradient sky, a rising sun
 * that glows and breathes, a soft field horizon, and the wordmark fading up.
 *
 * Built from expo-linear-gradient + Reanimated only — no Skia surface on the
 * startup path (that was the whole reason this component exists).
 */
export function BootLoader() {
  const rise = useSharedValue(0); // 0 → 1, sun rises + everything settles
  const glow = useSharedValue(0); // gentle endless breathe

  useEffect(() => {
    rise.value = withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) });
    glow.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [rise, glow]);

  const sun = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - rise.value) * 90 },
      { scale: 0.9 + rise.value * 0.1 + glow.value * 0.03 },
    ],
    opacity: 0.35 + rise.value * 0.65,
  }));
  const sunGlow = useAnimatedStyle(() => ({
    opacity: (0.25 + glow.value * 0.35) * rise.value,
    transform: [{ scale: 1 + glow.value * 0.08 }],
  }));
  const word = useAnimatedStyle(() => ({
    opacity: rise.value < 0.55 ? 0 : (rise.value - 0.55) / 0.45,
    transform: [{ translateY: (1 - rise.value) * 16 }],
  }));

  const horizonY = H * 0.6;

  return (
    <View style={{ flex: 1, backgroundColor: palette.sky1 }}>
      {/* sky */}
      <LinearGradient
        colors={[palette.sky1, palette.sky2, palette.sky3]}
        locations={[0, 0.55, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: horizonY }}
      />
      {/* ground */}
      <LinearGradient
        colors={['#EBB079', palette.canvas]}
        style={{ position: 'absolute', top: horizonY, left: 0, right: 0, bottom: 0 }}
      />

      {/* sun glow — a big soft radial faked with a scaled gradient disc */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: W * 1.4,
            height: W * 1.4,
            left: W / 2 - W * 0.7,
            top: horizonY - W * 0.7,
            borderRadius: W * 0.7,
          },
          sunGlow,
        ]}
      >
        <LinearGradient
          colors={[palette.sunGlow + 'FF', palette.sunGlow + '00']}
          style={{ flex: 1, borderRadius: W * 0.7 }}
        />
      </Animated.View>

      {/* the sun */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 96,
            height: 96,
            left: W / 2 - 48,
            top: horizonY - 68,
            borderRadius: 48,
            backgroundColor: '#FFE7BE',
          },
          sun,
        ]}
      >
        <LinearGradient
          colors={['#FFF0D6', '#FFD79E']}
          style={{ flex: 1, borderRadius: 48 }}
        />
      </Animated.View>

      {/* horizon line */}
      <View
        style={{
          position: 'absolute',
          top: horizonY,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: palette.horizonLine + '55',
        }}
      />

      {/* field silhouette — two overlapping soft rises */}
      <View style={{ position: 'absolute', top: horizonY - 26, left: -40, right: -40, height: 60, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            bottom: -70,
            left: -30,
            width: W * 0.85,
            height: 110,
            borderRadius: 90,
            backgroundColor: palette.fieldSilhouette + 'E6',
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: -78,
            right: -40,
            width: W * 0.8,
            height: 110,
            borderRadius: 90,
            backgroundColor: palette.fieldSilhouette,
          }}
        />
      </View>

      {/* wordmark */}
      <Animated.View
        style={[
          { position: 'absolute', left: 0, right: 0, top: horizonY + 54, alignItems: 'center' },
          word,
        ]}
      >
        <Text variant="hero" raw color={palette.primaryDeep} style={{ letterSpacing: 0.5 }}>
          AgriPod
        </Text>
        <Text variant="label" color={palette.textMuted} style={{ marginTop: 4, letterSpacing: 1 }}>
          growing, together
        </Text>
      </Animated.View>
    </View>
  );
}
