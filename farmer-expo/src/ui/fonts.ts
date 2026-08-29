// Deep per-weight imports. The package barrels (`@expo-google-fonts/nunito-sans`)
// `require()` every weight they ship at module scope — 16 for Nunito Sans alone —
// and Metro cannot tree-shake a require, so importing from the barrel bundles
// ~1.5MB of .ttf files the app never renders. Same trick as src/ui/Icon.tsx.
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { NunitoSans_400Regular } from '@expo-google-fonts/nunito-sans/400Regular';
import { NunitoSans_600SemiBold } from '@expo-google-fonts/nunito-sans/600SemiBold';
import { NunitoSans_700Bold } from '@expo-google-fonts/nunito-sans/700Bold';
import { NotoSerifTamil_600SemiBold } from '@expo-google-fonts/noto-serif-tamil/600SemiBold';
import { NotoSansTamil_400Regular } from '@expo-google-fonts/noto-sans-tamil/400Regular';
import { NotoSansTamil_600SemiBold } from '@expo-google-fonts/noto-sans-tamil/600SemiBold';
import { NotoSansTamil_700Bold } from '@expo-google-fonts/noto-sans-tamil/700Bold';

/**
 * Every font here is loaded before the first paint, so this list stays minimal:
 * only the weights the type scale in tokens.ts actually references, in Latin and
 * Tamil. <Text> swaps to the Tamil family when the language is Tamil.
 */
export const fontMap = {
  Fraunces_600SemiBold,
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  NotoSerifTamil_600SemiBold,
  NotoSansTamil_400Regular,
  NotoSansTamil_600SemiBold,
  NotoSansTamil_700Bold,
};
