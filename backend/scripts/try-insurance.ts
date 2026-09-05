/**
 * End-to-end test of the crop-insurance flow (Module 4) against a running local
 * server + live Cloudinary + Gemini.  npm run dev  in another terminal first.
 *
 *   npx tsx scripts/try-insurance.ts
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4000';
const img = readFileSync('scripts/fixtures/potato-late-blight.jpg');

async function token(id: string, pw: string) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: id, password: pw }),
  });
  return (await r.json() as { token: string }).token;
}

async function main() {
  const ft = await token('9990001111', 'secret123');
  const ot = await token('officer@agri.gov.in', 'secret123');
  const H = (t: string) => ({ authorization: `Bearer ${t}` });

  const fields = await (await fetch(`${BASE}/api/fields`, { headers: H(ft) })).json() as { fields: { id: string; crop: string }[] };
  const field = fields.fields[0]!;

  const schemes = await (await fetch(`${BASE}/api/insurance/schemes`, { headers: H(ft) })).json() as { schemes: { id: string; title: string }[] };
  console.log('1. insurance schemes:', schemes.schemes.map((s) => s.title));

  console.log('2. enrol a policy');
  const pol = await (await fetch(`${BASE}/api/insurance/policies`, {
    method: 'POST',
    headers: { ...H(ft), 'content-type': 'application/json' },
    body: JSON.stringify({
      fieldId: field.id, schemeId: schemes.schemes[0]?.id, crop: field.crop,
      season: 'Kharif 2026', sumInsured: 45000, premiumPaid: 900, areaAcres: 2,
    }),
  })).json() as { policy: { id: string } };
  console.log('   policy', pol.policy.id);

  console.log('3. create a claim');
  const claim = await (await fetch(`${BASE}/api/insurance/claims`, {
    method: 'POST',
    headers: { ...H(ft), 'content-type': 'application/json' },
    body: JSON.stringify({
      policyId: pol.policy.id, cause: 'hailstorm', incidentDate: '2026-08-30',
      description: 'Hail on the 30th flattened the crop and shredded most leaves.',
      estimatedLossPct: 60, lat: 13.0827, lng: 80.2707,
    }),
  })).json() as { claim: { id: string; status: string } };
  console.log('   claim', claim.claim.id, claim.claim.status);

  console.log('4. add 2 evidence photos');
  for (const cap of ['Flattened crop, west side', 'Close-up of shredded leaves']) {
    const fd = new FormData();
    fd.append('media', new Blob([new Uint8Array(img)], { type: 'image/jpeg' }), 'damage.jpg');
    fd.append('caption', cap);
    fd.append('lat', '13.0827');
    fd.append('lng', '80.2707');
    const r = await fetch(`${BASE}/api/insurance/claims/${claim.claim.id}/media`, { method: 'POST', headers: H(ft), body: fd });
    console.log('   +', cap, r.status);
  }

  console.log('5. submit without media check → should 201 (has media)');
  const sub = await fetch(`${BASE}/api/insurance/claims/${claim.claim.id}/submit`, { method: 'POST', headers: H(ft) });
  console.log('   submit', sub.status);

  console.log('6. farmer view (no ai_assessment)');
  const fview = await (await fetch(`${BASE}/api/insurance/claims/${claim.claim.id}`, { headers: H(ft) })).json() as any;
  console.log('   status:', fview.claim.status, '| media:', fview.media.length, '| events:', fview.events.map((e: any) => e.kind), '| ai leaked?', 'ai_assessment' in fview.claim);

  console.log('7. wait for AI assessment, then officer view');
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const ov = await (await fetch(`${BASE}/api/official/insurance-claims/${claim.claim.id}`, { headers: H(ot) })).json() as any;
    if (ov.claim.ai_assessment) {
      console.log('   AI:', JSON.stringify(ov.claim.ai_assessment));
      break;
    }
    console.log(`   t+${(i + 1) * 3}s: no assessment yet`);
  }

  console.log('8. officer: list + decide');
  const list = await (await fetch(`${BASE}/api/official/insurance-claims`, { headers: H(ot) })).json() as { items: any[] };
  console.log('   officer sees', list.items.length, 'claim(s); first:', list.items[0] && { cause: list.items[0].cause, status: list.items[0].status, district: list.items[0].district });

  const d1 = await fetch(`${BASE}/api/official/insurance-claims/${claim.claim.id}/decision`, {
    method: 'POST', headers: { ...H(ot), 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'under_review', note: 'Assigning a surveyor.' }),
  });
  console.log('   -> under_review', d1.status);
  const d2 = await fetch(`${BASE}/api/official/insurance-claims/${claim.claim.id}/decision`, {
    method: 'POST', headers: { ...H(ot), 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'approved', approvedAmount: 27000, assessedLossPct: 60, note: 'Verified. 60% loss on 2 acres.' }),
  });
  console.log('   -> approved', d2.status);
  const d3 = await fetch(`${BASE}/api/official/insurance-claims/${claim.claim.id}/decision`, {
    method: 'POST', headers: { ...H(ot), 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'paid', approvedAmount: 27000 }),
  });
  console.log('   -> paid', d3.status);

  console.log('9. summary');
  const sum = await (await fetch(`${BASE}/api/official/insurance-summary`, { headers: H(ot) })).json();
  console.log('  ', JSON.stringify(sum));

  console.log('10. final timeline (farmer)');
  const tl = await (await fetch(`${BASE}/api/insurance/claims/${claim.claim.id}`, { headers: H(ft) })).json() as any;
  tl.events.forEach((e: any) => console.log(`   ${e.kind}${e.to_status ? ` -> ${e.to_status}` : ''}: ${e.body ?? ''}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
