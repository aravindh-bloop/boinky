import { queryMaybe, query } from '../../db/query.js';
import { AppError } from '../../http/errors.js';
import {
  fetchDetailedForecast,
  type DetailedForecast,
  type HourPoint,
} from '../../integrations/weather.js';

const CACHE_TTL_MIN = 30;

export interface AgroAdvisory {
  key: string;
  severity: 'info' | 'watch' | 'warning';
  title: string;
  detail: string;
}

export interface WeatherResult extends DetailedForecast {
  place: { lat: number; lng: number; label: string | null };
  advisories: AgroAdvisory[];
  sprayWindow: { start: string; end: string; hours: number } | null;
}

/** Round to a ~5km grid so nearby fields share a cache entry. */
const gridKey = (lat: number, lng: number) => `${lat.toFixed(2)},${lng.toFixed(2)}`;

export async function getWeather(opts: {
  farmerId: string;
  fieldId?: string;
  lat?: number;
  lng?: number;
  /** if true, only use a cached forecast — never make a live Open-Meteo call */
  cachedOnly?: boolean;
}): Promise<WeatherResult | null> {
  let lat = opts.lat ?? null;
  let lng = opts.lng ?? null;
  let label: string | null = null;

  if ((lat == null || lng == null) && opts.fieldId) {
    const f = await queryMaybe<{ lat: number | null; lng: number | null; name: string | null; crop: string }>(
      `SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, name, crop
         FROM fields WHERE id = $1 AND farmer_id = $2`,
      [opts.fieldId, opts.farmerId],
    );
    if (f?.lat != null && f?.lng != null) {
      lat = f.lat;
      lng = f.lng;
      label = f.name || f.crop;
    }
  }

  if (lat == null || lng == null) {
    // fall back to the farmer's first located field
    const f = await queryMaybe<{ lat: number; lng: number; name: string | null; crop: string }>(
      `SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, name, crop
         FROM fields WHERE farmer_id = $1 AND location IS NOT NULL
         ORDER BY created_at LIMIT 1`,
      [opts.farmerId],
    );
    if (f) {
      lat = f.lat;
      lng = f.lng;
      label = f.name || f.crop;
    }
  }

  if (lat == null || lng == null) {
    if (opts.cachedOnly) return null;
    throw AppError.badRequest('No location available — add a location to a field, or pass lat & lng');
  }

  const forecast = await getCachedForecast(lat, lng, opts.cachedOnly);
  if (!forecast) return null;
  const advisories = deriveAdvisories(forecast);
  const sprayWindow = findSprayWindow(forecast.hourly);

  return { ...forecast, place: { lat, lng, label }, advisories, sprayWindow };
}

async function getCachedForecast(
  lat: number,
  lng: number,
  cachedOnly = false,
): Promise<DetailedForecast | null> {
  const key = gridKey(lat, lng);
  const cached = await queryMaybe<{ payload: DetailedForecast; fetched_at: string }>(
    `SELECT payload, fetched_at FROM weather_cache WHERE grid_key = $1`,
    [key],
  );
  if (cached) {
    const ageMin = (Date.now() - new Date(cached.fetched_at).getTime()) / 60000;
    if (ageMin < CACHE_TTL_MIN || cachedOnly) return cached.payload;
  }
  if (cachedOnly) return null;
  const fresh = await fetchDetailedForecast(lat, lng);
  await query(
    `INSERT INTO weather_cache (grid_key, payload, fetched_at) VALUES ($1, $2, now())
     ON CONFLICT (grid_key) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now()`,
    [key, JSON.stringify(fresh)],
  );
  return fresh;
}

