import { env } from '../config/env.js';
import { AppError } from '../http/errors.js';
import { logger } from '../lib/logger.js';
import { query, queryMaybe } from '../db/query.js';

/**
 * Open-Meteo's free tier rate-limits per IP (Render's egress is shared), so
 * every fetch goes through weather_cache. On a fetch failure (429, timeout) we
 * serve the last cached payload however stale — a slightly old forecast beats
 * an error screen.
 */
const CACHE_TTL_MIN = 45;

async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const row = await queryMaybe<{ payload: T; fetched_at: string }>(
    `SELECT payload, fetched_at FROM weather_cache WHERE grid_key = $1`,
    [key],
  ).catch(() => null);

  if (row && (Date.now() - new Date(row.fetched_at).getTime()) / 60000 < CACHE_TTL_MIN) {
    return row.payload;
  }
  try {
    const data = await fetcher();
    await query(
      `INSERT INTO weather_cache (grid_key, payload, fetched_at) VALUES ($1, $2, now())
       ON CONFLICT (grid_key) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now()`,
      [key, JSON.stringify(data)],
    ).catch((err) => logger.warn({ err, key }, 'weather cache write failed'));
    return data;
  } catch (err) {
    if (row) {
      logger.warn({ err, key }, 'open-meteo fetch failed — serving stale cache');
      return row.payload;
    }
    throw err;
  }
}

const grid = (lat: number, lng: number) => `${lat.toFixed(2)},${lng.toFixed(2)}`;

export interface WeatherDay {
  date: string; // YYYY-MM-DD
  tempMinC: number | null;
  tempMaxC: number | null;
  tempMeanC: number | null;
  humidityMeanPct: number | null;
  humidityMaxPct: number | null;
  /** Hours in the day with RH >= 90% — a leaf-wetness proxy for fungal risk. */
  highHumidityHours: number;
  rainfallMm: number | null;
  isForecast: boolean;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const avg = (xs: number[]): number | null =>
  xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null;

interface OpenMeteoResponse {
  hourly?: {
    time: string[];
    temperature_2m: (number | null)[];
    relative_humidity_2m: (number | null)[];
    precipitation: (number | null)[];
  };
  daily?: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
  };
}

/**
 * Fetch a window of daily weather aggregates for a location: `pastDays` history
 * plus today plus `forecastDays` ahead. Aggregated from Open-Meteo hourly data.
 */
export async function fetchWeatherWindow(
  lat: number,
  lng: number,
  opts: { pastDays?: number; forecastDays?: number } = {},
): Promise<WeatherDay[]> {
  const pastDays = opts.pastDays ?? 5;
  const forecastDays = opts.forecastDays ?? 3;
  return cached(`win:${grid(lat, lng)}:${pastDays}:${forecastDays}`, () =>
    fetchWeatherWindowRaw(lat, lng, pastDays, forecastDays),
  );
}

