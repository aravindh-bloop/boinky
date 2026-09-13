/**
 * AgriPod design tokens.
 *
 * Clean and quiet: a cool off-white canvas, white cards, one fresh sage-green as
 * the only real colour, cool greys for everything structural. Lots of air,
 * hairline edges, barely-there shadows. Reference: modern plant-shop apps —
 * simple, spacious, uncluttered.
 */
import type { TextStyle, ViewStyle } from 'react-native';

export const palette = {
  // canvas & surfaces — a soft green-grey paper, distinctly not white
  canvas: '#EDF0E8',
  canvasAlt: '#E4E9DD',
  surface: '#FFFFFF',
  surfaceAlt: '#F6F8F2',
  surfaceSunken: '#E9EDE2',

  // lines — soft cool grey
  border: '#DFE4D7',
  borderStrong: '#CDD4C2',
  hairline: '#E7EBDF',

  // primary — fresh sage-olive green (crop health, main actions, success)
  primary: '#6E9150',
  primaryDeep: '#425F32',
  primaryPress: '#628345',
  primarySoft: '#E0EACF',
  leaf: '#82A862',
  leafSoft: '#E5EFD6',
  sage: '#A6B79A',

  // category accents — each feature area has a signature tint
  sky: '#4183B4', // weather, water, irrigation
  skySoft: '#D6E6F1',
  iris: '#7A6FB8', // AI, insight, "ask AgriPod"
  irisSoft: '#E5E1F3',
  gold: '#D19E3B', // money, harvest, schemes
  goldSoft: '#F5E7C6',
  coral: '#DB7048', // alerts, outbreaks, urgent
  coralSoft: '#F8DECF',

  // legacy accent names — kept so screens don't break, remapped to the system
  clay: '#DB7048', // == coral
  claySoft: '#F8DECF',
  soil: '#4A4A42',
  honey: '#D19E3B', // == gold / amber warn
  honeySoft: '#F5E7C6',
  cream: '#F2F3EE',

  // text — cool near-black
  text: '#232821',
  textMuted: '#687062',
  textFaint: '#9AA093',
  onPrimary: '#FFFFFF',
  onDark: '#F1F3EE',

  // semantic
  success: '#6E9150',
  successSoft: '#E0EACF',
  warn: '#D19E3B',
  warnSoft: '#F5E7C6',
  danger: '#C9553C',
  dangerSoft: '#F7DDD5',
  info: '#4183B4',
} as const;

export const severity = {
  low: { fg: palette.leaf, bg: palette.leafSoft, label: 'Low' },
  medium: { fg: palette.honey, bg: palette.warnSoft, label: 'Medium' },
  high: { fg: palette.danger, bg: palette.dangerSoft, label: 'High' },
} as const;

export const riskLevel = severity;

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  xxxl: 36,
  huge: 48,
  giant: 64,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  pill: 999,
} as const;

export const fonts = {
  // simple sans throughout — headings included. Fraunces stays loaded but unused.
  display: 'NunitoSans_700Bold',
  body: 'NunitoSans_400Regular',
  bodyMedium: 'NunitoSans_600SemiBold',
  bodyBold: 'NunitoSans_700Bold',
} as const;

/** Tamil counterparts — <Text> remaps fontFamily to these when the language is Tamil. */
export const tamilFontFor: Record<string, string> = {
  NunitoSans_700Bold: 'NotoSansTamil_700Bold',
  NunitoSans_400Regular: 'NotoSansTamil_400Regular',
  NunitoSans_600SemiBold: 'NotoSansTamil_600SemiBold',
  Fraunces_600SemiBold: 'NotoSerifTamil_600SemiBold',
};

type TypeToken = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'> & {
  textTransform?: TextStyle['textTransform'];
};

export const type: Record<
  | 'hero'
  | 'title'
  | 'heading'
  | 'subhead'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'overline'
  | 'caption'
  | 'mono',
  TypeToken
> = {
  hero: { fontFamily: fonts.bodyBold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  title: { fontFamily: fonts.bodyBold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.bodyBold, fontSize: 16.5, lineHeight: 22, letterSpacing: -0.2 },
  subhead: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 19, letterSpacing: -0.1 },
  body: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodyMedium, fontSize: 14.5, lineHeight: 22 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 12.5, lineHeight: 16, letterSpacing: 0 },
  overline: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: fonts.bodyMedium, fontSize: 12.5, lineHeight: 17, letterSpacing: 0.2 },
};

/**
 * Barely-there cool shadows. Cards mostly rely on a hairline border; the shadow
 * just softens the edge so white cards don't float invisibly on the canvas.
 */
export const shadow: Record<'e0' | 'e1' | 'e2' | 'e3', ViewStyle> = {
  e0: {
    shadowColor: '#1F2A16',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  e1: {
    shadowColor: '#1F2A16',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  e2: {
    shadowColor: '#1F2A16',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  e3: {
    shadowColor: '#1F2A16',
    shadowOpacity: 0.1,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
};

export const gradients = {
  // Home screen hero — soft sage green (from the user's reference swatch)
  home: ['#8FAE8C', '#62815F'] as const,
  homeCta: ['#B2CCB0', '#9DBC9A'] as const,
  // the dashboard hero — deep phthalo green (blue-leaning, saturated)
  hero: ['#0F5138', '#0A3527'] as const,
  canopy: ['#0F5138', '#0A3527'] as const,
  // lighter phthalo — the scan FAB, CTAs
  dawn: ['#1C7A56', '#125E41'] as const,
  dusk: ['#0C3B2C', '#154A38'] as const,
  gold: ['#DDB35F', '#D19E3B'] as const,
  // the loading-screen sunrise
  sunrise: ['#FDEBD4', '#F9D3A6', '#EEB076'] as const,
  sunriseSoft: ['#FDEEDC', '#F8E0C4'] as const,
  paper: ['#F2F4EC', '#EDF0E8'] as const,
};

/**
 * Screen-header gradients — one per feature area, so every screen opens with a
 * band of its own colour instead of black text on the canvas. Each is dark
 * enough to carry white text.
 */
export const tone = {
  crop: { grad: ['#0F5138', '#0A3527'] as const, solid: palette.primary },
  weather: { grad: ['#2F6E9C', '#204E73'] as const, solid: palette.sky },
  alert: { grad: ['#CF6B45', '#A9482A'] as const, solid: palette.coral },
  money: { grad: ['#C99A3F', '#9C7526'] as const, solid: palette.gold },
  ai: { grad: ['#7A6FB8', '#564A93'] as const, solid: palette.iris },
  task: { grad: ['#14603F', '#0B3B2A'] as const, solid: palette.leaf },
  scan: { grad: ['#125A3E', '#0A3728'] as const, solid: '#125A3E' },
  scheme: { grad: ['#47569C', '#313E78'] as const, solid: '#47569C' },
} as const;

export type ToneKey = keyof typeof tone;
