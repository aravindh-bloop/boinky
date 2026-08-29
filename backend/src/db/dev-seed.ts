/**
 * Dev-only seed: a working farmer + official + a few fields so the app has a
 * usable login immediately after a fresh DB. Idempotent — safe to re-run; it
 * also updates the demo rows in place (region, language, crops, location).
 *
 * Login: farmer  9990001111 / secret123
 *        official officer@agri.gov.in / secret123
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';
import { logger } from '../lib/logger.js';

async function upsertUser(u: {
  name: string;
  phone?: string;
  email?: string;
  role: 'farmer' | 'official';
  region: string;
  lang: string;
}) {
  const hash = await bcrypt.hash('secret123', 10);
  // Phone-based rows (farmer) and email-based rows (official) each have their own
  // unique index, so target the right one.
  const conflict = u.email ? 'email' : 'phone';
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (name, phone, email, password_hash, role, preferred_language, region)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (${conflict}) DO UPDATE SET
       name = EXCLUDED.name,
       region = EXCLUDED.region,
       preferred_language = EXCLUDED.preferred_language
     RETURNING id`,
    [u.name, u.phone ?? null, u.email ?? null, hash, u.role, u.lang, u.region],
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

// Chennai-region demo farm. Coordinates around Chennai (13.08 N, 80.27 E);
// sowing dates chosen so each crop sits inside its peak-vulnerability window.
const FIELDS: FieldSeed[] = [
  { name: 'North Plot', crop: 'rice', variety: 'ADT-43', daysSinceSown: 55, lng: 80.2707, lat: 13.0827, acres: 2 },
  { name: 'River Field', crop: 'sugarcane', variety: 'Co-86032', daysSinceSown: 120, lng: 80.25, lat: 13.1, acres: 1.5 },
  { name: 'Back Acre', crop: 'groundnut', variety: 'TMV-7', daysSinceSown: 45, lng: 80.22, lat: 13.05, acres: 1 },
];

async function upsertField(farmerId: string, f: FieldSeed) {
  const { rowCount } = await pool.query(
    `UPDATE fields SET
       crop = $3, variety = $4, sown_date = CURRENT_DATE - $5::int,
       location = ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
       area_acres = $8
     WHERE farmer_id = $1 AND name = $2`,
    [farmerId, f.name, f.crop, f.variety, f.daysSinceSown, f.lng, f.lat, f.acres],
  );
  if (rowCount === 0) {
    await pool.query(
      `INSERT INTO fields (farmer_id, name, crop, variety, sown_date, location, area_acres)
       VALUES ($1, $2, $3, $4, CURRENT_DATE - $5::int,
               ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, $8)`,
      [farmerId, f.name, f.crop, f.variety, f.daysSinceSown, f.lng, f.lat, f.acres],
    );
  }
}

async function main() {
  const farmerId = await upsertUser({
    name: 'Test Farmer',
    phone: '9990001111',
    role: 'farmer',
    region: 'Chennai',
    lang: 'en',
  });
  await upsertUser({
    name: 'Officer R',
    email: 'officer@agri.gov.in',
    role: 'official',
    region: 'Chennai',
    lang: 'en',
  });

  for (const f of FIELDS) await upsertField(farmerId, f);

  // Location-dependent caches from a previous region must not linger.
  await pool.query(
    `DELETE FROM risk_snapshots WHERE field_id IN (SELECT id FROM fields WHERE farmer_id = $1)`,
    [farmerId],
  );
  await pool.query(`DELETE FROM ai_insights WHERE farmer_id = $1`, [farmerId]);

  logger.info({ farmerId, fields: FIELDS.length }, 'dev seed complete — login farmer 9990001111 / secret123');
  await pool.end();
}

main().catch((e) => {
  logger.fatal({ err: e }, 'dev seed failed');
  process.exit(1);
});
