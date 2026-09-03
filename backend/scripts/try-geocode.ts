import 'dotenv/config';
import { resolveAdmin } from '../src/integrations/geocode.js';
import { pool } from '../src/db/pool.js';

async function main() {
  const pts: [string, number, number][] = [
    ['Chennai North Plot', 13.0827, 80.2707],
    ['River Field', 13.1, 80.25],
    ['Coimbatore rural', 11.0168, 76.9558],
    ['Trichy', 10.79, 78.70],
  ];
  for (const [label, lat, lng] of pts) {
    const t = Date.now();
    const a = await resolveAdmin(lat, lng);
    console.log(`${label.padEnd(20)} ${Date.now() - t}ms`, JSON.stringify(a));
    const t2 = Date.now();
    await resolveAdmin(lat, lng);
    console.log(`  cache hit: ${Date.now() - t2}ms`);
  }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
