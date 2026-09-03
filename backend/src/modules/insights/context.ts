import { createHash } from 'node:crypto';
import { query, queryOne } from '../../db/query.js';
import { getUserById } from '../auth/auth.service.js';
import { getFarmerTasks } from '../farm/tasks.service.js';
import { getWeather } from '../weather/weather.service.js';
import { listFarmerAlerts } from '../alerts/alerts.service.js';
import { getNearbyOutbreaksForFarmer } from '../hotspots/hotspots.service.js';
import { toSarvamLang } from '../../integrations/sarvam.js';
import { getFarmerProfile } from './profile.service.js';

/**
 * A single, honest snapshot of everything we actually know about one farmer's
 * operation, assembled from the database and Open-Meteo only.
 *
 * This is the sole input to every generative feature (the daily brief today; the
 * conversational agent, weekly digest and follow-up reasoning later). Nothing in
 * here is invented or defaulted — a fact we do not have is null or an empty
 * array, and callers render an empty state rather than ask a model to fill the gap.
 */
export interface FarmContext {
  today: string;
  farmer: {
    name: string;
    region: string | null;
    language: string;
    fieldCount: number;
  };
  fields: ContextField[];
  weather: ContextWeather | null;
  tasks: {
    overdue: ContextTask[];
    today: ContextTask[];
    upcomingCount: number;
    nextUpcoming: ContextTask[];
  };
  recentScans: ContextScan[];
  recentActivities: ContextActivity[];
  nearbyOutbreaks: {
    radiusKm: number;
    days: number;
    count: number;
    nearestKm: number | null;
    topDiagnoses: { label: string | null; count: number }[];
  } | null;
  officialAlerts: {
    title: string;
    message: string;
    severity: string | null;
    matchReason: string | null;
    daysAgo: number;
  }[];
  inventory: {
    lowStock: { name: string; type: string | null; quantity: number | null; unit: string | null }[];
    expiringSoon: { name: string; expiryDate: string; daysLeft: number }[];
  };
  finance: { spent: number; revenue: number; net: number; windowDays: number };
  /** A rolling portrait of how this farmer farms (Module 2). Null until there is history. */
  farmerProfile: { summary: string; facts: Record<string, unknown> } | null;
}

export interface ContextField {
  id: string;
  name: string;
  crop: string;
  variety: string | null;
  daysSinceSown: number | null;
  areaAcres: number | null;
  hasLocation: boolean;
  riskLevel: 'low' | 'medium' | 'high' | null;
  riskScore: number | null;
  riskReason: string | null;
  riskDate: string | null;
}

export interface ContextTask {
  title: string;
  taskType: string | null;
  fieldName: string | null;
  date: string;
  daysOverdue?: number;
}

export interface ContextScan {
  id: string;
  label: string | null;
  category: string | null;
  severity: string | null;
  confidence: number | null;
  status: string;
  fieldName: string | null;
  daysAgo: number;
}

export interface ContextActivity {
  kind: string;
  title: string;
  inputName: string | null;
  fieldName: string | null;
  daysAgo: number;
}

export interface ContextWeather {
  place: string | null;
  current: { tempC: number | null; humidityPct: number | null; condition: string };
  days: {
    date: string;
    condition: string;
    tempMinC: number | null;
    tempMaxC: number | null;
    precipMm: number | null;
    precipProbPct: number | null;
    windMaxKph: number | null;
  }[];
  advisories: { title: string; detail: string; severity: string }[];
  sprayWindow: { start: string; end: string; hours: number } | null;
}

/**
 * Build the context. `liveWeather` controls whether an Open-Meteo call is allowed
 * (safe from a background job, avoided on a latency-sensitive request path).
 */
