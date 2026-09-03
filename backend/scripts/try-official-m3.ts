import 'dotenv/config';
import { pool } from '../src/db/pool.js';
import { getOverview, getDistrictBreakdown, getValidationQueue } from '../src/modules/official/official.service.js';
async function main() {
  const ov = await getOverview('Chennai');
  console.log('overview.byDistrict:', JSON.stringify(ov.byDistrict));
  console.log('overview.scans:', JSON.stringify(ov.scans));
  const d = await getDistrictBreakdown('Chennai', 60);
  console.table(d);
  const q = await getValidationQueue({ region: 'Chennai', district: 'Chennai', limit: 5, offset: 0, includeResolved: true });
  console.log('queue (district=Chennai):', q.length, 'items; first:', q[0] && { label: q[0].diagnosis_label, district: q[0].district });
  const q0 = await getValidationQueue({ region: 'Chennai', district: 'Coimbatore', limit: 5, offset: 0, includeResolved: true });
  console.log('queue (district=Coimbatore):', q0.length, 'items (expect 0)');
  await pool.end();
}
main().catch(e=>{console.error(e);process.exit(1)});
