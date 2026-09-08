/**
 * End-to-end smoke test of the PMFBY claim TRACKER (Module 4, pivot) against a
 * running local server.  `npm run dev` in another terminal first, and make sure
 * `npm run seed` has loaded the officer directory.
 *
 *   npx tsx scripts/try-insurance.ts
 */
import 'dotenv/config';

const BASE = process.env.BASE ?? 'http://localhost:4000';

async function token(id: string, pw: string) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: id, password: pw }),
  });
  return ((await r.json()) as { token: string }).token;
}

async function main() {
  const ft = await token('9990001111', 'secret123');
  const ot = await token('officer@agri.gov.in', 'secret123');
  const H = (t: string) => ({ authorization: `Bearer ${t}`, 'content-type': 'application/json' });

  const fields = (await (await fetch(`${BASE}/api/fields`, { headers: H(ft) })).json()) as {
    fields: { id: string; crop: string }[];
  };
  const field = fields.fields[0]!;

  const ref = (await (await fetch(`${BASE}/api/insurance/reference`, { headers: H(ft) })).json()) as {
    stages: unknown[];
    rungs: unknown[];
  };
  console.log('1. reference:', ref.stages.length, 'stages,', ref.rungs.length, 'escalation rungs');

  const pol = (await (
    await fetch(`${BASE}/api/insurance/policies`, {
      method: 'POST',
      headers: H(ft),
      body: JSON.stringify({
        fieldId: field.id,
        applicationNo: 'TN2026K-TEST01',
        season: 'Kharif 2026',
        crop: field.crop,
        insurerName: 'Agriculture Insurance Company of India',
        sumInsured: 48000,
        premiumPaid: 720,
        district: 'Tiruvallur',
      }),
    })
  ).json()) as { policy: { id: string } };
  console.log('2. policy ref:', pol.policy.id);

  const claim = (await (
    await fetch(`${BASE}/api/insurance/claims`, {
      method: 'POST',
      headers: H(ft),
      body: JSON.stringify({
        policyRefId: pol.policy.id,
        cause: 'unseasonal_rain',
        lossType: 'localised',
        incidentDate: new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10),
        docketId: 'KRPH/TEST/0001',
        farmerEstimatedLossPct: 40,
      }),
    })
  ).json()) as { claim: { id: string }; clock: unknown };
  console.log('3. claim tracked:', claim.claim.id);

  // advance it to a stuck stage
  const adv = (await (
    await fetch(`${BASE}/api/insurance/claims/${claim.claim.id}`, {
      method: 'PATCH',
      headers: H(ft),
      body: JSON.stringify({
        stage: 'assessment',
        stageSince: new Date(Date.now() - 18 * 864e5).toISOString().slice(0, 10),
      }),
    })
  ).json()) as { clock: { breached: boolean; overdueBy: number }; canEscalate: boolean };
  console.log('4. advanced to assessment — breached:', adv.clock.breached, 'overdue by', adv.clock.overdueBy, 'days');

  const opts = (await (
    await fetch(`${BASE}/api/insurance/claims/${claim.claim.id}/escalation`, { headers: H(ft) })
  ).json()) as { recommended: string; rungs: { rung: string; contacts: unknown[] }[]; letterEn: string };
  console.log('5. escalation → recommended rung:', opts.recommended);
  console.log('   rungs w/ contacts:', opts.rungs.map((r) => `${r.rung}(${r.contacts.length})`).join(' '));
  console.log('   letter starts:', opts.letterEn.split('\n')[0]);

  const esc = (await (
    await fetch(`${BASE}/api/insurance/claims/${claim.claim.id}/escalate`, {
      method: 'POST',
      headers: H(ft),
      body: JSON.stringify({
        rung: opts.recommended,
        channel: 'krph',
        reason: 'Survey report not filed within 15 days.',
      }),
    })
  ).json()) as { escalation: { id: string } };
  console.log('6. escalation created:', esc.escalation.id);

  // officer side
  const inbox = (await (
    await fetch(`${BASE}/api/official/insurance-escalations`, { headers: H(ot) })
  ).json()) as { items: { id: string; farmer_name: string; reason: string }[] };
  console.log('7. officer inbox:', inbox.items.length, 'escalations; first from', inbox.items[0]?.farmer_name);

  const upd = await fetch(`${BASE}/api/official/insurance-escalations/${esc.escalation.id}/status`, {
    method: 'POST',
    headers: H(ot),
    body: JSON.stringify({ status: 'in_progress', note: 'Called the insurer district office; report due in 3 days.' }),
  });
  console.log('8. officer marked in_progress:', upd.status);

  const sum = await (await fetch(`${BASE}/api/official/insurance-summary`, { headers: H(ot) })).json();
  console.log('9. officer summary:', JSON.stringify(sum));

  const dir = (await (
    await fetch(`${BASE}/api/insurance/directory?district=Tiruvallur`, { headers: H(ft) })
  ).json()) as { contacts: { rung: string; designation: string; verified: boolean }[] };
  console.log('10. directory for Tiruvallur:', dir.contacts.length, 'contacts');
  for (const c of dir.contacts) console.log(`    ${c.rung.padEnd(9)} ${c.verified ? '✓' : '·'} ${c.designation}`);

  const view = (await (
    await fetch(`${BASE}/api/insurance/claims/${claim.claim.id}`, { headers: H(ft) })
  ).json()) as { timeline: { label: string; state: string }[]; events: unknown[] };
  console.log('11. farmer claim view — timeline:', view.timeline.map((t) => `${t.label}:${t.state}`).join(' → '));
  console.log('    events:', view.events.length);

  console.log('\n✅ tracker flow OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