export async function buildFarmContext(
  farmerId: string,
  opts: { liveWeather?: boolean } = {},
): Promise<FarmContext> {
  const live = opts.liveWeather ?? true;

  const [me, fields, tasks, scans, activities, nearby, alerts, lowStock, expiring, finance, w, profile] =
    await Promise.all([
      getUserById(farmerId),
      contextFields(farmerId),
      getFarmerTasks(farmerId, 7),
      contextScans(farmerId),
      contextActivities(farmerId),
      getNearbyOutbreaksForFarmer(farmerId).catch(() => null),
      listFarmerAlerts({ farmerId, limit: 5 }).catch(() => []),
      lowStockItems(farmerId),
      expiringItems(farmerId),
      financeSnapshot(farmerId),
      getWeather({ farmerId, cachedOnly: !live }).catch(() => null),
      getFarmerProfile(farmerId).catch(() => null),
    ]);

  const today = new Date().toISOString().slice(0, 10);

  return {
    today,
    farmer: {
      name: me.name,
      region: me.region,
      language: toSarvamLang(me.preferred_language),
      fieldCount: fields.length,
    },
    fields,
    weather: w
      ? {
          place: w.place.label,
          current: {
            tempC: w.current.tempC,
            humidityPct: w.current.humidityPct,
            condition: w.current.condition,
          },
          days: w.daily.slice(0, 4).map((d) => ({
            date: d.date,
            condition: d.condition,
            tempMinC: d.tempMinC,
            tempMaxC: d.tempMaxC,
            precipMm: d.precipMm,
            precipProbPct: d.precipProbPct,
            windMaxKph: d.windMaxKph,
          })),
          advisories: w.advisories.map((a) => ({
            title: a.title,
            detail: a.detail,
            severity: a.severity,
          })),
          sprayWindow: w.sprayWindow,
        }
      : null,
    tasks: {
      overdue: tasks.overdue.map((t) => ({
        title: t.title,
        taskType: t.task_type,
        fieldName: t.field_name,
        date: t.task_date,
        daysOverdue: daysBetween(t.task_date, today),
      })),
      today: tasks.today.map(toContextTask),
      upcomingCount: tasks.counts.upcoming,
      nextUpcoming: tasks.upcoming.slice(0, 5).map(toContextTask),
    },
    recentScans: scans,
    recentActivities: activities,
    nearbyOutbreaks: nearby && nearby.count > 0 ? nearby : null,
    officialAlerts: alerts.map((a) => ({
      title: a.title,
      message: a.message,
      severity: a.severity,
      matchReason: (a as { match_reason?: string | null }).match_reason ?? null,
      daysAgo: daysBetween(String(a.created_at).slice(0, 10), today),
    })),
    inventory: { lowStock, expiringSoon: expiring },
    finance: { ...finance, windowDays: 180 },
    farmerProfile: profile ? { summary: profile.summary, facts: profile.facts } : null,
  };
}

const toContextTask = (t: {
  title: string;
  task_type: string | null;
  field_name: string | null;
  task_date: string;
}): ContextTask => ({
  title: t.title,
  taskType: t.task_type,
  fieldName: t.field_name,
  date: t.task_date,
});

/** Fields plus their latest risk snapshot, one query. */
async function contextFields(farmerId: string): Promise<ContextField[]> {
  return query<ContextField>(
    `SELECT f.id,
            coalesce(f.name, f.crop) AS name,
            f.crop,
            f.variety,
            CASE WHEN f.sown_date IS NULL THEN NULL ELSE (CURRENT_DATE - f.sown_date) END AS "daysSinceSown",
            f.area_acres::float AS "areaAcres",
            (f.location IS NOT NULL) AS "hasLocation",
            s.risk_level AS "riskLevel",
            s.risk_score::float AS "riskScore",
            s.risk_reason AS "riskReason",
            to_char(s.date,'YYYY-MM-DD') AS "riskDate"
       FROM fields f
       LEFT JOIN LATERAL (
         SELECT risk_level, risk_score, risk_reason, date FROM risk_snapshots
          WHERE field_id = f.id ORDER BY date DESC LIMIT 1
       ) s ON true
      WHERE f.farmer_id = $1
      ORDER BY f.created_at`,
    [farmerId],
  );
}

/** The last 5 scans, with how long ago and which field. */
async function contextScans(farmerId: string): Promise<ContextScan[]> {
  return query<ContextScan>(
    `SELECT s.id,
            s.diagnosis_label AS label,
            s.diagnosis_category AS category,
            s.severity,
            s.confidence::float AS confidence,
            s.status,
            coalesce(f.name, f.crop) AS "fieldName",
            (CURRENT_DATE - s.created_at::date) AS "daysAgo"
       FROM scans s
       LEFT JOIN fields f ON f.id = s.field_id
      WHERE s.farmer_id = $1
      ORDER BY s.created_at DESC
      LIMIT 5`,
    [farmerId],
  );
}

/**
 * What the farmer has actually done recently. Without this the model happily
 * recommends a spray they carried out yesterday.
 */
async function contextActivities(farmerId: string): Promise<ContextActivity[]> {
  return query<ContextActivity>(
    `SELECT a.kind,
            a.title,
            a.input_name AS "inputName",
            coalesce(f.name, f.crop) AS "fieldName",
            (CURRENT_DATE - a.activity_date) AS "daysAgo"
       FROM activities a
       LEFT JOIN fields f ON f.id = a.field_id
      WHERE a.farmer_id = $1 AND a.activity_date > CURRENT_DATE - 21
      ORDER BY a.activity_date DESC
      LIMIT 8`,
    [farmerId],
  );
}

