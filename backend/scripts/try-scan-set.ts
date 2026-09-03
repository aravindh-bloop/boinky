/**
 * End-to-end test of the multi-angle scan draft flow (Module 1) against a
 * running local server + live Cloudinary + Gemini.
 *
 *   npm run dev            # in another terminal
 *   npx tsx scripts/try-scan-set.ts
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4000';
const img = readFileSync('scripts/fixtures/potato-late-blight.jpg');

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: '9990001111', password: 'secret123' }),
  });
  return (await r.json() as { token: string }).token;
}

async function addMedia(token: string, scanId: string, kind: string) {
  const fd = new FormData();
  fd.append('media', new Blob([new Uint8Array(img)], { type: 'image/jpeg' }), `${kind}.jpg`);
  fd.append('kind', kind);
  const r = await fetch(`${BASE}/api/scans/${scanId}/media`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: fd,
  });
  const j = await r.json();
  console.log(`  + ${kind}: ${r.status}`, j.media ? `${j.media.id} (${j.media.resource})` : JSON.stringify(j));
}

async function main() {
  const token = await login();
  const fieldsRes = await fetch(`${BASE}/api/fields`, { headers: { authorization: `Bearer ${token}` } });
  const fieldId = (await fieldsRes.json() as { fields: { id: string; name: string }[] }).fields[0]!.id;

  console.log('1. create draft');
  const dRes = await fetch(`${BASE}/api/scans/draft`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fieldId, lat: 13.0827, lng: 80.2707, accuracyM: 8 }),
  });
  const draft = await dRes.json() as { scanId: string; requiredAngles: string[]; angles: string[] };
  console.log('   ', dRes.status, JSON.stringify(draft));

  console.log('2. add media');
  await addMedia(token, draft.scanId, 'whole_plant');
  await addMedia(token, draft.scanId, 'affected_closeup');
  await addMedia(token, draft.scanId, 'leaf_underside');

  console.log('3. submit missing a required angle → expect 422');
  // remove affected_closeup first to test the gate
  const listRes = await fetch(`${BASE}/api/scans/${draft.scanId}`, { headers: { authorization: `Bearer ${token}` } });
  const scan0 = await listRes.json() as { scan: { media: { id: string; kind: string }[] } };
  const closeup = scan0.scan.media.find((m) => m.kind === 'affected_closeup')!;
  await fetch(`${BASE}/api/scans/${draft.scanId}/media/${closeup.id}`, {
    method: 'DELETE', headers: { authorization: `Bearer ${token}` },
  });
  const gateRes = await fetch(`${BASE}/api/scans/${draft.scanId}/submit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  console.log('   ', gateRes.status, JSON.stringify(await gateRes.json()));

  console.log('4. re-add + submit for real');
  await addMedia(token, draft.scanId, 'affected_closeup');
  const t = Date.now();
  const subRes = await fetch(`${BASE}/api/scans/${draft.scanId}/submit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ note: 'spots spreading fast after the rain last week' }),
  });
  const out = await subRes.json() as { scan: Record<string, unknown> };
  console.log('   ', subRes.status, `${((Date.now() - t) / 1000).toFixed(1)}s`);
  const s = out.scan as Record<string, unknown>;
  console.log('    label:', s.diagnosis_label, '| conf:', s.confidence, '| status:', s.status);
  console.log('    imageQuality:', s.image_quality, '| coverageGaps:', JSON.stringify(s.coverage_gaps));
  console.log('    district:', s.district, '| media count:', (s.media as unknown[])?.length);

  console.log('5. poll for advisory');
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const pr = await fetch(`${BASE}/api/scans/${draft.scanId}`, { headers: { authorization: `Bearer ${token}` } });
    const ps = (await pr.json() as { scan: { advisory_text: string | null } }).scan;
    if (ps.advisory_text) {
      console.log('    advisory:', ps.advisory_text.slice(0, 160), '…');
      break;
    }
    console.log(`    t+${(i + 1) * 3}s: still generating`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
