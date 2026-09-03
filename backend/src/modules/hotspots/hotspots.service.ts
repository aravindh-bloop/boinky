import { query, queryOne } from '../../db/query.js';
import { AppError } from '../../http/errors.js';

const CONFIRMED_STATUSES = ['auto_confirmed', 'validated', 'corrected'];

export interface HotspotPoint {
  id: string;
  lat: number;
  lng: number;
  diagnosis_label: string | null;
  diagnosis_category: string | null;
  severity: string | null;
  status: string;
  crop: string | null;
  created_at: string;
}

export interface HotspotSummaryRow {
  diagnosis_label: string | null;
  diagnosis_category: string | null;
  count: number;
  high_count: number;
  last_seen: string;
}

export interface HotspotQuery {
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  center?: { lat: number; lng: number; radiusKm: number };
  days: number;
  crop?: string;
  district?: string;
  severity?: 'low' | 'medium' | 'high';
  category?: string;
  includePending?: boolean;
  limit: number;
}

function buildFilters(q: HotspotQuery) {
  const where: string[] = [
    's.location IS NOT NULL',
    's.created_at > now() - make_interval(days => $1::int)',
  ];
  const params: unknown[] = [q.days];

  if (q.includePending) {
    where.push(`s.status <> 'rejected'`);
  } else {
    params.push(CONFIRMED_STATUSES);
    where.push(`s.status = ANY($${params.length})`);
  }

  if (q.bbox) {
    params.push(q.bbox[0], q.bbox[1], q.bbox[2], q.bbox[3]);
    const n = params.length;
    where.push(
      `ST_Intersects(s.location::geometry,
        ST_MakeEnvelope($${n - 3}, $${n - 2}, $${n - 1}, $${n}, 4326))`,
    );
  } else if (q.center) {
    params.push(q.center.lng, q.center.lat, q.center.radiusKm * 1000);
    const n = params.length;
    where.push(
      `ST_DWithin(s.location, ST_SetSRID(ST_MakePoint($${n - 2}, $${n - 1}), 4326)::geography, $${n})`,
    );
  }

  if (q.crop) {
    params.push(q.crop.toLowerCase());
    where.push(`lower(f.crop) = $${params.length}`);
  }
  if (q.district) {
    params.push(q.district);
    where.push(`s.district = $${params.length}`);
  }
  if (q.severity) {
    params.push(q.severity);
    where.push(`s.severity = $${params.length}`);
  }
  if (q.category) {
    params.push(q.category);
    where.push(`s.diagnosis_category = $${params.length}`);
  }

  return { where: where.join(' AND '), params };
}

export async function getHotspotPoints(q: HotspotQuery): Promise<HotspotPoint[]> {
  if (!q.bbox && !q.center) {
    throw AppError.badRequest('Provide either bbox or center+radiusKm');
  }
  const { where, params } = buildFilters(q);
  params.push(q.limit);
  return query<HotspotPoint>(
    `SELECT s.id,
            ST_Y(s.location::geometry) AS lat,
            ST_X(s.location::geometry) AS lng,
            s.diagnosis_label, s.diagnosis_category, s.severity, s.status,
            lower(f.crop) AS crop, s.created_at
       FROM scans s
       LEFT JOIN fields f ON f.id = s.field_id
      WHERE ${where}
      ORDER BY s.created_at DESC
      LIMIT $${params.length}`,
    params,
  );
}

export async function getHotspotSummary(q: HotspotQuery): Promise<HotspotSummaryRow[]> {
  if (!q.bbox && !q.center) {
    throw AppError.badRequest('Provide either bbox or center+radiusKm');
  }
  const { where, params } = buildFilters(q);
  return query<HotspotSummaryRow>(
    `SELECT s.diagnosis_label, s.diagnosis_category,
            count(*)::int AS count,
            count(*) FILTER (WHERE s.severity = 'high')::int AS high_count,
            max(s.created_at) AS last_seen
       FROM scans s
       LEFT JOIN fields f ON f.id = s.field_id
      WHERE ${where}
      GROUP BY s.diagnosis_label, s.diagnosis_category
      ORDER BY count DESC`,
    params,
  );
}

export interface NearbyOutbreaks {
  radiusKm: number;
  days: number;
  count: number;
  nearestKm: number | null;
  topDiagnoses: { label: string | null; count: number }[];
}

/**
 * "Nearby outbreak" banner for a farmer: confirmed medium/high-severity scans by
 * OTHER farmers within `radiusKm` of any of this farmer's fields, in the last `days`.
 */
export async function getNearbyOutbreaksForFarmer(
  farmerId: string,
  opts: { radiusKm?: number; days?: number } = {},
): Promise<NearbyOutbreaks> {
  const radiusKm = opts.radiusKm ?? 10;
  const days = opts.days ?? 21;

  const agg = await queryOne<{ count: number; nearest_m: number | null }>(
    `WITH my_fields AS (
       SELECT location FROM fields WHERE farmer_id = $1 AND location IS NOT NULL
     ),
     hits AS (
       SELECT s.id,
              min(ST_Distance(s.location, mf.location)) AS dist_m
         FROM scans s CROSS JOIN my_fields mf
        WHERE s.farmer_id <> $1
          AND s.location IS NOT NULL
          AND s.severity IN ('medium', 'high')
          AND s.status = ANY($4)
          AND s.created_at > now() - make_interval(days => $3::int)
          AND ST_DWithin(s.location, mf.location, $2)
        GROUP BY s.id
     )
     SELECT count(*)::int AS count, min(dist_m) AS nearest_m FROM hits`,
    [farmerId, radiusKm * 1000, days, CONFIRMED_STATUSES],
  );

  const top = await query<{ label: string | null; count: number }>(
    `WITH my_fields AS (
       SELECT location FROM fields WHERE farmer_id = $1 AND location IS NOT NULL
     )
     SELECT s.diagnosis_label AS label, count(DISTINCT s.id)::int AS count
       FROM scans s CROSS JOIN my_fields mf
      WHERE s.farmer_id <> $1
        AND s.location IS NOT NULL
        AND s.severity IN ('medium', 'high')
        AND s.status = ANY($4)
        AND s.created_at > now() - make_interval(days => $3::int)
        AND ST_DWithin(s.location, mf.location, $2)
      GROUP BY s.diagnosis_label
      ORDER BY count DESC
      LIMIT 3`,
    [farmerId, radiusKm * 1000, days, CONFIRMED_STATUSES],
  );

  return {
    radiusKm,
    days,
    count: agg.count,
    nearestKm: agg.nearest_m == null ? null : Math.round((agg.nearest_m / 1000) * 10) / 10,
    topDiagnoses: top,
  };
}