async function lowStockItems(farmerId: string) {
  return query<{ name: string; type: string | null; quantity: number | null; unit: string | null }>(
    `SELECT item_name AS name, item_type AS type, quantity::float AS quantity, unit
       FROM inventory_items
      WHERE farmer_id = $1 AND low_stock_at IS NOT NULL AND quantity IS NOT NULL
        AND quantity <= low_stock_at
      ORDER BY item_name`,
    [farmerId],
  );
}

async function expiringItems(farmerId: string) {
  return query<{ name: string; expiryDate: string; daysLeft: number }>(
    `SELECT item_name AS name,
            to_char(expiry_date,'YYYY-MM-DD') AS "expiryDate",
            (expiry_date - CURRENT_DATE) AS "daysLeft"
       FROM inventory_items
      WHERE farmer_id = $1 AND expiry_date IS NOT NULL
        AND expiry_date <= CURRENT_DATE + 30
      ORDER BY expiry_date`,
    [farmerId],
  );
}

async function financeSnapshot(farmerId: string) {
  const row = await queryOne<{ spent: number; revenue: number }>(
    `SELECT
       (SELECT coalesce(sum(amount),0)::float FROM expenses
         WHERE farmer_id = $1 AND spent_on > now() - interval '180 days') AS spent,
       (SELECT coalesce(sum(revenue),0)::float FROM harvests
         WHERE farmer_id = $1 AND harvested_on > now() - interval '180 days') AS revenue`,
    [farmerId],
  );
  return { spent: row.spent, revenue: row.revenue, net: row.revenue - row.spent };
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

/**
 * Fingerprint of the *material* facts in a context.
 *
 * Deliberately coarse: the current temperature ticks every few minutes and must
 * not trigger a regeneration, but a new scan, a risk level change, a completed
 * task or a fresh outbreak must. Comparing this against the stored digest is how
 * we decide a cached brief has gone stale.
 *
 * Weather is reduced to the advice-relevant signals only — the derived advisory
 * titles plus a coarse "rain in the next two days" / "hot day ahead" flag. The
 * raw per-day forecast is deliberately excluded: Open-Meteo revises it through
 * the day, and the staleness probe (cached weather) and the regeneration (live
 * weather) would otherwise disagree and churn the brief on every visit.
 */
export function contextDigest(ctx: FarmContext): string {
  const days = ctx.weather?.days ?? [];
  const near = days.slice(0, 2);
  const material = {
    date: ctx.today,
    lang: ctx.farmer.language,
    // riskLevel (low/medium/high), not the raw score — a 43→46 wobble must not
    // regenerate the brief, but a level crossing must.
    fields: ctx.fields.map((f) => [f.id, f.crop, f.daysSinceSown, f.riskLevel]),
    overdue: ctx.tasks.overdue.map((t) => `${t.date}:${t.title}`),
    today: ctx.tasks.today.map((t) => `${t.date}:${t.title}`),
    scans: ctx.recentScans.map((s) => s.id),
    activities: ctx.recentActivities.map((a) => `${a.daysAgo}:${a.kind}:${a.title}`),
    outbreaks: ctx.nearbyOutbreaks?.count ?? 0,
    alerts: ctx.officialAlerts.map((a) => a.title),
    lowStock: ctx.inventory.lowStock.map((i) => i.name),
    expiring: ctx.inventory.expiringSoon.map((i) => i.name),
    advisories: ctx.weather?.advisories.map((a) => a.title),
    wetSoon: near.some((d) => (d.precipMm ?? 0) >= 8 || (d.precipProbPct ?? 0) >= 60),
    hotSoon: near.some((d) => (d.tempMaxC ?? 0) >= 38),
    profile: ctx.farmerProfile?.summary ?? null,
  };
  return createHash('sha256').update(JSON.stringify(material)).digest('hex').slice(0, 32);
}

/** True when there is genuinely nothing to reason about. */
export function isContextEmpty(ctx: FarmContext): boolean {
  return ctx.fields.length === 0;
}

/**
 * The context as the model should see it: internal identifiers stripped.
 *
 * Field and scan UUIDs mean nothing to a farmer, and the model will cheerfully
 * quote them into a card's farmer-visible "basis" line. Field *names* stay, since
 * grounding depends on them. The full context, ids included, is still what we
 * persist as the audit snapshot.
 */
export function contextForModel(ctx: FarmContext): unknown {
  return {
    ...ctx,
    fields: ctx.fields.map(({ id: _id, ...rest }) => rest),
    recentScans: ctx.recentScans.map(({ id: _id, ...rest }) => ({
      ...rest,
      // Spelled out rather than left null: the model quotes this straight into the
      // farmer-visible "basis" line, and "fieldName is null" is not a sentence.
      fieldName: rest.fieldName ?? 'not linked to any field',
    })),
  };
}
