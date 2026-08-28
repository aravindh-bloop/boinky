import { query, queryMaybe, queryOne } from '../../db/query.js';
import { AppError } from '../../http/errors.js';
import { getUserById } from '../auth/auth.service.js';

export type AlertSeverity = 'low' | 'medium' | 'high';

export interface AlertRow {
  id: string;
  official_id: string;
  official_name?: string;
  region: string | null;
  crop: string | null;
  title: string;
  message: string;
  severity: AlertSeverity | null;
  center_lat: number | null;
  center_lng: number | null;
  radius_km: number | null;
  created_at: string;
  /** Only present in the farmer feed: why this alert reached them. */
  match_reason?: string;
}

const ALERT_SELECT = `
  a.id, a.official_id, a.region, a.crop, a.title, a.message, a.severity,
  ST_Y(a.center::geometry) AS center_lat,
  ST_X(a.center::geometry) AS center_lng,
  a.radius_km, a.created_at
`;

export interface CreateAlertInput {
  title: string;
  message: string;
  region?: string;
  crop?: string;
  severity?: AlertSeverity;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
}

export async function createAlert(officialId: string, input: CreateAlertInput): Promise<AlertRow> {
  const hasCenter = input.centerLat != null && input.centerLng != null;
  if (hasCenter && input.radiusKm == null) {
    throw AppError.badRequest('radiusKm is required when a center point is given');
  }
  if (!input.region && !input.crop && !hasCenter) {
    // A truly untargeted alert would hit every farmer — require an explicit opt-in.
    throw AppError.badRequest(
      'Provide at least one target: region, crop, or a center point + radiusKm',
    );
  }

  const row = await queryOne<AlertRow>(
    `WITH inserted AS (
       INSERT INTO alerts (official_id, region, crop, title, message, severity, center, radius_km)
       VALUES (
         $1, $2, $3, $4, $5, $6,
         CASE WHEN $7::float8 IS NULL OR $8::float8 IS NULL THEN NULL
              ELSE ST_SetSRID(ST_MakePoint($8, $7), 4326)::geography END,
         $9
       )
       RETURNING *
     )
     SELECT ${ALERT_SELECT} FROM inserted a`,
    [
      officialId,
      input.region ?? null,
      input.crop ? input.crop.toLowerCase() : null,
      input.title,
      input.message,
      input.severity ?? null,
      input.centerLat ?? null,
      input.centerLng ?? null,
      input.radiusKm ?? null,
    ],
  );
  return row;
}

export interface OfficialAlertFilter {
  officialId: string;
  officialRegion: string | null;
  scope: 'mine' | 'region';
  limit: number;
  offset: number;
}

export async function listOfficialAlerts(f: OfficialAlertFilter): Promise<AlertRow[]> {
  const params: unknown[] = [];
  let where: string;
  if (f.scope === 'region' && f.officialRegion) {
    params.push(f.officialRegion);
    where = `lower(a.region) = lower($1)`;
  } else {
    params.push(f.officialId);
    where = `a.official_id = $1`;
  }
  params.push(f.limit, f.offset);
  return query<AlertRow>(
    `SELECT ${ALERT_SELECT}, u.name AS official_name
       FROM alerts a JOIN users u ON u.id = a.official_id
      WHERE ${where}
      ORDER BY a.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
}

export interface FarmerAlertFilter {
  farmerId: string;
  since?: string; // ISO timestamp
  limit: number;
}

/**
 * Alerts relevant to a farmer: matching their profile region, OR any crop they grow,
 * OR geographically covering one of their fields. `match_reason` explains each hit.
 */
export async function listFarmerAlerts(f: FarmerAlertFilter): Promise<AlertRow[]> {
  const me = await getUserById(f.farmerId);

  const params: unknown[] = [f.farmerId, me.region ?? null, f.since ?? null, f.limit];
  return query<AlertRow>(
    `WITH my_crops AS (
       SELECT DISTINCT lower(crop) AS crop FROM fields WHERE farmer_id = $1
     )
     SELECT ${ALERT_SELECT}, u.name AS official_name,
       CASE
         WHEN $2::text IS NOT NULL AND a.region IS NOT NULL
              AND lower(a.region) = lower($2) THEN 'your area (' || a.region || ')'
         WHEN a.crop IS NOT NULL AND a.crop IN (SELECT crop FROM my_crops)
              THEN 'affects your ' || a.crop
         WHEN a.center IS NOT NULL AND a.radius_km IS NOT NULL
              THEN 'near one of your fields'
         ELSE 'regional advisory'
       END AS match_reason
     FROM alerts a
     JOIN users u ON u.id = a.official_id
     WHERE
       ($3::timestamptz IS NULL OR a.created_at > $3)
       AND (
         ($2::text IS NOT NULL AND a.region IS NOT NULL AND lower(a.region) = lower($2))
         OR (a.crop IS NOT NULL AND a.crop IN (SELECT crop FROM my_crops))
         OR (
           a.center IS NOT NULL AND a.radius_km IS NOT NULL AND EXISTS (
             SELECT 1 FROM fields ff
             WHERE ff.farmer_id = $1 AND ff.location IS NOT NULL
               AND ST_DWithin(ff.location, a.center, a.radius_km * 1000)
           )
         )
       )
     ORDER BY a.created_at DESC
     LIMIT $4`,
    params,
  );
}

export async function getAlert(id: string): Promise<AlertRow> {
  const row = await queryMaybe<AlertRow>(
    `SELECT ${ALERT_SELECT}, u.name AS official_name
       FROM alerts a JOIN users u ON u.id = a.official_id WHERE a.id = $1`,
    [id],
  );
  if (!row) throw AppError.notFound('Alert not found');
  return row;
}

export async function deleteAlert(id: string, officialId: string): Promise<void> {
  const res = await query(`DELETE FROM alerts WHERE id = $1 AND official_id = $2 RETURNING id`, [
    id,
    officialId,
  ]);
  if (res.length === 0) {
    throw AppError.notFound('Alert not found or not yours to delete');
  }
}
