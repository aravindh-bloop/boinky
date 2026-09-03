import * as Location from 'expo-location';
import { tr } from './i18n';

export interface Fix {
  lat: number;
  lng: number;
  /** Horizontal accuracy in metres, if the platform reported it. */
  accuracyM: number | null;
}

/**
 * Ask for permission (once) and return a single high-accuracy GPS fix.
 *
 * Throws a translated, farmer-readable message on denial or timeout — callers
 * surface it with `alertT`. A field or scan without a fix still works; the point
 * of the exact fix is district-level outbreak attribution (backend Module 3).
 */
export async function getFix(): Promise<Fix> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error(tr('Location permission is off. Turn it on in Settings, or enter the coordinates by hand.'));
  }

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    lat: round6(pos.coords.latitude),
    lng: round6(pos.coords.longitude),
    accuracyM: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null,
  };
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
