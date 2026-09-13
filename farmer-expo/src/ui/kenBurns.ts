/**
 * Shared motion for the two screens that share the living field-photo backdrop:
 * the boot loader and the login/signup screen. Kept in one place so the loader
 * and the screen it hands off to move the same way — one continuous scene,
 * not a cut from a generic spinner into a different picture.
 */
import { useEffect } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * Endless drift + zoom on a full-bleed background photo. Starts at exactly
 * the transform `useKenBurnsSettle` ends on (scale 1.07, no drift), so the
 * handoff from the boot loader to this screen has no visible jump.
 */
export function useKenBurnsLoop(durationMs = 7000) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(
      withSequence(
        withTiming(1, { duration: durationMs, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: durationMs, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [p, durationMs]);
  return useAnimatedStyle(() => ({
    transform: [
      { scale: 1.07 + p.value * 0.06 },
      { translateX: p.value * -18 },
      { translateY: p.value * -12 },
    ],
  }));
}

/** One-shot settle from a slight zoom-in down to rest — used on first paint. */
export function useKenBurnsSettle(durationMs = 2200) {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withTiming(1, { duration: durationMs, easing: Easing.out(Easing.cubic) });
  }, [s, durationMs]);
  return useAnimatedStyle(() => ({
    transform: [{ scale: 1.18 - s.value * 0.11 }],
  }));
}

/** Soft endless pulse — used behind the leaf badge on both screens. */
export function useBreathe(durationMs = 1900) {
  const b = useSharedValue(0);
  useEffect(() => {
    b.value = withRepeat(
      withSequence(
        withTiming(1, { duration: durationMs, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: durationMs, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [b, durationMs]);
  return useAnimatedStyle(() => ({
    opacity: 0.3 + b.value * 0.4,
    transform: [{ scale: 1 + b.value * 0.14 }],
  }));
}
