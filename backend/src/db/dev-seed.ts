/**
 * Dev-only seed: a working farmer + official + a few fields so the app has a
 * usable login immediately after a fresh DB. Idempotent — safe to re-run; it
 * also updates the demo rows in place (region, language, crops, location).
 *
 * Login: farmer  ramesh.kumar@agrian.app / Agrian@2026  (phone 9990001111, same password, also works)
 *        official officer@agri.gov.in / secret123
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';
import { logger } from '../lib/logger.js';
import { resolveAdmin } from '../integrations/geocode.js';
import { regenerateFieldCalendar } from '../modules/calendar/calendar.service.js';
import { getFieldRisk } from '../modules/risk/risk.service.js';

async function upsertUser(u: {
  name: string;
  phone?: string;
  email?: string;
  role: 'farmer' | 'official';
  region: string;
  district: string;
  lang: string;
}) {
  const hash = await bcrypt.hash('secret123', 10);
  // Phone-based rows (farmer) and email-based rows (official) each have their own
  // unique index, so target the right one.
  const conflict = u.email ? 'email' : 'phone';
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (name, phone, email, password_hash, role, preferred_language, region, district)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (${conflict}) DO UPDATE SET
       name = EXCLUDED.name,
       region = EXCLUDED.region,
       district = EXCLUDED.district,
       preferred_language = EXCLUDED.preferred_language
     RETURNING id`,
    [u.name, u.phone ?? null, u.email ?? null, hash, u.role, u.lang, u.region, u.district],
  );
  return rows[0]!.id;
}

interface FieldSeed {
  name: string;
  crop: string;
  variety: string;
  daysSinceSown: number;
  lng: number;
  lat: number;
  acres: number;
}

// Chennai-region demo farm — 2 realistic fields, the two crops actually grown
// on the smallholder tracts around Chennai/Tiruvallur (paddy + groundnut).
// Sowing dates chosen so each crop sits inside its peak-vulnerability window.
const FIELDS: FieldSeed[] = [
  { name: 'North Plot', crop: 'rice', variety: 'ADT-43', daysSinceSown: 55, lng: 80.2707, lat: 13.0827, acres: 2 },
  { name: 'Back Acre', crop: 'groundnut', variety: 'TMV-7', daysSinceSown: 45, lng: 80.22, lat: 13.05, acres: 1 },
];

async function upsertField(farmerId: string, f: FieldSeed) {
  const admin = await resolveAdmin(f.lat, f.lng).catch(() => null);
  const { rowCount } = await pool.query(
    `UPDATE fields SET
       crop = $3, variety = $4, sown_date = CURRENT_DATE - $5::int,
       location = ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
       area_acres = $8, location_accuracy_m = 12,
       district = $9, subdistrict = $10, village = $11, admin_resolved_at = now()
     WHERE farmer_id = $1 AND name = $2`,
    [farmerId, f.name, f.crop, f.variety, f.daysSinceSown, f.lng, f.lat, f.acres,
     admin?.district ?? null, admin?.subdistrict ?? null, admin?.village ?? null],
  );
  if (rowCount === 0) {
    await pool.query(
      `INSERT INTO fields (farmer_id, name, crop, variety, sown_date, location, area_acres,
                           location_accuracy_m, district, subdistrict, village, admin_resolved_at)
       VALUES ($1, $2, $3, $4, CURRENT_DATE - $5::int,
               ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, $8, 12, $9, $10, $11, now())`,
      [farmerId, f.name, f.crop, f.variety, f.daysSinceSown, f.lng, f.lat, f.acres,
       admin?.district ?? null, admin?.subdistrict ?? null, admin?.village ?? null],
    );
  }
}

/**
 * The demo farmer's login is shown to judges, so it needs a real-looking
 * email and a presentable password rather than a bare digit string and
 * "secret123". Set directly by id — not through `upsertUser`'s ON CONFLICT,
 * which is keyed on phone OR email and would misfire once both are set.
 *
 * Also clears `onboarded_at` so the voice-guided first-run tutorial plays
 * again on next login — it's a feature worth a judge actually seeing, not
 * something a stale "already onboarded" flag should hide.
 */
async function setDemoCredentials(farmerId: string) {
  const hash = await bcrypt.hash('Agrian@2026', 10);
  await pool.query(
    `UPDATE users SET email = $1, password_hash = $2, onboarded_at = NULL WHERE id = $3`,
    ['ramesh.kumar@agrian.app', hash, farmerId],
  );
}

async function main() {
  const farmerId = await upsertUser({
    name: 'Ramesh Kumar',
    phone: '9990001111',
    role: 'farmer',
    region: 'Chennai',
    district: 'Chennai',
    lang: 'en',
  });
  await setDemoCredentials(farmerId);
  await upsertUser({
    name: 'Officer R',
    email: 'officer@agri.gov.in',
    role: 'official',
    region: 'Chennai',
    district: 'Chennai',
    lang: 'en',
  });

  for (const f of FIELDS) await upsertField(farmerId, f);

  // Drop any field this farmer has that isn't in the current list (e.g. an
  // old demo field from a previous seed run) — cascades its scans/activities/
  // calendar/risk rows.
  const keepNames = FIELDS.map((f) => f.name);
  await pool.query(`DELETE FROM fields WHERE farmer_id = $1 AND name <> ALL($2::text[])`, [
    farmerId,
    keepNames,
  ]);

  // Location-dependent caches from a previous region must not linger.
  await pool.query(
    `DELETE FROM risk_snapshots WHERE field_id IN (SELECT id FROM fields WHERE farmer_id = $1)`,
    [farmerId],
  );
  await pool.query(`DELETE FROM ai_insights WHERE farmer_id = $1`, [farmerId]);

  // Real calendar + risk for the two kept fields (computed, not fabricated).
  const { rows: kept } = await pool.query<{ id: string }>(`SELECT id FROM fields WHERE farmer_id = $1`, [
    farmerId,
  ]);
  for (const { id: fieldId } of kept) {
    try {
      await regenerateFieldCalendar(fieldId, farmerId);
    } catch (e) {
      logger.warn({ e, fieldId }, 'calendar regen failed');
    }
    try {
      await getFieldRisk(fieldId, farmerId, { refresh: true });
    } catch (e) {
      logger.warn({ e, fieldId }, 'risk compute failed');
    }
  }

  logger.info(
    { farmerId, fields: FIELDS.length },
    'dev seed complete — login farmer ramesh.kumar@agrian.app / Agrian@2026',
  );
  await pool.end();
}

main().catch((e) => {
  logger.fatal({ err: e }, 'dev seed failed');
  process.exit(1);
});
