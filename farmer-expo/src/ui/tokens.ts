/**
 * AgriPod design tokens — "nature / organic": warm paper canvas, forest + leaf greens,
 * clay / soil / honey earth accents, generous rounding, soft warm-tinted shadows.
 */
import type { TextStyle, ViewStyle } from 'react-native';

export const palette = {
  // canvas & surfaces
  canvas: '#FBF8F1',
  canvasAlt: '#F3EEE1',
  surface: '#FFFFFF',
  surfaceAlt: '#FAF6EC',
  surfaceSunken: '#F0EADB',

  // lines
  border: '#EAE1CE',
  borderStrong: '#D9CDB2',
  hairline: '#F0E9DA',

  // brand greens
  primary: '#3B7A3F',
  primaryDeep: '#2C5C30',
  primaryPress: '#336B37',
  primarySoft: '#E6EFDF',
  leaf: '#5DA34E',
  leafSoft: '#EAF3E2',
  sage: '#8CA982',

  // earth accents
  clay: '#C57B54',
  claySoft: '#F6E6DA',
  soil: '#5C4632',
  honey: '#DDA24C',
  honeySoft: '#F8EACF',
  cream: '#F1E7D0',

  // text
  text: '#2A2420',
  textMuted: '#6E6357',
  textFaint: '#9C9184',
  onPrimary: '#FFFFFF',
  onDark: '#F6F1E6',

  // semantic
  success: '#3B7A3F',
  successSoft: '#E6EFDF',
  warn: '#C4892E',
  warnSoft: '#F8EACF',
  danger: '#B24A2C',
  dangerSoft: '#F6E0D7',
  info: '#3E6E7A',
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
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  xxl: 34,
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

type TypeToken = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'>;

export const type: Record<
  'hero' | 'title' | 'heading' | 'subhead' | 'body' | 'bodyStrong' | 'label' | 'caption' | 'mono',
  TypeToken
> = {
  hero: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.bodyBold, fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
  subhead: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 17, letterSpacing: 0.3 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
};

export const shadow: Record<'e1' | 'e2' | 'e3', ViewStyle> = {
  e1: {
    shadowColor: '#4A3826',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  e2: {
    shadowColor: '#4A3826',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  e3: {
    shadowColor: '#4A3826',
    shadowOpacity: 0.14,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
};

export const gradients = {
  canopy: ['#3B7A3F', '#5DA34E'] as const,
  dusk: ['#2C5C30', '#3B7A3F'] as const,
  harvest: ['#DDA24C', '#C57B54'] as const,
  paper: ['#FBF8F1', '#F1E7D0'] as const,
};
