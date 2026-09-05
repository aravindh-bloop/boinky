/**
 * Demo data seed — fills the Chennai demo farmer with a realistic spread of
 * scans, activities, expenses, harvests, stock, an officer alert and a nearby
 * outbreak, then regenerates each field's calendar and risk snapshot. Lets you
 * walk every screen with content in it.
 *
 * Idempotent: it wipes the demo farmer's own runtime rows first, then re-inserts.
 * The base `seed:dev` (farmer + official + fields) must have run first.
 *
 *   npm run seed:demo
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';
import { logger } from '../lib/logger.js';
import { regenerateFieldCalendar } from '../modules/calendar/calendar.service.js';
import { getFieldRisk } from '../modules/risk/risk.service.js';

const DEMO_PHONE = '9990001111';
const NEIGHBOUR_PHONE = '9990002222';
const OFFICER_EMAIL = 'officer@agri.gov.in';

const D = (daysAgo: number) => `(CURRENT_DATE - ${daysAgo})`;
const TS = (daysAgo: number) => `(now() - interval '${daysAgo} days')`;

interface Ctx {
  farmerId: string;
  officerId: string;
  fields: Record<string, { id: string; crop: string }>;
}

/** field id by name — throws rather than silently seeding null. */
function F(c: Ctx, name: string): string {
  const f = c.fields[name];
  if (!f) throw new Error(`demo field "${name}" not found`);
  return f.id;
}

async function ids(): Promise<Ctx> {
  const { rows: u } = await pool.query<{ id: string; phone: string | null; email: string | null }>(
    `SELECT id, phone, email FROM users WHERE phone = $1 OR email = $2`,
    [DEMO_PHONE, OFFICER_EMAIL],
  );
  const farmer = u.find((r) => r.phone === DEMO_PHONE);
  const officer = u.find((r) => r.email === OFFICER_EMAIL);
  if (!farmer || !officer) throw new Error('run `npm run seed:dev` first — demo farmer/officer missing');

  const { rows: f } = await pool.query<{ id: string; name: string; crop: string }>(
    `SELECT id, name, crop FROM fields WHERE farmer_id = $1`,
    [farmer.id],
  );
  const fields: Ctx['fields'] = {};
  for (const row of f) fields[row.name] = { id: row.id, crop: row.crop };
  if (!fields['North Plot']) throw new Error('demo fields missing — run `npm run seed:dev`');

  return { farmerId: farmer.id, officerId: officer.id, fields };
}

