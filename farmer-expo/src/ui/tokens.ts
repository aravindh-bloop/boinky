/**
 * AgriPod design tokens — "sunrise": a warm off-white canvas, apricot-gold as the
 * signature warmth (headers, highlights, the sun), a quiet sage-olive green for
 * everything functional (actions, crop health, success). Elegant means restraint:
 * few colours, wide whitespace, soft everything, one accent per surface.
 */
import type { TextStyle, ViewStyle } from 'react-native';

export const palette = {
  // canvas & surfaces — warm, barely-there peach
  canvas: '#FCF8F2',
  canvasAlt: '#F6EEE1',
  surface: '#FFFFFF',
  surfaceAlt: '#FBF4EA',
  surfaceSunken: '#F3EBDD',

  // lines
  border: '#EEE4D2',
  borderStrong: '#E0D3BC',
  hairline: '#F4ECDE',

  // green — the functional colour: primary actions, crop health, success
  primary: '#5E7F53',
  primaryDeep: '#3F5A38',
  primaryPress: '#54724A',
  primarySoft: '#E8EFE2',
  leaf: '#7BA366',
  leafSoft: '#EEF4E8',
  sage: '#9DB292',

  // gold — the warm sunrise accent: brand, headers, sun, gentle highlights
  clay: '#D98F5C', // kept name; now a warm apricot (was terracotta)
  claySoft: '#FBEAD6',
  soil: '#5A4A38',
  honey: '#E3A45C',
  honeySoft: '#FBEAD3',
  cream: '#F7ECD9',

  // text — warm charcoal
  text: '#2B2620',
  textMuted: '#6B6255',
  textFaint: '#9C9284',
  onPrimary: '#FFFFFF',
  onDark: '#FBF3E6',

  // semantic
  success: '#5E7F53',
  successSoft: '#E8EFE2',
  warn: '#D69A3C',
  warnSoft: '#FBEAD3',
  danger: '#C15F42',
  dangerSoft: '#F7E3D9',
  info: '#5C7C84',

  // sunrise scene (loading screen + hero glows)
  sky1: '#FDEBD4',
  sky2: '#F9D3A6',
  sky3: '#EEB076',
  sunGlow: '#FFD9A0',
  horizonLine: '#C88A57',
  fieldSilhouette: '#4C6440',
} as const;

export const severity = {
  low: { fg: palette.leaf, bg: palette.leafSoft, label: 'Low' },
  medium: { fg: palette.warn, bg: palette.warnSoft, label: 'Medium' },
  high: { fg: palette.danger, bg: palette.dangerSoft, label: 'High' },
} as const;

export const riskLevel = severity;

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 30,
  xxxl: 38,
  huge: 48,
  giant: 64,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 30,
  pill: 999,
} as const;

export const fonts = {
  display: 'Fraunces_600SemiBold',
  body: 'NunitoSans_400Regular',
  bodyMedium: 'NunitoSans_600SemiBold',
  bodyBold: 'NunitoSans_700Bold',
} as const;

/** Tamil counterparts — <Text> remaps fontFamily to these when the language is Tamil. */
export const tamilFontFor: Record<string, string> = {
  Fraunces_600SemiBold: 'NotoSerifTamil_600SemiBold',
  NunitoSans_400Regular: 'NotoSansTamil_400Regular',
  NunitoSans_600SemiBold: 'NotoSansTamil_600SemiBold',
  NunitoSans_700Bold: 'NotoSansTamil_700Bold',
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
  hero: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  title: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  subhead: { fontFamily: fonts.bodyBold, fontSize: 14.5, lineHeight: 20, letterSpacing: -0.1 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 23 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 17, letterSpacing: 0.1 },
  overline: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  caption: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17 },
  mono: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
};

/**
 * Warm, diffuse shadows — barely-there on light, present enough to lift a card.
 * One layer only (RN can't stack), tuned soft: low opacity, wide radius, warm hue.
 */
export const shadow: Record<'e0' | 'e1' | 'e2' | 'e3', ViewStyle> = {
  e0: {
    shadowColor: '#5A4223',
    shadowOpacity: 0.04,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  e1: {
    shadowColor: '#5A4223',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  e2: {
    shadowColor: '#5A4223',
    shadowOpacity: 0.08,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 7,
  },
  e3: {
    shadowColor: '#5A4223',
    shadowOpacity: 0.12,
    shadowRadius: 38,
    shadowOffset: { width: 0, height: 18 },
    elevation: 13,
  },
};

export const gradients = {
  // the signature header wash — apricot dawn
  canopy: ['#F7CFA0', '#EDAF77', '#DE9560'] as const,
  sunrise: ['#FDEBD4', '#F9D3A6', '#EEB076'] as const,
  sunriseSoft: ['#FDEEDC', '#F8E0C4'] as const,
  // green washes — for the scan FAB and health surfaces
  dawn: ['#6C8C60', '#5E7F53'] as const,
  dusk: ['#3F5A38', '#5E7F53'] as const,
  gold: ['#E9B36F', '#D98F5C'] as const,
  paper: ['#FCF8F2', '#F7ECD9'] as const,
};
