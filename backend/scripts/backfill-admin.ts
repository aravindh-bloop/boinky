/**
 * One-shot backfill: resolve district / sub-district / village for every field
 * and scan that has a location but no resolved admin area yet (Module 3).
 * Safe to re-run — only touches unresolved rows. Rate-limited to be kind to the
 * reverse-geocode service; cache hits (same ~110 m cell) are instant.
 *
 *   npx tsx scripts/backfill-admin.ts
 */
import 'dotenv/config';
import { pool } from '../src/db/pool.js';
import { resolveAdmin } from '../src/integrations/geocode.js';
import { logger } from '../src/lib/logger.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const fields = await pool.query<{ id: string; lat: number; lng: number }>(
    `SELECT id, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM fields
      WHERE location IS NOT NULL AND admin_resolved_at IS NULL`,
  );
  logger.info({ n: fields.rowCount }, 'fields to resolve');
  for (const f of fields.rows) {
    const a = await resolveAdmin(f.lat, f.lng);
    await pool.query(
      `UPDATE fields SET district=$2, subdistrict=$3, village=$4, admin_resolved_at=now() WHERE id=$1`,
      [f.id, a.district, a.subdistrict, a.village],
    );
    logger.info({ fieldId: f.id, district: a.district });
    await sleep(300);
  }

  const scans = await pool.query<{ id: string; lat: number; lng: number }>(
    `SELECT id, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM scans
      WHERE location IS NOT NULL AND district IS NULL`,
  );
  logger.info({ n: scans.rowCount }, 'scans to resolve');
  for (const s of scans.rows) {
    const a = await resolveAdmin(s.lat, s.lng);
    await pool.query(`UPDATE scans SET district=$2 WHERE id=$1`, [s.id, a.district]);
    logger.info({ scanId: s.id, district: a.district });
    await sleep(300);
  }

  logger.info('backfill complete');
  await pool.end();
}

main().catch((e) => {
  logger.fatal({ err: e }, 'backfill failed');
  process.exit(1);
});
