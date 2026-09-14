import { AppError } from '../../http/errors.js';
import { queryOne } from '../../db/query.js';
import * as hotspots from '../hotspots/hotspots.service.js';
import { fetchWeatherWindow, type WeatherDay } from '../../integrations/weather.js';
import { cropProfile } from '../risk/crop-profiles.js';

export interface ProjectionQuery {
  bbox?: [number, number, number, number];
  center?: { lat: number; lng: number; radiusKm: number };
  days: number;
  crop?: string;
  district?: string;
  severity?: 'low' | 'medium' | 'high';
  category?: string;
  horizonDays: number;
}

export interface ProjectionContext {
  centroid: { lat: number; lng: number };
  crop: string | null;
  cropDurationDays: number;
  peakVulnerability: { fromDay: number; toDay: number };
  mainThreats: string[];
  history: hotspots.HotspotHistoryBucket[];
  /** Total confirmed cases across the whole `days` window — the real, observed starting point. */
  s0: number;
  population: { fieldsInArea: number; farmersInArea: number; areaAcresTotal: number };
  carryingCapacity: number;
  medianDaysSinceSown: number | null;
  /** Confirmed high-severity cases in the most recent ~3 weeks — feeds computeRisk's nearbyOutbreaks input. */
  recentHighSeverity: number;
  topDiagnosis: string | null;
  /** 7-day forecast at the centroid — computeRisk-compatible shape, same integration risk.service.ts uses. */
  forecast: WeatherDay[];
}

function areaFilter(q: ProjectionQuery, alias: string, params: unknown[]): string[] {
  const where: string[] = [];
  if (q.bbox) {
    params.push(q.bbox[0], q.bbox[1], q.bbox[2], q.bbox[3]);
    const n = params.length;
    where.push(
      `ST_Intersects(${alias}.location::geometry, ST_MakeEnvelope($${n - 3}, $${n - 2}, $${n - 1}, $${n}, 4326))`,
    );
  } else if (q.center) {
    params.push(q.center.lng, q.center.lat, q.center.radiusKm * 1000);
    const n = params.length;
    where.push(
      `ST_DWithin(${alias}.location, ST_SetSRID(ST_MakePoint($${n - 2}, $${n - 1}), 4326)::geography, $${n})`,
    );
  }
  return where;
}

function modal<T extends { crop?: string | null; diagnosis_label?: string | null }>(
  points: T[],
  pick: (p: T) => string | null | undefined,
): string | null {
  const counts = new Map<string, number>();
  for (const p of points) {
    const v = pick(p);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

/**
 * Assembles everything the projection model needs from real data — mirrors
 * insights/context.ts's pattern: one builder, Promise.all where independent,
 * every field traceable to an actual row. No fabricated fallback values.
 */
export async function buildProjectionContext(q: ProjectionQuery): Promise<ProjectionContext> {
  if (!q.bbox && !q.center) throw AppError.badRequest('Provide bbox or center+radiusKm');

  const hq: hotspots.HotspotQuery = {
    bbox: q.bbox,
    center: q.center,
    days: q.days,
    crop: q.crop,
    district: q.district,
    severity: q.severity,
    category: q.category,
    includePending: false,
    limit: 2000,
  };

  const [points, history] = await Promise.all([
    hotspots.getHotspotPoints(hq),
    hotspots.getHotspotHistory(hq, 'week'),
  ]);

  if (points.length === 0) {
    throw AppError.badRequest('No confirmed scans in this area/window to project an outbreak from');
  }

  const centroid = {
    lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
  };

  const crop = q.crop ?? modal(points, (p) => p.crop);
  const profile = cropProfile(crop);

  const popParams: unknown[] = [];
  const popWhere = ['f.location IS NOT NULL', ...areaFilter(q, 'f', popParams)];
  if (crop) {
    popParams.push(crop.toLowerCase());
    popWhere.push(`lower(f.crop) = $${popParams.length}`);
  }
  const pop = await queryOne<{
    fields_in_area: number;
    farmers_in_area: number;
    area_acres_total: number | null;
    median_days_since_sown: number | null;
  }>(
    `SELECT count(*)::int AS fields_in_area,
            count(DISTINCT farmer_id)::int AS farmers_in_area,
            coalesce(sum(area_acres), 0)::float AS area_acres_total,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY (CURRENT_DATE - sown_date))
              FILTER (WHERE sown_date IS NOT NULL) AS median_days_since_sown
       FROM fields f WHERE ${popWhere.join(' AND ')}`,
    popParams,
  );

  const s0 = history.reduce((s, h) => s + h.count, 0);
  const recentHighSeverity = history.slice(-3).reduce((s, h) => s + h.highCount, 0);
  const carryingCapacity = Math.max(pop.fields_in_area, s0 + 1);

  const forecast = await fetchWeatherWindow(centroid.lat, centroid.lng, { pastDays: 0, forecastDays: 7 });

  return {
    centroid,
    crop,
    cropDurationDays: profile.durationDays,
    peakVulnerability: profile.peakVulnerability,
    mainThreats: profile.mainThreats,
    history,
    s0,
    population: {
      fieldsInArea: pop.fields_in_area,
      farmersInArea: pop.farmers_in_area,
      areaAcresTotal: pop.area_acres_total ?? 0,
    },
    carryingCapacity,
    medianDaysSinceSown:
      pop.median_days_since_sown != null ? Math.round(pop.median_days_since_sown) : null,
    recentHighSeverity,
    topDiagnosis: modal(points, (p) => p.diagnosis_label),
    forecast,
  };
}
