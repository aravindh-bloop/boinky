/**
 * Idempotent reference-data seed. Safe to run repeatedly (upserts).
 * Usage: npm run seed
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { pool } from './pool.js';
import { logger } from '../lib/logger.js';
import { SCHEMES } from './seed-data/schemes.js';

const here = dirname(fileURLToPath(import.meta.url));
const seedsDir = resolve(here, '../../seeds');

interface PesticideCsvRow {
  pesticide_name: string;
  active_ingredient: string;
  crop: string;
  target_pest_or_disease: string;
  pre_harvest_interval_days: string;
  safe_dosage: string;
  precautions: string;
}

async function seedPesticides() {
  const csv = readFileSync(resolve(seedsDir, 'pesticide_reference.csv'), 'utf8');
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as PesticideCsvRow[];

  let upserts = 0;
  for (const r of rows) {
    const crop = r.crop?.trim() || null;
    const phi = r.pre_harvest_interval_days === '' ? null : Number(r.pre_harvest_interval_days);
    await pool.query(
      `INSERT INTO pesticide_reference
         (pesticide_name, active_ingredient, crop, target_pest_or_disease,
          pre_harvest_interval_days, safe_dosage, precautions, source, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'curated', now())
       ON CONFLICT (lower(pesticide_name), lower(coalesce(crop, '*')))
       DO UPDATE SET
         active_ingredient = EXCLUDED.active_ingredient,
         target_pest_or_disease = EXCLUDED.target_pest_or_disease,
         pre_harvest_interval_days = EXCLUDED.pre_harvest_interval_days,
         safe_dosage = EXCLUDED.safe_dosage,
         precautions = EXCLUDED.precautions,
         source = 'curated',
         updated_at = now()`,
      [
        r.pesticide_name.trim(),
        r.active_ingredient?.trim() || null,
        crop,
        r.target_pest_or_disease?.trim() || null,
        Number.isFinite(phi) ? phi : null,
        r.safe_dosage?.trim() || null,
        r.precautions?.trim() || null,
      ],
    );
    upserts++;
  }
  logger.info({ upserts, file: 'pesticide_reference.csv' }, 'seeded pesticide_reference');
}

async function seedSchemes() {
  let upserts = 0;
  for (const s of SCHEMES) {
    await pool.query(
      `INSERT INTO schemes (title, description, eligibility_criteria, benefit_amount, apply_link)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (title) DO UPDATE SET
         description = EXCLUDED.description,
         eligibility_criteria = EXCLUDED.eligibility_criteria,
         benefit_amount = EXCLUDED.benefit_amount,
         apply_link = EXCLUDED.apply_link`,
      [s.title, s.description, JSON.stringify(s.eligibility_criteria), s.benefit_amount, s.apply_link],
    );
    upserts++;
  }
  logger.info({ upserts }, 'seeded schemes');
}

async function main() {
  await seedPesticides();
  await seedSchemes();
  await pool.end();
  logger.info('seed complete');
}

main().catch((err) => {
  logger.fatal({ err }, 'seed failed');
  process.exit(1);
});
