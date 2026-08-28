import type { WeatherDay } from '../../integrations/weather.js';
import { cropProfile, type CropProfile } from './crop-profiles.js';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskInput {
  weather: WeatherDay;
  crop: string | null;
  daysSinceSown: number | null;
  /** High-severity confirmed scans of the same/any disease within ~10km in the last 21 days. */
  nearbyOutbreaks: number;
}

export interface RiskResult {
  score: number; // 0..100
  level: RiskLevel;
  reason: string;
  factors: string[];
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function levelOf(score: number): RiskLevel {
  if (score >= 67) return 'high';
  if (score >= 34) return 'medium';
  return 'low';
}

/**
 * Transparent heuristic outbreak-risk score for one field-day. Combines:
 *  - fungal/blight pressure  (humidity, leaf-wetness hours, temperate band, rain)
 *  - pest pressure           (warm + recent rain)
 *  - crop growth-stage susceptibility
 *  - local outbreak history  (nearby confirmed high-severity scans)
 * Documented in docs/ARCHITECTURE.md. Not ML — honest for the pitch.
 */
export function computeRisk(input: RiskInput): RiskResult {
  const { weather: w, crop, daysSinceSown, nearbyOutbreaks } = input;
  const profile = cropProfile(crop);
  const factors: string[] = [];

  // ── Fungal / blight pressure (0..45) ──
  let fungal = 0;
  const rh = w.humidityMeanPct ?? 0;
  const wetHours = w.highHumidityHours;
  const tMean = w.tempMeanC ?? 22;

  if (rh >= 85) fungal += 18;
  else if (rh >= 75) fungal += 12;
  else if (rh >= 65) fungal += 6;

  if (wetHours >= 10) fungal += 14;
  else if (wetHours >= 6) fungal += 9;
  else if (wetHours >= 3) fungal += 4;

  // Most foliar fungi/oomycetes thrive 12–26°C; sharp fall-off outside.
  if (tMean >= 12 && tMean <= 26) fungal += 8;
  else if (tMean > 26 && tMean <= 30) fungal += 3;

  if ((w.rainfallMm ?? 0) >= 10) fungal += 5;
  fungal = Math.min(fungal, 45);
  if (fungal >= 25) factors.push(`high humidity (${Math.round(rh)}%, ${wetHours}h leaf wetness)`);
  else if (fungal >= 12) factors.push(`moderate humidity (${Math.round(rh)}%)`);

  // ── Pest pressure (0..25) ──
  let pest = 0;
  if (tMean >= 24 && tMean <= 34) pest += 10;
  if ((w.rainfallMm ?? 0) >= 5 && (w.rainfallMm ?? 0) <= 40) pest += 6; // flush of growth
  if (rh >= 60 && rh < 85) pest += 4;
  pest = Math.min(pest, 25);
  if (pest >= 12) factors.push(`warm, humid conditions favour sucking pests`);

  // ── Crop growth-stage susceptibility (multiplier 0.6..1.25) ──
  let stageMult = 0.9;
  if (daysSinceSown != null) {
    const { fromDay, toDay } = profile.peakVulnerability;
    if (daysSinceSown >= fromDay && daysSinceSown <= toDay) {
      stageMult = 1.25;
      factors.push(`crop is in its most vulnerable stage (day ${daysSinceSown})`);
    } else if (daysSinceSown > profile.durationDays) {
      stageMult = 0.6; // past harvest window
    } else if (daysSinceSown < fromDay) {
      stageMult = 0.8;
    }
  }

  // ── Local outbreak history (0..25) ──
  let history = 0;
  if (nearbyOutbreaks >= 3) history = 25;
  else if (nearbyOutbreaks === 2) history = 16;
  else if (nearbyOutbreaks === 1) history = 9;
  if (history > 0) {
    factors.push(
      `${nearbyOutbreaks} confirmed outbreak${nearbyOutbreaks > 1 ? 's' : ''} nearby in the last 3 weeks`,
    );
  }

  const weatherComponent = (fungal + pest) * stageMult;
  const score = clamp(Math.round(weatherComponent + history));
  const level = levelOf(score);

  return { score, level, reason: buildReason(level, profile, factors), factors };
}

function buildReason(level: RiskLevel, profile: CropProfile, factors: string[]): string {
  const threat = profile.mainThreats[0] ?? 'crop disease';
  const lead =
    level === 'high'
      ? `High risk of ${threat} and related problems`
      : level === 'medium'
        ? `Moderate risk building for ${threat}`
        : `Low risk right now`;
  if (factors.length === 0) return `${lead}. Conditions are not strongly favourable.`;
  return `${lead}: ${factors.slice(0, 3).join('; ')}.`;
}