function deriveAdvisories(f: DetailedForecast): AgroAdvisory[] {
  const out: AgroAdvisory[] = [];
  const next3 = f.daily.slice(0, 3);
  const next7 = f.daily.slice(0, 7);

  const rain3 = sum(next3.map((d) => d.precipMm ?? 0));
  const heavyDay = next7.find((d) => (d.precipMm ?? 0) >= 35 || (d.precipProbPct ?? 0) >= 80);
  const hotDay = next7.find((d) => (d.tempMaxC ?? 0) >= 38);
  const coldDay = next7.find((d) => (d.tempMinC ?? 99) <= 4);
  const windyDay = next7.find((d) => (d.windMaxKph ?? 0) >= 35);
  const uvDay = next7.find((d) => (d.uvMax ?? 0) >= 9);

  if (heavyDay) {
    out.push({
      key: 'heavy_rain',
      severity: 'warning',
      title: `Heavy rain expected ${friendlyDay(heavyDay.date)}`,
      detail: `About ${Math.round(heavyDay.precipMm ?? 0)} mm. Delay spraying and fertiliser application, clear field drainage, and stake or support vulnerable plants.`,
    });
  }

  if (rain3 < 3) {
    out.push({
      key: 'dry_spell',
      severity: 'watch',
      title: 'Little rain in the next 3 days',
      detail: `Only ~${rain3.toFixed(0)} mm forecast. If your soil is drying, plan irrigation, especially for crops in a critical growth stage.`,
    });
  } else if (rain3 >= 3 && rain3 < 15 && !heavyDay) {
    out.push({
      key: 'light_rain',
      severity: 'info',
      title: 'Some rain expected',
      detail: `~${rain3.toFixed(0)} mm over 3 days. You may be able to skip one irrigation.`,
    });
  }

  if (hotDay) {
    out.push({
      key: 'heat',
      severity: 'warning',
      title: `Heat stress risk ${friendlyDay(hotDay.date)}`,
      detail: `Max around ${Math.round(hotDay.tempMaxC ?? 0)}°C. Irrigate in the early morning or evening, avoid mid-day spraying, and provide mulch where possible.`,
    });
  }
  if (coldDay) {
    out.push({
      key: 'cold',
      severity: 'warning',
      title: `Cold / frost risk ${friendlyDay(coldDay.date)}`,
      detail: `Min around ${Math.round(coldDay.tempMinC ?? 0)}°C. Light evening irrigation and smoke can reduce frost damage on sensitive crops.`,
    });
  }
  if (windyDay) {
    out.push({
      key: 'wind',
      severity: 'watch',
      title: `Windy ${friendlyDay(windyDay.date)}`,
      detail: `Gusts up to ${Math.round(windyDay.windMaxKph ?? 0)} km/h — poor for spraying (drift) and risky for tall crops.`,
    });
  }
  if (uvDay) {
    out.push({
      key: 'uv',
      severity: 'info',
      title: 'Strong sun this week',
      detail: 'High UV — good drying conditions for harvested produce, but water plants well and protect nursery seedlings.',
    });
  }

  return out;
}

/** First stretch of >= 3 daytime hours with no rain and calm wind, in the next 24h. */
function findSprayWindow(hourly: HourPoint[]): WeatherResult['sprayWindow'] {
  let start: string | null = null;
  let count = 0;
  let best: { start: string; end: string; hours: number } | null = null;

  for (const h of hourly) {
    const ok =
      h.isDay &&
      (h.precipMm ?? 0) < 0.2 &&
      (h.precipProbPct ?? 0) < 40 &&
      (h.windKph ?? 99) < 15 &&
      (h.tempC ?? 0) < 35;
    if (ok) {
      if (!start) start = h.time;
      count += 1;
    } else {
      if (start && count >= 3 && (!best || count > best.hours)) {
        best = { start, end: h.time, hours: count };
      }
      start = null;
      count = 0;
    }
  }
  if (start && count >= 3 && (!best || count > best.hours)) {
    best = { start, end: hourly[hourly.length - 1]!.time, hours: count };
  }
  return best;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function friendlyDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return `on ${d.toLocaleDateString('en-IN', { weekday: 'long' })}`;
}
