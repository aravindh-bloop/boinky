/** One-off: wipe the demo farmer's runtime data so the demo starts clean for a new region. */
import 'dotenv/config';
import { pool } from '../src/db/pool.js';

async function main() {
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM users WHERE phone = '9990001111'`);
  const id = rows[0]?.id;
  if (!id) throw new Error('demo farmer not found');

  const scans = await pool.query(`DELETE FROM scans WHERE farmer_id = $1`, [id]);
  const wc = await pool.query(`DELETE FROM weather_cache`);
  const rs = await pool.query(
    `DELETE FROM risk_snapshots WHERE field_id IN (SELECT id FROM fields WHERE farmer_id = $1)`,
    [id],
  );
  const ai = await pool.query(`DELETE FROM ai_insights WHERE farmer_id = $1`, [id]);

  const fields = await pool.query(
    `SELECT name, crop, variety, ST_AsText(location) AS loc, (CURRENT_DATE - sown_date) AS age
       FROM fields WHERE farmer_id = $1 ORDER BY name`,
    [id],
  );
  const user = await pool.query(
    `SELECT name, region, preferred_language FROM users WHERE id = $1`,
    [id],
  );

  console.log('deleted:', {
    scans: scans.rowCount,
    weather_cache: wc.rowCount,
    risk_snapshots: rs.rowCount,
    ai_insights: ai.rowCount,
  });
  console.table(user.rows);
  console.table(fields.rows);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
