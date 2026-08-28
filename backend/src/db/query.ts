import type { PoolClient, QueryResultRow } from 'pg';
import { pool } from './pool.js';

/** Run a parameterized query against the pool. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(text, params as any[]);
  return res.rows;
}

/** Run a query expected to return exactly one row (or throw). */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T> {
  const rows = await query<T>(text, params);
  if (rows.length === 0) throw new Error('Expected exactly one row, got none');
  return rows[0] as T;
}

/** Run a query returning the first row or null. */
export async function queryMaybe<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return (rows[0] as T) ?? null;
}

/** Execute a function inside a transaction; commits on success, rolls back on throw. */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