async function wipe(farmerId: string, officerId: string) {
  await pool.query(`DELETE FROM scans     WHERE farmer_id = $1`, [farmerId]);
  await pool.query(`DELETE FROM expenses  WHERE farmer_id = $1`, [farmerId]);
  await pool.query(`DELETE FROM activities WHERE farmer_id = $1`, [farmerId]);
  await pool.query(`DELETE FROM harvests  WHERE farmer_id = $1`, [farmerId]);
  await pool.query(`DELETE FROM inventory_items WHERE farmer_id = $1`, [farmerId]);
  await pool.query(`DELETE FROM alerts WHERE official_id = $1`, [officerId]);
  await pool.query(`DELETE FROM ai_insights WHERE farmer_id = $1`, [farmerId]);
  await pool.query(
    `DELETE FROM pod_readings WHERE field_id IN (SELECT id FROM fields WHERE farmer_id = $1)`,
    [farmerId],
  );
  await pool.query(`DELETE FROM pod_devices WHERE farmer_id = $1`, [farmerId]);
  await pool.query(`DELETE FROM insurance_policies WHERE farmer_id = $1`, [farmerId]);
  // neighbour + their scans
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM users WHERE phone = $1`, [
    NEIGHBOUR_PHONE,
  ]);
  if (rows[0]) await pool.query(`DELETE FROM users WHERE id = $1`, [rows[0].id]);
}

// ── scans ──────────────────────────────────────────────────────────────────
interface ScanSeed {
  field: string;
  daysAgo: number;
  label: string;
  category: 'disease' | 'pest' | 'deficiency' | 'healthy';
  part: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | null;
  status: 'auto_confirmed' | 'validated' | 'needs_validation';
  risk: number;
  advisory: string;
}

const SCANS: ScanSeed[] = [
  {
    field: 'North Plot',
    daysAgo: 2,
    label: 'Brown Planthopper',
    category: 'pest',
    part: 'stem base',
    confidence: 0.88,
    severity: 'medium',
    status: 'auto_confirmed',
    risk: 61,
    advisory:
      'Brown planthopper is building up at the base of your rice plants. Drain the field for 3-4 days to expose the insects, and widen the gaps between rows so air moves through the canopy. Avoid spraying broad pesticides now — they kill the spiders and bugs that eat planthoppers and make the problem worse. If you see hopper-burn patches, spray pymetrozine or dinotefuran directed at the base, early morning.',
  },
  {
    field: 'North Plot',
    daysAgo: 13,
    label: 'Bacterial Leaf Blight',
    category: 'disease',
    part: 'leaf',
    confidence: 0.83,
    severity: 'high',
    status: 'validated',
    risk: 74,
    advisory:
      'This is bacterial leaf blight — the yellow drying along the leaf edges is the sign. Stop top-dressing nitrogen for now, as lush growth spreads it faster. Drain excess water and do not let irrigation run from an infected plot into a clean one. There is no spray that cures it; a copper hydroxide spray only slows it. For the next crop, use a resistant variety and treat the seed before sowing.',
  },
  {
    field: 'River Field',
    daysAgo: 8,
    label: 'Early Shoot Borer',
    category: 'pest',
    part: 'central shoot',
    confidence: 0.79,
    severity: 'medium',
    status: 'auto_confirmed',
    risk: 55,
    advisory:
      'Early shoot borer has killed some central shoots — pull one and check for the dead-heart smell. Cut affected shoots below ground level and destroy them. Earth up the rows and give a light irrigation. Release Trichogramma cards if you can get them from the sugarcane office. Trash mulching between rows also lowers the next generation.',
  },
  {
    field: 'Back Acre',
    daysAgo: 5,
    label: 'Tikka Leaf Spot',
    category: 'disease',
    part: 'leaf',
    confidence: 0.9,
    severity: 'low',
    status: 'auto_confirmed',
    risk: 33,
    advisory:
      'Early tikka leaf spot — the small dark circular spots on the lower leaves. It is still light. Remove and bury heavily spotted leaves. If spots spread to the middle leaves, spray chlorothalonil or a mancozeb + carbendazim mix, and repeat after 12-15 days. Do not spray within the pre-harvest wait printed on the pack.',
  },
  {
    field: 'Back Acre',
    daysAgo: 17,
    label: 'Healthy',
    category: 'healthy',
    part: 'whole plant',
    confidence: 0.94,
    severity: null,
    status: 'auto_confirmed',
    risk: 8,
    advisory:
      'The groundnut looks healthy — good green colour and no spots or pest damage. Keep scouting the lower leaves twice a week, and make sure the crop gets water at pegging and pod-filling. Nothing to treat right now.',
  },
  {
    field: 'North Plot',
    daysAgo: 1,
    label: 'Rice Leaf Folder',
    category: 'pest',
    part: 'leaf',
    confidence: 0.61,
    severity: 'low',
    status: 'needs_validation',
    risk: 29,
    advisory: '',
  },
];

async function seedScans(c: Ctx) {
  for (const s of SCANS) {
    await pool.query(
      `INSERT INTO scans
         (field_id, farmer_id, image_url, image_public_id, diagnosis_label, diagnosis_category,
          affected_part, confidence, severity, raw_model_response, advisory_text, advisory_language,
          status, validated_by, validated_at, risk_score, location, created_at)
       SELECT $1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11, $12,
              $13, ${s.status === 'validated' ? TS(s.daysAgo - 1) : 'NULL'}, $14,
              f.location, ${TS(s.daysAgo)}
         FROM fields f WHERE f.id = $1`,
      [
        F(c, s.field),
        c.farmerId,
        `https://picsum.photos/seed/agri-${s.label.toLowerCase().replace(/\s+/g, '-')}-${s.daysAgo}/900/650`,
        s.label,
        s.category,
        s.part,
        s.confidence,
        s.severity,
        JSON.stringify({ isPlant: true, label: s.label, category: s.category, confidence: s.confidence }),
        s.advisory || null,
        s.advisory ? 'en-IN' : null,
        s.status,
        s.status === 'validated' ? c.officerId : null,
        s.risk,
      ],
    );
  }
}

