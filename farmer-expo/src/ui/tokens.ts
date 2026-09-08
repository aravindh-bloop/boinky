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
  // canvas & surfaces — cool paper, not warm
  canvas: '#F4F6F2',
  canvasAlt: '#ECEFE8',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F8F4',
  surfaceSunken: '#EFF1EC',

  // lines — soft cool grey
  border: '#E4E7DF',
  borderStrong: '#D3D8CC',
  hairline: '#ECEEE8',

  // the one colour: fresh sage-olive green
  primary: '#6E9150',
  primaryDeep: '#4C6B38',
  primaryPress: '#628345',
  primarySoft: '#EBF1E3',
  leaf: '#82A862',
  leafSoft: '#EFF4E8',
  sage: '#A6B79A',

  // legacy accent names — kept so screens don't break, tuned to the new system.
  // 'clay' / 'honey' are now just the same green family or a neutral.
  clay: '#8A6F52', // rare warm-neutral (kept muted)
  claySoft: '#F0EBE3',
  soil: '#4A4A42',
  honey: '#C79A4E', // amber, only for a warn state
  honeySoft: '#F6EEDD',
  cream: '#F2F3EE',

  // text — cool near-black
  text: '#232821',
  textMuted: '#687062',
  textFaint: '#9AA093',
  onPrimary: '#FFFFFF',
  onDark: '#F1F3EE',

  // semantic — restrained
  success: '#6E9150',
  successSoft: '#EBF1E3',
  warn: '#C79A4E',
  warnSoft: '#F6EEDD',
  danger: '#C0604A',
  dangerSoft: '#F5E4DF',
  info: '#5E8087',

  // sunrise scene — used only by the loading screen
  sky1: '#FDEBD4',
  sky2: '#F9D3A6',
  sky3: '#EEB076',
  sunGlow: '#FFD9A0',
  horizonLine: '#C88A57',
  fieldSilhouette: '#3E5A32',
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
  // used rarely now — the scan FAB, an occasional CTA
  canopy: ['#7DA05C', '#6E9150'] as const,
  dawn: ['#7DA05C', '#6E9150'] as const,
  dusk: ['#4C6B38', '#6E9150'] as const,
  gold: ['#D3AE68', '#C79A4E'] as const,
  // the loading-screen sunrise
  sunrise: ['#FDEBD4', '#F9D3A6', '#EEB076'] as const,
  sunriseSoft: ['#FDEEDC', '#F8E0C4'] as const,
  paper: ['#F4F6F2', '#ECEFE8'] as const,
};
