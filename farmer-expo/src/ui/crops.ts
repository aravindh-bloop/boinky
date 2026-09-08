import type { IconName } from './Icon';
import { palette } from './tokens';

export interface CropMeta {
  /** Display name, title-cased. */
  label: string;
  /** Strong accent for rails, bars, icons. */
  tint: string;
  /** Soft wash for icon tiles / chips. */
  soft: string;
  icon: IconName;
  /** Typical field duration in days — used to place the growth-stage bar. */
  duration: number;
}

const GENERIC: CropMeta = {
  label: 'Crop',
  tint: palette.primary,
  soft: palette.primarySoft,
  icon: 'fields',
  duration: 120,
};

// Keyed by lowercased crop name; aliases point at the same entry.
const TABLE: Record<string, CropMeta> = {
  rice: { label: 'Rice', tint: '#4E9A6B', soft: '#DCEEE2', icon: 'leaf', duration: 120 },
  paddy: { label: 'Paddy', tint: '#4E9A6B', soft: '#DCEEE2', icon: 'leaf', duration: 120 },
  wheat: { label: 'Wheat', tint: '#C99A3F', soft: palette.goldSoft, icon: 'fields', duration: 140 },
  sugarcane: { label: 'Sugarcane', tint: '#6E9150', soft: palette.primarySoft, icon: 'fields', duration: 330 },
  groundnut: { label: 'Groundnut', tint: '#B9803C', soft: '#F1E2CC', icon: 'leaf', duration: 110 },
  peanut: { label: 'Groundnut', tint: '#B9803C', soft: '#F1E2CC', icon: 'leaf', duration: 110 },
  cotton: { label: 'Cotton', tint: '#5E9AA8', soft: '#D8EBEE', icon: 'fields', duration: 170 },
  maize: { label: 'Maize', tint: '#D0A43C', soft: palette.goldSoft, icon: 'fields', duration: 110 },
  corn: { label: 'Maize', tint: '#D0A43C', soft: palette.goldSoft, icon: 'fields', duration: 110 },
  millet: { label: 'Millet', tint: '#B08A46', soft: '#EFE4CE', icon: 'fields', duration: 100 },
  ragi: { label: 'Ragi', tint: '#9A7B4E', soft: '#EAE0D0', icon: 'fields', duration: 120 },
  tomato: { label: 'Tomato', tint: '#D0654A', soft: palette.coralSoft, icon: 'leaf', duration: 100 },
  onion: { label: 'Onion', tint: '#B06A9B', soft: '#F0DEEC', icon: 'leaf', duration: 130 },
  potato: { label: 'Potato', tint: '#B08A46', soft: '#EFE4CE', icon: 'leaf', duration: 110 },
  chilli: { label: 'Chilli', tint: '#C64A3C', soft: palette.coralSoft, icon: 'leaf', duration: 150 },
  banana: { label: 'Banana', tint: '#C9A63C', soft: palette.goldSoft, icon: 'fields', duration: 300 },
  pulses: { label: 'Pulses', tint: '#7A8B4E', soft: palette.leafSoft, icon: 'leaf', duration: 95 },
  gram: { label: 'Gram', tint: '#7A8B4E', soft: palette.leafSoft, icon: 'leaf', duration: 95 },
  soybean: { label: 'Soybean', tint: '#7A8B4E', soft: palette.leafSoft, icon: 'leaf', duration: 100 },
  turmeric: { label: 'Turmeric', tint: '#D19A2E', soft: palette.goldSoft, icon: 'fields', duration: 250 },
};

export function cropMeta(crop?: string | null): CropMeta {
  if (!crop) return GENERIC;
  const key = crop.trim().toLowerCase();
  return TABLE[key] ?? { ...GENERIC, label: key.charAt(0).toUpperCase() + key.slice(1) };
}

export interface GrowthStage {
  /** 0–1 through the crop cycle. */
  pct: number;
  label: string;
}

/** Where the crop is in its cycle, from days since sowing. */
export function growthStage(
  daysSinceSown: number | null | undefined,
  crop?: string | null,
): GrowthStage | null {
  if (daysSinceSown == null || daysSinceSown < 0) return null;
  const { duration } = cropMeta(crop);
  const pct = Math.max(0, Math.min(1, daysSinceSown / duration));
  const label =
    pct < 0.12
      ? 'Seedling'
      : pct < 0.4
        ? 'Vegetative'
        : pct < 0.68
          ? 'Flowering'
          : pct < 0.92
            ? 'Grain fill'
            : 'Harvest-ready';
  return { pct, label };
}
