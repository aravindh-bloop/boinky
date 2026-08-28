/**
 * Shared motion language. Consistency across these curves is what makes the app
 * feel "designed" rather than animated. Organic = gentle springs with a hint of
 * overshoot, nothing linear, nothing abrupt.
 */
import { Easing, ReduceMotion } from 'react-native-reanimated';

export const spring = {
  /** default for most UI — settles quickly, barely overshoots */
  gentle: { damping: 18, stiffness: 160, mass: 1, reduceMotion: ReduceMotion.System },
  /** slow, fluid — sheets, large surfaces */
  soft: { damping: 22, stiffness: 90, mass: 1, reduceMotion: ReduceMotion.System },
  /** playful — success states, badges popping in */
  bouncy: { damping: 11, stiffness: 190, mass: 0.9, reduceMotion: ReduceMotion.System },
  /** immediate feedback — press in/out */
  snappy: { damping: 26, stiffness: 320, mass: 0.8, reduceMotion: ReduceMotion.System },
} as const;

export const timing = {
  fast: { duration: 160, easing: Easing.bezier(0.22, 1, 0.36, 1) },
  base: { duration: 260, easing: Easing.bezier(0.22, 1, 0.36, 1) },
  slow: { duration: 420, easing: Easing.bezier(0.22, 1, 0.36, 1) },
  /** slight overshoot for organic feel */
  organic: { duration: 380, easing: Easing.bezier(0.34, 1.26, 0.64, 1) },
} as const;

/** stagger step between list items entering — kept small so lists feel instant */
export const STAGGER_MS = 26;
/** cap total stagger so long lists never feel delayed */
export const STAGGER_MAX_MS = 180;

/** press-scale target for tappable surfaces */
export const PRESS_SCALE = 0.965;
export const PRESS_SCALE_SMALL = 0.94;
