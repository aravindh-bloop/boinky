import type { IconName } from './Icon';
import { palette } from './tokens';

export interface KindMeta {
  icon: IconName;
  tint: string;
  soft: string;
}

/**
 * Field-work kinds → a signature colour, so task / activity / calendar lists
 * are multi-coloured rather than a wall of one green. Keyed by the strings the
 * backend uses for `task_type` and activity `kind`.
 */
const TABLE: Record<string, KindMeta> = {
  irrigation: { icon: 'irrigate', tint: palette.sky, soft: palette.skySoft },
  spraying: { icon: 'spray', tint: palette.iris, soft: palette.irisSoft },
  fertilizing: { icon: 'fertilize', tint: palette.gold, soft: palette.goldSoft },
  sowing: { icon: 'fields', tint: palette.primary, soft: palette.primarySoft },
  weeding: { icon: 'weeding', tint: palette.leaf, soft: palette.leafSoft },
  scouting: { icon: 'scout', tint: '#3E8E9C', soft: '#D6EBEE' },
  harvest: { icon: 'harvest', tint: palette.coral, soft: palette.coralSoft },
  other: { icon: 'calendar', tint: palette.primary, soft: palette.primarySoft },
};

const FALLBACK: KindMeta = { icon: 'activity', tint: palette.primary, soft: palette.primarySoft };

export function kindMeta(kind?: string | null): KindMeta {
  if (!kind) return FALLBACK;
  return TABLE[kind] ?? FALLBACK;
}
