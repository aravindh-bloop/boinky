import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const { Pool, types } = pg;

// Return NUMERIC as JS number rather than string. Our numeric columns
// (confidence, risk_score, area_acres, lat/lng) are all within safe-integer /
// float precision for this app's purposes.
types.setTypeParser(1700, (v) => (v === null ? null : Number.parseFloat(v)));
// BIGINT -> number (row counts etc. never exceed 2^53 here)
types.setTypeParser(20, (v) => (v === null ? null : Number.parseInt(v, 10)));

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'unexpected error on idle postgres client');
});

export async function assertDbConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ now: Date; postgis: string | null }>(
      `select now() as now,
              (select extversion from pg_extension where extname = 'postgis') as postgis`,
    );
    logger.info(
      { serverTime: rows[0]?.now, postgis: rows[0]?.postgis ?? 'not installed' },
      'postgres connection ok',
    );
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