// ── neighbour + nearby outbreak ────────────────────────────────────────────
async function seedNeighbourOutbreak(c: Ctx) {
  const hash = await bcrypt.hash('secret123', 10);
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (name, phone, password_hash, role, preferred_language, region)
     VALUES ('Neighbour Farmer', $1, $2, 'farmer', 'ta', 'Chennai') RETURNING id`,
    [NEIGHBOUR_PHONE, hash],
  );
  const nId = rows[0]!.id;
  const { rows: nf } = await pool.query<{ id: string }>(
    `INSERT INTO fields (farmer_id, name, crop, variety, sown_date, location, area_acres)
     VALUES ($1, 'Nghbr Paddy', 'rice', 'CR-1009', ${D(60)}::date,
             ST_SetSRID(ST_MakePoint(80.288, 13.095), 4326)::geography, 1.5)
     RETURNING id`,
    [nId],
  );
  // a confirmed HIGH-severity rice blast ~2 km from the demo farm → drives the
  // "outbreak nearby" alert and raises the forewarning risk for North Plot.
  await pool.query(
    `INSERT INTO scans
       (field_id, farmer_id, image_url, diagnosis_label, diagnosis_category, affected_part,
        confidence, severity, raw_model_response, advisory_text, advisory_language, status,
        risk_score, location, created_at)
     SELECT $1, $2, 'https://picsum.photos/seed/agri-rice-blast/900/650', 'Rice Blast', 'disease',
            'leaf', 0.91, 'high', '{"isPlant":true}', 'Confirmed rice blast.', 'ta-IN',
            'validated', 82, f.location, ${TS(4)}
       FROM fields f WHERE f.id = $1`,
    [nf[0]!.id, nId],
  );
}

// ── activities ────────────────────────────────────────────────────────────
const ACTIVITIES: [
  string,
  string,
  string,
  string | null,
  number,
  string | null,
  number | null,
  string | null,
  number | null,
][] = [
  // field, kind, title, note, daysAgo, inputName, qty, unit, cost
  ['North Plot', 'sowing', 'Transplanted rice seedlings', '25-day nursery, 20x15 cm spacing', 55, null, null, null, null],
  ['North Plot', 'fertilizing', 'Basal dose', 'DAP + MOP before transplanting', 55, 'DAP', 50, 'kg', 1450],
  ['Back Acre', 'sowing', 'Sowed groundnut', 'TMV-7, seed treated with Trichoderma', 45, 'Groundnut seed', 40, 'kg', 3200],
  ['North Plot', 'fertilizing', 'First top-dress', 'Urea at active tillering', 33, 'Urea', 25, 'kg', 640],
  ['River Field', 'weeding', 'Inter-row weeding', 'Manual, 4 labourers', 20, null, null, null, 1600],
  ['North Plot', 'spraying', 'Sprayed for stem borer', 'Cartap hydrochloride, knapsack', 14, 'Cartap 4G', 8, 'kg', 520],
  ['Back Acre', 'irrigation', 'Irrigated at pegging', 'Full irrigation, ~3 hours', 10, null, null, null, 300],
  ['River Field', 'scouting', 'Checked for shoot borer', 'Found a few dead-hearts in row 6-8', 8, null, null, null, null],
  ['North Plot', 'irrigation', 'Maintained 2 cm standing water', null, 4, null, null, null, 300],
  ['Back Acre', 'spraying', 'Sprayed for leaf spot', 'Mancozeb + carbendazim', 3, 'Mancozeb', 500, 'g', 340],
];

async function seedActivities(c: Ctx) {
  for (const [field, kind, title, note, daysAgo, input, qty, unit, cost] of ACTIVITIES) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO activities
         (farmer_id, field_id, kind, title, note, input_name, quantity, unit, cost, activity_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ${D(daysAgo)}::date, ${TS(daysAgo)})
       RETURNING id`,
      [c.farmerId, F(c, field), kind, title, note, input, qty, unit, cost],
    );
    if (cost != null) {
      await pool.query(
        `INSERT INTO expenses (farmer_id, field_id, category, description, amount, spent_on, activity_id, created_at)
         VALUES ($1, $2, $3, $4, $5, ${D(daysAgo)}::date, $6, ${TS(daysAgo)})`,
        [
          c.farmerId,
          F(c, field),
          kind === 'fertilizing' ? 'fertilizer' : kind === 'spraying' ? 'pesticide' : kind === 'sowing' ? 'seed' : kind === 'irrigation' ? 'irrigation' : 'labour',
          title,
          cost,
          rows[0]!.id,
        ],
      );
    }
  }
}

