import { query, queryMaybe, queryOne } from '../../db/query.js';
import { AppError } from '../../http/errors.js';
import { fetchWeatherWindow, type WeatherDay } from '../../integrations/weather.js';
import { getOwnedField } from '../fields/fields.service.js';
import { computeRisk, type RiskLevel } from './risk.model.js';

export interface RiskSnapshot {
  id: string;
  field_id: string;
  date: string;
  temperature: number | null;
  humidity: number | null;
  rainfall_mm: number | null;
  risk_level: RiskLevel | null;
  risk_score: number | null;
  risk_reason: string | null;
  created_at: string;
}

export interface OutlookDay {
  date: string;
  isForecast: boolean;
  score: number;
  level: RiskLevel;
  reason: string;
  tempMeanC: number | null;
  humidityMeanPct: number | null;
  rainfallMm: number | null;
}

export interface FieldRiskResponse {
  fieldId: string;
  crop: string;
  today: RiskSnapshot;
  outlook: OutlookDay[];
  computedAt: string;
}

const NEARBY_RADIUS_M = 10_000;

async function countNearbyOutbreaks(lat: number, lng: number): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM scans
      WHERE location IS NOT NULL
        AND severity = 'high'
        AND status IN ('validated', 'corrected', 'auto_confirmed')
        AND created_at > now() - interval '21 days'
        AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)`,
    [lat, lng, NEARBY_RADIUS_M],
  );
  return row.n;
}

function toSnapshotShape(
  fieldId: string,
  day: WeatherDay,
  r: { score: number; level: RiskLevel; reason: string },
): Omit<RiskSnapshot, 'id' | 'created_at'> {
  return {
    field_id: fieldId,
    date: day.date,
    temperature: day.tempMeanC,
    humidity: day.humidityMeanPct,
    rainfall_mm: day.rainfallMm,
    risk_level: r.level,
    risk_score: r.score,
    risk_reason: r.reason,
  };
}

export async function getFieldRisk(
  fieldId: string,
  farmerId: string,
  opts: { refresh?: boolean } = {},
): Promise<FieldRiskResponse> {
  const field = await getOwnedField(fieldId, farmerId);
  if (field.lat == null || field.lng == null) {
    throw AppError.badRequest('This field has no location set — add a location to get risk alerts');
  }

  const today = new Date().toISOString().slice(0, 10);

  if (!opts.refresh) {
    const existing = await queryMaybe<RiskSnapshot>(
      `SELECT id, field_id, to_char(date,'YYYY-MM-DD') AS date, temperature, humidity,
              rainfall_mm, risk_level, risk_score, risk_reason, created_at
         FROM risk_snapshots WHERE field_id = $1 AND date = $2`,
      [fieldId, today],
    );
    if (existing) {
      // Cheap path: today's snapshot is cached. Still compute a fresh outlook.
      const outlook = await buildOutlook(field.lat, field.lng, field.crop, field.days_since_sown);
      return {
        fieldId,
        crop: field.crop,
        today: existing,
        outlook,
        computedAt: existing.created_at,
      };
    }
  }

  const [window, nearby] = await Promise.all([
    fetchWeatherWindow(field.lat, field.lng, { pastDays: 3, forecastDays: 3 }),
    countNearbyOutbreaks(field.lat, field.lng),
  ]);

  const todayWeather = window.find((d) => d.date === today) ?? window.at(-1);
  if (!todayWeather) throw AppError.upstream('Weather service returned no usable data');

  const todayRisk = computeRisk({
    weather: todayWeather,
    crop: field.crop,
    daysSinceSown: field.days_since_sown,
    nearbyOutbreaks: nearby,
  });
  const shape = toSnapshotShape(fieldId, todayWeather, todayRisk);

  const saved = await queryOne<RiskSnapshot>(
    `INSERT INTO risk_snapshots
       (field_id, date, temperature, humidity, rainfall_mm, risk_level, risk_score, risk_reason, raw_weather)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (field_id, date) DO UPDATE SET
       temperature = EXCLUDED.temperature, humidity = EXCLUDED.humidity,
       rainfall_mm = EXCLUDED.rainfall_mm, risk_level = EXCLUDED.risk_level,
       risk_score = EXCLUDED.risk_score, risk_reason = EXCLUDED.risk_reason,
       raw_weather = EXCLUDED.raw_weather, created_at = now()
     RETURNING id, field_id, to_char(date,'YYYY-MM-DD') AS date, temperature, humidity,
               rainfall_mm, risk_level, risk_score, risk_reason, created_at`,
    [
      fieldId,
      shape.date,
      shape.temperature,
      shape.humidity,
      shape.rainfall_mm,
      shape.risk_level,
      shape.risk_score,
      shape.risk_reason,
      JSON.stringify(todayWeather),
    ],
  );

  const outlook = buildOutlookFrom(window, field.crop, field.days_since_sown, nearby);

  return { fieldId, crop: field.crop, today: saved, outlook, computedAt: saved.created_at };
}

function buildOutlookFrom(
  window: WeatherDay[],
  crop: string,
  daysSinceSown: number | null,
  nearby: number,
): OutlookDay[] {
  const today = new Date().toISOString().slice(0, 10);
  return window
    .filter((d) => d.date >= today)
    .map((d) => {
      const offset = daysSinceSown == null ? null : daysSinceSown + daysBetween(today, d.date);
      const r = computeRisk({
        weather: d,
        crop,
        daysSinceSown: offset,
        nearbyOutbreaks: nearby,
      });
      return {
        date: d.date,
        isForecast: d.isForecast,
        score: r.score,
        level: r.level,
        reason: r.reason,
        tempMeanC: d.tempMeanC,
        humidityMeanPct: d.humidityMeanPct,
        rainfallMm: d.rainfallMm,
      };
    });
}

async function buildOutlook(
  lat: number,
  lng: number,
  crop: string,
  daysSinceSown: number | null,
): Promise<OutlookDay[]> {
  const [window, nearby] = await Promise.all([
    fetchWeatherWindow(lat, lng, { pastDays: 0, forecastDays: 3 }),
    countNearbyOutbreaks(lat, lng),
  ]);
  return buildOutlookFrom(window, crop, daysSinceSown, nearby);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** Latest snapshot for a field regardless of date — used by the scan risk score. */
export async function latestSnapshot(fieldId: string): Promise<RiskSnapshot | null> {
  return queryMaybe<RiskSnapshot>(
    `SELECT id, field_id, to_char(date,'YYYY-MM-DD') AS date, temperature, humidity,
            rainfall_mm, risk_level, risk_score, risk_reason, created_at
       FROM risk_snapshots WHERE field_id = $1 ORDER BY date DESC LIMIT 1`,
    [fieldId],
  );
}

/** Recent risk-snapshot history for a field (most recent first). */
export async function riskHistory(
  fieldId: string,
  farmerId: string,
  days: number,
): Promise<RiskSnapshot[]> {
  await getOwnedField(fieldId, farmerId);
  return query<RiskSnapshot>(
    `SELECT id, field_id, to_char(date,'YYYY-MM-DD') AS date, temperature, humidity,
            rainfall_mm, risk_level, risk_score, risk_reason, created_at
       FROM risk_snapshots
      WHERE field_id = $1 AND date > current_date - $2::int
      ORDER BY date DESC`,
    [fieldId, days],
  );
}
