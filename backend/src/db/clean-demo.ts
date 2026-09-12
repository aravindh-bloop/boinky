/**
 * Strips every fabricated demo row (scans, activities, insights, alerts, pod
 * readings, scheme applications/threads, insurance policies/claims/
 * escalations, the seeded "neighbour" farmer) so the app is clean ahead of
 * the APK export — only the real farmer/official accounts and their fields
 * remain, plus the real (computed, not fabricated) calendar/risk data.
 *
 * Idempotent — safe to re-run.
 *
 *   npm run clean:demo
 */
import 'dotenv/config';
import { pool } from './pool.js';
import { logger } from '../lib/logger.js';

const DEMO_PHONE = '9990001111';
const NEIGHBOUR_PHONE = '9990002222';
const OFFICER_EMAIL = 'officer@agri.gov.in';

async function main() {
  const { rows: u } = await pool.query<{ id: string; phone: string | null; email: string | null }>(
    `SELECT id, phone, email FROM users WHERE phone IN ($1, $2) OR email = $3`,
    [DEMO_PHONE, NEIGHBOUR_PHONE, OFFICER_EMAIL],
  );
  const farmer = u.find((r) => r.phone === DEMO_PHONE);
  const neighbour = u.find((r) => r.phone === NEIGHBOUR_PHONE);
  const officer = u.find((r) => r.email === OFFICER_EMAIL);

  if (!farmer) {
    logger.info('no demo farmer found — nothing to clean');
    await pool.end();
    return;
  }

  await pool.query(`DELETE FROM scans WHERE farmer_id = $1`, [farmer.id]);
  await pool.query(`DELETE FROM activities WHERE farmer_id = $1`, [farmer.id]);
  await pool.query(`DELETE FROM ai_insights WHERE farmer_id = $1`, [farmer.id]);
  await pool.query(
    `DELETE FROM scheme_messages WHERE thread_id IN (SELECT id FROM scheme_threads WHERE farmer_id = $1)`,
    [farmer.id],
  );
  await pool.query(`DELETE FROM scheme_threads WHERE farmer_id = $1`, [farmer.id]);
  await pool.query(`DELETE FROM scheme_applications WHERE farmer_id = $1`, [farmer.id]);
  // cascades claim_track -> claim_track_event / escalation
  await pool.query(`DELETE FROM insurance_policy_ref WHERE farmer_id = $1`, [farmer.id]);
  await pool.query(
    `DELETE FROM pod_readings WHERE field_id IN (SELECT id FROM fields WHERE farmer_id = $1)`,
    [farmer.id],
  );
  await pool.query(`DELETE FROM pod_devices WHERE farmer_id = $1`, [farmer.id]);
  if (officer) await pool.query(`DELETE FROM alerts WHERE official_id = $1`, [officer.id]);
  if (neighbour) await pool.query(`DELETE FROM users WHERE id = $1`, [neighbour.id]); // cascades their field + scan

  logger.info({ farmerId: farmer.id }, 'demo/mock data cleaned — app now shows only the real fields, no fabricated history');
  await pool.end();
}

main().catch((e) => {
  logger.fatal({ err: e }, 'clean-demo failed');
  process.exit(1);
});
