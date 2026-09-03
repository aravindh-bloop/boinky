import { query } from '../db/query.js';
import { resolveAdmin } from '../integrations/geocode.js';
import { logger } from './logger.js';

/**
 * Resolve a coordinate to its administrative area and store it on the row.
 * Fire-and-forget from the create/update path — a field or scan is usable
 * before its district is known, and the resolver caches aggressively.
 */

export async function resolveFieldAdmin(
  fieldId: string,
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<void> {
  if (lat == null || lng == null) return;
  try {
    const a = await resolveAdmin(lat, lng);
    await query(
      `UPDATE fields
          SET district = $2, subdistrict = $3, village = $4, admin_resolved_at = now()
        WHERE id = $1`,
      [fieldId, a.district, a.subdistrict, a.village],
    );
    logger.debug({ fieldId, district: a.district }, 'field admin resolved');
  } catch (err) {
    logger.warn({ err, fieldId }, 'field admin resolve failed (non-fatal)');
  }
}

export async function resolveScanAdmin(
  scanId: string,
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<void> {
  if (lat == null || lng == null) return;
  try {
    const a = await resolveAdmin(lat, lng);
    await query(`UPDATE scans SET district = $2 WHERE id = $1`, [scanId, a.district]);
    logger.debug({ scanId, district: a.district }, 'scan admin resolved');
  } catch (err) {
    logger.warn({ err, scanId }, 'scan admin resolve failed (non-fatal)');
  }
}