// ── standalone expenses (not tied to an activity) ─────────────────────────
const EXPENSES: [string | null, string, string, number, number][] = [
  // field, category, description, amount, daysAgo
  ['North Plot', 'labour', 'Transplanting labour — 8 women', 4800, 55],
  ['North Plot', 'machinery', 'Rotavator + puddling (rented)', 2600, 57],
  [null, 'transport', 'Carting inputs from market', 700, 45],
  ['Back Acre', 'labour', 'Sowing + gap filling', 1800, 44],
  [null, 'machinery', 'Diesel for pump set', 1200, 22],
  ['River Field', 'fertilizer', 'Potash — 2 bags', 1700, 30],
  [null, 'other', 'Sprayer repair', 350, 12],
];

async function seedExpenses(c: Ctx) {
  for (const [field, category, description, amount, daysAgo] of EXPENSES) {
    await pool.query(
      `INSERT INTO expenses (farmer_id, field_id, category, description, amount, spent_on, created_at)
       VALUES ($1, $2, $3, $4, $5, ${D(daysAgo)}::date, ${TS(daysAgo)})`,
      [c.farmerId, field ? F(c, field) : null, category, description, amount],
    );
  }
}

// ── harvests ──────────────────────────────────────────────────────────────
async function seedHarvests(c: Ctx) {
  // previous groundnut cycle on Back Acre
  await pool.query(
    `INSERT INTO harvests (farmer_id, field_id, harvested_on, crop, quantity, unit, unit_price, revenue, buyer, note, created_at)
     VALUES ($1, $2, ${D(150)}::date, 'groundnut', 9.5, 'quintal', 6100, 57950, 'Koyambedu trader', 'Last season, before current crop', ${TS(150)})`,
    [c.farmerId, F(c, 'Back Acre')],
  );
  // a partial early sugarcane cut
  await pool.query(
    `INSERT INTO harvests (farmer_id, field_id, harvested_on, crop, quantity, unit, unit_price, revenue, buyer, note, created_at)
     VALUES ($1, $2, ${D(9)}::date, 'sugarcane', 6, 'tonne', 3150, 18900, 'Local jaggery unit', 'Early cut from headland rows', ${TS(9)})`,
    [c.farmerId, F(c, 'River Field')],
  );
}

// ── inventory ─────────────────────────────────────────────────────────────
const STOCK: [string, string, number, string, number | null, number, number | null][] = [
  // name, type, qty, unit, lowStockAt, purchaseDaysAgo, expiryDaysFromNow
  ['Urea', 'fertilizer', 40, 'kg', 25, 20, null],
  ['DAP', 'fertilizer', 10, 'kg', 25, 55, null],
  ['Muriate of Potash', 'fertilizer', 30, 'kg', 20, 30, null],
  ['Chlorantraniliprole 18.5% SC', 'pesticide', 120, 'ml', 250, 40, 210],
  ['Neem oil (10000 ppm)', 'pesticide', 900, 'ml', 500, 25, 400],
  ['Mancozeb 75% WP', 'pesticide', 350, 'g', 500, 30, 25],
  ['Rice seed — ADT-43 (leftover)', 'seed', 4, 'kg', 10, 58, null],
  ['Knapsack sprayer (16 L)', 'equipment', 1, 'unit', null, 400, null],
];

async function seedStock(c: Ctx) {
  for (const [name, type, qty, unit, low, purAgo, expIn] of STOCK) {
    await pool.query(
      `INSERT INTO inventory_items
         (farmer_id, item_name, item_type, quantity, unit, low_stock_at, purchase_date, expiry_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, ${D(purAgo)},
               ${expIn == null ? 'NULL::date' : `(CURRENT_DATE + ${expIn})`}, now(), now())`,
      [c.farmerId, name, type, qty, unit, low],
    );
  }
}

