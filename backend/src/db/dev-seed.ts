/**
 * Dev-only seed: a working farmer + official + a couple of fields so the app has a
 * usable login immediately after a fresh DB. Idempotent. Run: npm run seed:dev
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
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (name, phone, email, password_hash, role, preferred_language, region)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, region = EXCLUDED.region
     RETURNING id`,
    [u.name, u.phone ?? null, u.email ?? null, hash, u.role, u.lang, u.region],
  );
  if (rows[0]) return rows[0].id;
  const { rows: byEmail } = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 OR phone = $2`,
    [u.email ?? null, u.phone ?? null],
  );
  return byEmail[0]!.id;
}

async function main() {
  const farmerId = await upsertUser({
    name: 'Test Farmer',
    phone: '9990001111',
    role: 'farmer',
    region: 'Pune',
    lang: 'mr',
  });
  await upsertUser({
    name: 'Officer R',
    email: 'officer@agri.gov.in',
    role: 'official',
    region: 'Pune',
    lang: 'en',
  });

  const { rows: existing } = await pool.query(`SELECT count(*)::int n FROM fields WHERE farmer_id = $1`, [
    farmerId,
  ]);
  if (existing[0].n === 0) {
    await pool.query(
      `INSERT INTO fields (farmer_id, name, crop, variety, sown_date, location, area_acres) VALUES
        ($1, 'North Plot', 'cotton', 'Bt-II', CURRENT_DATE - 74,
         ST_SetSRID(ST_MakePoint(73.8567, 18.5204), 4326)::geography, 3),
        ($1, 'River Field', 'tomato', 'Arka Rakshak', CURRENT_DATE - 40,
         ST_SetSRID(ST_MakePoint(73.87, 18.53), 4326)::geography, 1.5),
        ($1, 'Back Acre', 'soybean', 'JS-335', CURRENT_DATE - 55,
         ST_SetSRID(ST_MakePoint(73.84, 18.51), 4326)::geography, 2)`,
      [farmerId],
    );
    logger.info('created 3 demo fields');
  }

  logger.info({ farmerId }, 'dev seed complete — login farmer 9990001111 / secret123');
  await pool.end();
}

main().catch((e) => {
  logger.fatal({ err: e }, 'dev seed failed');
  process.exit(1);
});
