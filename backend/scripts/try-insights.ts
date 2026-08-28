import 'dotenv/config';
import { queryOne, query } from '../src/db/query.js';
import { buildFarmContext, contextDigest, isContextEmpty } from '../src/modules/insights/context.js';
import { getDailyBrief, regenerate } from '../src/modules/insights/insights.service.js';
import { getFieldRisk } from '../src/modules/risk/risk.service.js';
import { pool } from '../src/db/pool.js';

const PHONE = process.argv[2] ?? '9990001111';

/** Mirror of the risk warm-up regenerate() performs before building its context. */
async function warmRisk(farmerId: string) {
  const fields = await query<{ id: string }>(
    `SELECT id FROM fields WHERE farmer_id = $1 AND location IS NOT NULL`,
    [farmerId],
  );
  await Promise.all(fields.map((f) => getFieldRisk(f.id, farmerId).catch(() => null)));
}

async function main() {
  const farmer = await queryOne<{ id: string; name: string; preferred_language: string }>(
    `SELECT id, name, preferred_language FROM users WHERE phone = $1 AND role = 'farmer'`,
    [PHONE],
  );
  console.log(`Farmer: ${farmer.name} (${farmer.id}) lang=${farmer.preferred_language}\n`);

  // regenerate() warms today's risk snapshots first, so build the context the same
  // way it does — otherwise this printout shows stale "risk=none" for every field.
  await warmRisk(farmer.id);

  console.time('buildFarmContext');
  const ctx = await buildFarmContext(farmer.id, { liveWeather: true });
  console.timeEnd('buildFarmContext');

  console.log('\n=== CONTEXT (the only facts the model gets) ===');
  console.log(`  fields          : ${ctx.fields.length}`);
  for (const f of ctx.fields) {
    console.log(
      `    - ${f.name} (${f.crop}${f.variety ? ` ${f.variety}` : ''}) day ${f.daysSinceSown ?? '?'}` +
        ` risk=${f.riskLevel ?? 'none'}${f.riskScore != null ? ` ${f.riskScore}` : ''}`,
    );
  }
  console.log(
    `  weather         : ${ctx.weather ? `${ctx.weather.place ?? '?'} ${ctx.weather.current.tempC}C ` +
      `${ctx.weather.current.condition}, ${ctx.weather.days.length}d, ` +
      `${ctx.weather.advisories.length} advisories, spray=${ctx.weather.sprayWindow ? 'yes' : 'no'}` : 'none'}`,
  );
  console.log(`  tasks           : ${ctx.tasks.overdue.length} overdue, ${ctx.tasks.today.length} today, ${ctx.tasks.upcomingCount} upcoming`);
  console.log(`  recent scans    : ${ctx.recentScans.length}`);
  for (const s of ctx.recentScans) {
    console.log(`    - ${s.label ?? '?'} (${s.severity ?? '?'}, ${s.status}) ${s.daysAgo}d ago on ${s.fieldName ?? 'no field'}`);
  }
  console.log(`  activities (21d): ${ctx.recentActivities.length}`);
  for (const a of ctx.recentActivities) {
    console.log(`    - ${a.kind}: ${a.title}${a.inputName ? ` [${a.inputName}]` : ''} ${a.daysAgo}d ago`);
  }
  console.log(`  nearby outbreaks: ${ctx.nearbyOutbreaks ? `${ctx.nearbyOutbreaks.count} within ${ctx.nearbyOutbreaks.radiusKm}km, nearest ${ctx.nearbyOutbreaks.nearestKm}km` : 'none'}`);
  console.log(`  official alerts : ${ctx.officialAlerts.length}`);
  console.log(`  low stock       : ${ctx.inventory.lowStock.length}, expiring: ${ctx.inventory.expiringSoon.length}`);
  console.log(`  finance (180d)  : spent ${ctx.finance.spent}, revenue ${ctx.finance.revenue}, net ${ctx.finance.net}`);
  console.log(`  digest          : ${contextDigest(ctx)}`);
  console.log(`  context bytes   : ${JSON.stringify(ctx).length}`);

  if (isContextEmpty(ctx)) {
    console.log('\nContext is empty — the API would return unavailable/no_fields. Nothing generated.');
    return;
  }

  console.log('\n=== GENERATING (Gemini + Sarvam, real calls) ===');
  console.time('regenerate');
  await regenerate(farmer.id);
  console.timeEnd('regenerate');

  const row = await queryOne<{
    headline: string;
    cards: unknown[];
    language: string;
    headline_en: string;
    generated_ms: number;
    model: string;
  }>(
    `SELECT headline, cards, language, headline_en, generated_ms, model
       FROM ai_insights WHERE farmer_id = $1 AND kind = 'daily_brief' AND for_date = CURRENT_DATE`,
    [farmer.id],
  );

  console.log(`\nmodel=${row.model}  ${row.generated_ms}ms  language=${row.language}`);
  console.log(`\nEN headline: ${row.headline_en}`);
  if (row.language !== 'en-IN') console.log(`${row.language} headline: ${row.headline}`);

  console.log('\n=== CARDS ===');
  for (const c of row.cards as Record<string, string>[]) {
    console.log(`\n[${c.urgency?.toUpperCase()}] ${c.category}${c.fieldName ? ` · ${c.fieldName}` : ''}`);
    console.log(`  ${c.title}`);
    console.log(`  ${c.body}`);
    console.log(`  basis: ${c.basis}`);
    console.log(`  action: ${c.action}${c.actionLabel ? ` ("${c.actionLabel}")` : ''}`);
  }

  console.log('\n=== API SHAPE (cached read) ===');
  console.time('getDailyBrief cached');
  const brief = await getDailyBrief(farmer.id);
  console.timeEnd('getDailyBrief cached');
  console.log(`  status=${brief.status} stale=${brief.stale ?? false} cards=${brief.cards?.length ?? 0}`);

  const rows = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ai_insights WHERE farmer_id = $1`,
    [farmer.id],
  );
  console.log(`  ai_insights rows for this farmer: ${rows[0]!.n}`);
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