// ── officer alerts ────────────────────────────────────────────────────────
async function seedAlerts(c: Ctx) {
  await pool.query(
    `INSERT INTO alerts (official_id, region, crop, title, message, severity, created_at)
     VALUES
       ($1, 'Chennai', 'rice',
        'Brown planthopper — watch in the Chennai delta',
        'Light traps in Thiruvallur and Kancheepuram are catching high numbers of brown planthopper. Scout the base of your rice plants twice this week. Drain the field for a few days and avoid broad-spectrum sprays, which kill natural enemies. Report hopper-burn patches to your VAO.',
        'high', ${TS(2)}),
       ($1, 'Chennai', NULL,
        'North-east monsoon setting in early',
        'IMD expects the first spells of the north-east monsoon within 10 days. Clear field drains, secure young plants and stagger any planned nitrogen top-dressing so it is not washed away.',
        'medium', ${TS(6)})`,
    [c.officerId],
  );
}

// ── calendar + risk (computed, real) ──────────────────────────────────────
async function seedComputed(c: Ctx) {
  for (const name of Object.keys(c.fields)) {
    const fid = F(c, name);
    try {
      await regenerateFieldCalendar(fid, c.farmerId);
    } catch (e) {
      logger.warn({ e, name }, 'calendar regen failed');
    }
    try {
      await getFieldRisk(fid, c.farmerId, { refresh: true });
    } catch (e) {
      logger.warn({ e, name }, 'risk compute failed');
    }
  }
  // mark a couple of past tasks done, push one overdue
  await pool.query(
    `UPDATE calendar_tasks SET is_done = true
      WHERE field_id IN (SELECT id FROM fields WHERE farmer_id = $1)
        AND task_date < CURRENT_DATE - 7`,
    [c.farmerId],
  );
  // pull the next two upcoming tasks onto today / overdue so the dashboard's
  // "today" and "overdue" cards both have something.
  await pool.query(
    `WITH upcoming AS (
       SELECT id, row_number() OVER (ORDER BY task_date) AS rn
         FROM calendar_tasks
        WHERE field_id IN (SELECT id FROM fields WHERE farmer_id = $1)
          AND is_done = false AND task_date >= CURRENT_DATE
     )
     UPDATE calendar_tasks t
        SET task_date = CASE u.rn WHEN 1 THEN CURRENT_DATE ELSE CURRENT_DATE - 2 END
       FROM upcoming u
      WHERE t.id = u.id AND u.rn <= 2`,
    [c.farmerId],
  );
}

// ── hardware pod (North Plot) ─────────────────────────────────────────────
// Fixed demo key so it can be dropped straight into the ESP32 sketch. Seeds
// ~12h of history so the pod card and sparklines have data before the real
// rig connects; the real rig then appends live readings to the same field.
const DEMO_POD_KEY = 'pod_demo_a1b2c3d4e5f60718293a4b5c';

