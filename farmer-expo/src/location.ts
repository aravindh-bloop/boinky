import * as Location from 'expo-location';
import { tr } from './i18n';

export interface Fix {
  lat: number;
  lng: number;
  /** Horizontal accuracy in metres, if the platform reported it. */
  accuracyM: number | null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Ask for permission (once) and return a single GPS fix.
 *
 * Throws a translated, farmer-readable message on denial, disabled location
 * services, or timeout — callers surface it with `alertT`. A field or scan
 * without a fix still works; the point of the exact fix is district-level
 * outbreak attribution (backend Module 3).
 *
 * `getCurrentPositionAsync` has no built-in timeout — indoors or with a weak
 * signal it can hang indefinitely, which read as "location fetching doesn't
 * work" (it just never finished). Time-box a high-accuracy fix, then fall
 * back to a fast, lower-accuracy one (network/cell-based) rather than
 * leaving the caller stuck.
 */
export async function getFix(): Promise<Fix> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error(tr('Location permission is off. Turn it on in Settings, or enter the coordinates by hand.'));
  }

  const servicesOn = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!servicesOn) {
    throw new Error(tr('Turn on Location in your phone settings, then try again.'));
  }

  try {
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      15_000,
    );
    return toFix(pos);
  } catch {
    // Fast fallback — network/cell based, much quicker than a cold GPS lock.
    try {
      const pos = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        10_000,
      );
      return toFix(pos);
    } catch {
      throw new Error(
        tr('Could not get a location fix — try moving near a window, or enter the coordinates by hand.'),
      );
    }
  }
}

function toFix(pos: Location.LocationObject): Fix {
  return {
    lat: round6(pos.coords.latitude),
    lng: round6(pos.coords.longitude),
    accuracyM: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null,
  };
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
