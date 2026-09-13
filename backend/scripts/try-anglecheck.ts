import 'dotenv/config';
import { readFileSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://localhost:4000';
const H = (t: string) => ({ authorization: `Bearer ${t}` });
async function tok(id: string, pw: string) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: id, password: pw }) });
  return ((await r.json()) as { token: string }).token;
}
async function upAndCheck(ft: string, scanId: string, kind: string, file: string, pos: number) {
  const fd = new FormData();
  fd.append('media', new Blob([readFileSync(file)], { type: 'image/jpeg' }), `${kind}.jpg`);
  fd.append('kind', kind);
  fd.append('position', String(pos));
  const up = await (await fetch(`${BASE}/api/scans/${scanId}/media`, { method: 'POST', headers: H(ft), body: fd })).json() as any;
  const mid = up.media?.id;
  const chk = await (await fetch(`${BASE}/api/scans/${scanId}/media/${mid}/check`, { method: 'POST', headers: H(ft) })).json() as any;
  console.log(`  ${kind.padEnd(16)} -> ok=${chk.ok} status=${chk.checkStatus} q=${chk.quality} plant=${chk.isPlant} angle=${chk.matchesAngle} | ${chk.checkNote ?? ''}`);
}
async function main() {
  const ft = await tok('9990001111', 'AgriPod@2026');
  const d = await (await fetch(`${BASE}/api/scans/draft`, { method: 'POST', headers: { ...H(ft), 'content-type': 'application/json' }, body: '{}' })).json() as any;
  console.log('draft', d.scanId);
  await upAndCheck(ft, d.scanId, 'affected_closeup', 'scripts/fixtures/potato-late-blight.jpg', 0);
  await upAndCheck(ft, d.scanId, 'whole_plant', 'scripts/fixtures/blight.jpg', 1);
  await upAndCheck(ft, d.scanId, 'field_wide', 'scripts/fixtures/potato-late-blight.jpg', 2);
}
main().catch((e) => { console.error(e); process.exit(1); });