async function seedPod(c: Ctx) {
  const { createHash } = await import('node:crypto');
  const keyHash = createHash('sha256').update(DEMO_POD_KEY).digest('hex');
  const fid = F(c, 'North Plot');

  await pool.query(`DELETE FROM pod_devices WHERE field_id = $1`, [fid]);
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO pod_devices (field_id, farmer_id, label, key_hash, last_seen_at)
     VALUES ($1, $2, 'North Plot field pod', $3, now() - interval '3 minutes')
     RETURNING id`,
    [fid, c.farmerId, keyHash],
  );
  const deviceId = rows[0]!.id;

  await pool.query(`DELETE FROM pod_readings WHERE field_id = $1`, [fid]);
  const values: string[] = [];
  const params: unknown[] = [fid, deviceId];
  for (let i = 144; i >= 0; i--) {
    // one every 5 min for 12h; gentle diurnal drift + noise
    const mins = i * 5;
    const dayFrac = ((Date.now() / 60000 - mins) / 1440) % 1;
    const temp = 29 + 4 * Math.sin(dayFrac * 2 * Math.PI) + (Math.random() - 0.5);
    const moist = 46 - i * 0.04 + (Math.random() - 0.5) * 2; // slowly drying
    const ph = 6.6 + (Math.random() - 0.5) * 0.3;
    const hum = 70 - 12 * Math.sin(dayFrac * 2 * Math.PI) + (Math.random() - 0.5) * 3;
    const b = params.length;
    values.push(`($1, $2, $${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, 92, 'esp32', (now() - interval '${mins} minutes'))`);
    params.push(temp.toFixed(1), moist.toFixed(1), ph.toFixed(2), hum.toFixed(1));
  }
  await pool.query(
    `INSERT INTO pod_readings
       (field_id, device_id, temperature, soil_moisture, soil_ph, air_humidity, battery_pct, reading_source, created_at)
     VALUES ${values.join(', ')}`,
    params,
  );
  logger.info({ deviceId, key: DEMO_POD_KEY }, 'demo pod seeded — put this key in the ESP32 sketch');
}

// ── scheme applications + a query thread ─────────────────────────────────
async function seedSchemes(c: Ctx) {
  await pool.query(
    `DELETE FROM scheme_applications WHERE farmer_id = $1`,
    [c.farmerId],
  );
  await pool.query(`DELETE FROM scheme_threads WHERE farmer_id = $1`, [c.farmerId]);

  const { rows: schemes } = await pool.query<{ id: string; title: string }>(
    `SELECT id, title FROM schemes ORDER BY title LIMIT 5`,
  );
  if (schemes.length < 3) return;

  const plan: [number, string, number | null, string | null][] = [
    // schemeIndex, status, amount, officerNote
    [0, 'disbursed', 6000, 'PM-KISAN 2nd instalment released via DBT.'],
    [1, 'approved', null, 'Eligible — land records verified. Disbursal pending at treasury.'],
    [2, 'under_review', null, 'Waiting on the soil health card copy.'],
    [3, 'submitted', null, null],
  ];
  const appIds: string[] = [];
  for (const [idx, status, amount, note] of plan) {
    const sc = schemes[idx];
    if (!sc) continue;
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO scheme_applications
         (scheme_id, farmer_id, status, farmer_note, officer_note, amount,
          reviewed_by, reviewed_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,
               ${status === 'submitted' ? 'NULL' : '$7'},
               ${status === 'submitted' ? 'NULL' : '(now() - interval \'2 days\')'},
               (now() - interval '9 days'), (now() - interval '2 days'))
       RETURNING id`,
      status === 'submitted'
        ? [sc.id, c.farmerId, status, 'Applied for the ' + sc.title + '.', note, amount]
        : [sc.id, c.farmerId, status, 'Applied for the ' + sc.title + '.', note, amount, c.officerId],
    );
    appIds.push(rows[0]!.id);
  }

  // a query thread on the disbursed one, answered by the officer
  const sc0 = schemes[0]!;
  const { rows: tr } = await pool.query<{ id: string }>(
    `INSERT INTO scheme_threads (scheme_id, application_id, farmer_id, subject, status, last_message_at, created_at)
     VALUES ($1, $2, $3, $4, 'answered', now() - interval '1 day', now() - interval '3 days')
     RETURNING id`,
    [sc0.id, appIds[0] ?? null, c.farmerId, 'When will the ' + sc0.title + ' amount reach my account?'],
  );
  const tid = tr[0]!.id;
  await pool.query(
    `INSERT INTO scheme_messages (thread_id, sender_id, sender_role, body, created_at) VALUES
       ($1, $2, 'farmer', 'You marked it disbursed but I have not received it yet.', now() - interval '3 days'),
       ($1, $3, 'official', 'DBT transfers take 2-3 working days. If it is not in by Monday, bring your passbook first page to the office.', now() - interval '1 day')`,
    [tid, c.farmerId, c.officerId],
  );
  logger.info({ applications: appIds.length }, 'demo schemes seeded');
}