async function fetchWeatherWindowRaw(
  lat: number,
  lng: number,
  pastDays: number,
  forecastDays: number,
): Promise<WeatherDay[]> {
  const url = new URL(`${env.OPEN_METEO_BASE_URL}/forecast`);
  url.searchParams.set('latitude', lat.toFixed(4));
  url.searchParams.set('longitude', lng.toFixed(4));
  url.searchParams.set('hourly', 'temperature_2m,relative_humidity_2m,precipitation');
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum');
  url.searchParams.set('past_days', String(pastDays));
  url.searchParams.set('forecast_days', String(forecastDays + 1));
  url.searchParams.set('timezone', 'auto');

  const data = await getJson<OpenMeteoResponse>(url);

  const today = new Date().toISOString().slice(0, 10);
  const byDate = new Map<string, WeatherDay>();

  const d = data.daily;
  if (d) {
    for (let i = 0; i < d.time.length; i++) {
      const date = d.time[i]!;
      byDate.set(date, {
        date,
        tempMaxC: d.temperature_2m_max[i] ?? null,
        tempMinC: d.temperature_2m_min[i] ?? null,
        tempMeanC: null,
        humidityMeanPct: null,
        humidityMaxPct: null,
        highHumidityHours: 0,
        rainfallMm: d.precipitation_sum[i] ?? null,
        isForecast: date > today,
      });
    }
  }

  const h = data.hourly;
  if (h) {
    const acc = new Map<string, { t: number[]; rh: number[]; hi: number }>();
    for (let i = 0; i < h.time.length; i++) {
      const date = h.time[i]!.slice(0, 10);
      const bucket = acc.get(date) ?? { t: [], rh: [], hi: 0 };
      const t = h.temperature_2m[i];
      const rh = h.relative_humidity_2m[i];
      if (typeof t === 'number') bucket.t.push(t);
      if (typeof rh === 'number') {
        bucket.rh.push(rh);
        if (rh >= 90) bucket.hi += 1;
      }
      acc.set(date, bucket);
    }
    for (const [date, b] of acc) {
      const day = byDate.get(date) ?? {
        date,
        tempMaxC: b.t.length ? Math.max(...b.t) : null,
        tempMinC: b.t.length ? Math.min(...b.t) : null,
        tempMeanC: null,
        humidityMeanPct: null,
        humidityMaxPct: null,
        highHumidityHours: 0,
        rainfallMm: null,
        isForecast: date > today,
      };
      day.tempMeanC = avg(b.t);
      day.humidityMeanPct = avg(b.rh);
      day.humidityMaxPct = b.rh.length ? Math.max(...b.rh) : null;
      day.highHumidityHours = b.hi;
      byDate.set(date, day);
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ── Rich forecast for the app's Weather screen ──

export interface CurrentWeather {
  time: string;
  tempC: number | null;
  feelsLikeC: number | null;
  humidityPct: number | null;
  windKph: number | null;
  windDir: number | null;
  precipMm: number | null;
  cloudPct: number | null;
  isDay: boolean;
  code: number | null;
  condition: string;
}

export interface HourPoint {
  time: string; // ISO
  tempC: number | null;
  precipMm: number | null;
  precipProbPct: number | null;
  windKph: number | null;
  code: number | null;
  condition: string;
  isDay: boolean;
}

export interface DayPoint {
  date: string;
  tempMinC: number | null;
  tempMaxC: number | null;
  precipMm: number | null;
  precipProbPct: number | null;
  windMaxKph: number | null;
  uvMax: number | null;
  sunrise: string | null;
  sunset: string | null;
  code: number | null;
  condition: string;
}

export interface DetailedForecast {
  latitude: number;
  longitude: number;
  timezone: string;
  current: CurrentWeather;
  hourly: HourPoint[]; // next ~24h
  daily: DayPoint[]; // next 7d
}

const WMO: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Violent showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm',
};
export const conditionFor = (code: number | null | undefined): string =>
  code == null ? 'Unknown' : (WMO[code] ?? 'Unknown');

export async function fetchDetailedForecast(lat: number, lng: number): Promise<DetailedForecast> {
  const url = new URL(`${env.OPEN_METEO_BASE_URL}/forecast`);
  url.searchParams.set('latitude', lat.toFixed(3));
  url.searchParams.set('longitude', lng.toFixed(3));
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',
  );
  url.searchParams.set(
    'hourly',
    'temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,is_day',
  );
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset',
  );
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('wind_speed_unit', 'kmh');

  const j = await getJson<any>(url);
  const c = j.current ?? {};
  const nowIso = new Date().toISOString();

  const hourly: HourPoint[] = [];
  if (j.hourly?.time) {
    for (let i = 0; i < j.hourly.time.length && hourly.length < 24; i++) {
      const t = j.hourly.time[i] as string;
      if (t < nowIso.slice(0, 13)) continue; // skip past hours
      hourly.push({
        time: t,
        tempC: num(j.hourly.temperature_2m?.[i]),
        precipMm: num(j.hourly.precipitation?.[i]),
        precipProbPct: num(j.hourly.precipitation_probability?.[i]),
        windKph: num(j.hourly.wind_speed_10m?.[i]),
        code: num(j.hourly.weather_code?.[i]),
        condition: conditionFor(j.hourly.weather_code?.[i]),
        isDay: j.hourly.is_day?.[i] === 1,
      });
    }
  }

  const daily: DayPoint[] = [];
  if (j.daily?.time) {
    for (let i = 0; i < j.daily.time.length; i++) {
      daily.push({
        date: j.daily.time[i],
        tempMinC: num(j.daily.temperature_2m_min?.[i]),
        tempMaxC: num(j.daily.temperature_2m_max?.[i]),
        precipMm: num(j.daily.precipitation_sum?.[i]),
        precipProbPct: num(j.daily.precipitation_probability_max?.[i]),
        windMaxKph: num(j.daily.wind_speed_10m_max?.[i]),
        uvMax: num(j.daily.uv_index_max?.[i]),
        sunrise: j.daily.sunrise?.[i] ?? null,
        sunset: j.daily.sunset?.[i] ?? null,
        code: num(j.daily.weather_code?.[i]),
        condition: conditionFor(j.daily.weather_code?.[i]),
      });
    }
  }

  return {
    latitude: j.latitude ?? lat,
    longitude: j.longitude ?? lng,
    timezone: j.timezone ?? 'auto',
    current: {
      time: c.time ?? nowIso,
      tempC: num(c.temperature_2m),
      feelsLikeC: num(c.apparent_temperature),
      humidityPct: num(c.relative_humidity_2m),
      windKph: num(c.wind_speed_10m),
      windDir: num(c.wind_direction_10m),
      precipMm: num(c.precipitation),
      cloudPct: num(c.cloud_cover),
      isDay: c.is_day === 1,
      code: num(c.weather_code),
      condition: conditionFor(c.weather_code),
    },
    hourly,
    daily,
  };
}

async function getJson<T>(url: URL, attempt = 0): Promise<T> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (res.status === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      return getJson<T>(url, attempt + 1);
    }
    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body: body.slice(0, 300) }, 'open-meteo error');
      throw AppError.upstream(`Weather service failed (${res.status})`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.upstream('Weather service unreachable', { reason: (err as Error).message });
  }
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};