// ── crop-insurance policies + claims ────────────────────────────────────
async function seedInsurance(c: Ctx) {
  const { rows: sch } = await pool.query<{ id: string; title: string }>(
    `SELECT id, title FROM schemes WHERE kind = 'insurance' ORDER BY title`,
  );
  const pmfby = sch.find((s) => s.title.includes('PMFBY')) ?? sch[0];
  if (!pmfby) return;

  // Two policies: one on the rice plot (has a claim), one on the groundnut plot.
  const north = F(c, 'North Plot');
  const back = F(c, 'Back Acre');
  const { rows: p1 } = await pool.query<{ id: string }>(
    `INSERT INTO insurance_policies
       (farmer_id, field_id, scheme_id, crop, season, sum_insured, premium_paid, area_acres,
        status, start_date, end_date, created_at)
     VALUES ($1,$2,$3,'rice','Kharif 2026',52000,780,2,'active',
             CURRENT_DATE - 70, CURRENT_DATE + 50, now() - interval '70 days')
     RETURNING id`,
    [c.farmerId, north, pmfby.id],
  );
  await pool.query(
    `INSERT INTO insurance_policies
       (farmer_id, field_id, scheme_id, crop, season, sum_insured, premium_paid, area_acres,
        status, start_date, end_date, created_at)
     VALUES ($1,$2,$3,'groundnut','Kharif 2026',30000,900,1,'active',
             CURRENT_DATE - 45, CURRENT_DATE + 65, now() - interval '45 days')`,
    [c.farmerId, back, pmfby.id],
  );

  // One claim on the rice policy — under review, with an evidence photo (reuse a
  // seeded scan image so no upload is needed) and a short officer conversation.
  const { rows: img } = await pool.query<{ image_url: string; id: string }>(
    `SELECT id, image_url FROM scans WHERE farmer_id = $1 AND image_url <> '' ORDER BY created_at DESC LIMIT 1`,
    [c.farmerId],
  );
  const { rows: cl } = await pool.query<{ id: string }>(
    `INSERT INTO insurance_claims
       (policy_id, farmer_id, field_id, scan_id, cause, description, incident_date,
        estimated_loss_pct, status, district, submitted_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'unseasonal_rain',
             'Three days of heavy rain last week waterlogged the low end of the plot and lodged the crop.',
             CURRENT_DATE - 8, 45, 'under_review', 'Chennai',
             now() - interval '6 days', now() - interval '6 days', now() - interval '2 days')
     RETURNING id`,
    [p1[0]!.id, c.farmerId, north, img[0]?.id ?? null],
  );
  const claimId = cl[0]!.id;
  if (img[0]) {
    await pool.query(
      `INSERT INTO insurance_claim_media (claim_id, kind, url, caption, lat, lng, position)
       VALUES ($1,'photo',$2,'Lodged crop at the low end',13.0827,80.2707,0)`,
      [claimId, img[0].image_url],
    );
  }
  await pool.query(
    `INSERT INTO insurance_claim_events (claim_id, actor_id, actor_role, kind, from_status, to_status, body, created_at) VALUES
       ($1,$2,'farmer','created',NULL,NULL,'Started a claim for unseasonal rain.', now() - interval '6 days'),
       ($1,$2,'farmer','submitted','draft','submitted','Submitted with 1 photo.', now() - interval '6 days'),
       ($1,$3,'official','status_change','submitted','under_review','A surveyor will visit within 5 working days.', now() - interval '2 days'),
       ($1,$2,'farmer','message',NULL,NULL,'The water has drained now but the crop is still bent over.', now() - interval '1 day')`,
    [claimId, c.farmerId, c.officerId],
  );
  logger.info({ policies: 2, claims: 1 }, 'demo insurance seeded');
}

async function main() {
  const c = await ids();
  await wipe(c.farmerId, c.officerId);
  await seedNeighbourOutbreak(c);
  await seedScans(c);
  await seedActivities(c);
  await seedExpenses(c);
  await seedHarvests(c);
  await seedStock(c);
  await seedAlerts(c);
  await seedPod(c);
  await seedSchemes(c);
  await seedInsurance(c);
  await seedComputed(c);

  const counts = await pool.query(
    `SELECT
       (SELECT count(*) FROM scans WHERE farmer_id = $1) AS scans,
       (SELECT count(*) FROM activities WHERE farmer_id = $1) AS activities,
       (SELECT count(*) FROM expenses WHERE farmer_id = $1) AS expenses,
       (SELECT count(*) FROM harvests WHERE farmer_id = $1) AS harvests,
       (SELECT count(*) FROM inventory_items WHERE farmer_id = $1) AS stock,
       (SELECT count(*) FROM alerts WHERE official_id = $2) AS alerts,
       (SELECT count(*) FROM calendar_tasks WHERE field_id IN (SELECT id FROM fields WHERE farmer_id = $1)) AS tasks`,
    [c.farmerId, c.officerId],
  );
  logger.info(counts.rows[0], 'demo seed complete');
  await pool.end();
}

main().catch((e) => {
  logger.fatal({ err: e }, 'demo seed failed');
  process.exit(1);
});
