import { query, queryMaybe } from '../../db/query.js';
import { logger } from '../../lib/logger.js';
import { generateFarmBrief, type FarmBrief, type InsightCard } from '../../integrations/gemini.js';
import { translate } from '../../integrations/sarvam.js';
import { integrations } from '../../config/env.js';
import { getFieldRisk } from '../risk/risk.service.js';
import {
  buildFarmContext,
  contextDigest,
  contextForModel,
  isContextEmpty,
  type FarmContext,
} from './context.js';

const KIND = 'daily_brief';

export type BriefStatus = 'ready' | 'generating' | 'unavailable';

export interface DailyBrief {
  status: BriefStatus;
  /** Set when status is 'unavailable' — the UI shows an empty state, never generated filler. */
  reason?: 'no_fields' | 'ai_unavailable';
  forDate?: string;
  headline?: string;
  cards?: InsightCard[];
  language?: string;
  generatedAt?: string;
  /** True when the returned brief predates a material change and a refresh is running. */
  stale?: boolean;
}

interface InsightRow {
  for_date: string;
  headline: string;
  cards: InsightCard[];
  language: string;
  context_digest: string;
  created_at: string;
}

/** Farmers whose brief is being generated right now — prevents duplicate model calls. */
const inFlight = new Set<string>();

/**
 * Return today's brief, regenerating in the background when the underlying facts
 * have changed. Never blocks on the model: the first call for a farmer returns
 * `generating` and the client polls, matching how a scan advisory is delivered.
 */
export async function getDailyBrief(
  farmerId: string,
  opts: { fresh?: boolean } = {},
): Promise<DailyBrief> {
  if (!integrations.gemini) return { status: 'unavailable', reason: 'ai_unavailable' };

  const today = new Date().toISOString().slice(0, 10);
  const existing = await queryMaybe<InsightRow>(
    `SELECT to_char(for_date,'YYYY-MM-DD') AS for_date, headline, cards, language,
            context_digest, created_at
       FROM ai_insights
      WHERE farmer_id = $1 AND kind = $2 AND for_date = CURRENT_DATE`,
    [farmerId, KIND],
  );

  // Cheap staleness probe: cached weather only, so this stays a fast read path.
  const ctx = await buildFarmContext(farmerId, { liveWeather: false });
  if (isContextEmpty(ctx)) return { status: 'unavailable', reason: 'no_fields' };

  const digest = contextDigest(ctx);
  const upToDate = existing?.context_digest === digest;

  if (existing && upToDate && !opts.fresh) return ready(existing);

  void regenerate(farmerId).catch((err) =>
    logger.warn({ err, farmerId }, 'daily brief background generation failed'),
  );

  // Show the previous brief while the new one is produced rather than an empty screen.
  if (existing) return { ...ready(existing), stale: true };
  return { status: 'generating', forDate: today };
}

const ready = (r: InsightRow): DailyBrief => ({
  status: 'ready',
  forDate: r.for_date,
  headline: r.headline,
  cards: r.cards,
  language: r.language,
  generatedAt: new Date(r.created_at).toISOString(),
});

/**
 * Build a fresh context, generate the brief, localise it and persist it.
 * Safe to call concurrently — duplicate calls for the same farmer are dropped.
 */
export async function regenerate(farmerId: string): Promise<void> {
  if (inFlight.has(farmerId)) return;
  inFlight.add(farmerId);
  const started = Date.now();
  try {
    // A background job may take the live Open-Meteo call the request path avoids.
    await warmRiskSnapshots(farmerId);
    const ctx = await buildFarmContext(farmerId, { liveWeather: true });
    if (isContextEmpty(ctx)) return;

    const { brief, raw, model } = await generateFarmBrief(JSON.stringify(contextForModel(ctx)));
    const grounded = groundCards(brief, ctx);
    const localised = await localise(grounded, ctx.farmer.language);

    await query(
      `INSERT INTO ai_insights
         (farmer_id, kind, for_date, headline, cards, language, headline_en, cards_en,
          context_digest, context_snapshot, raw_model_response, model, generated_ms)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (farmer_id, kind, for_date) DO UPDATE SET
         headline = EXCLUDED.headline,
         cards = EXCLUDED.cards,
         language = EXCLUDED.language,
         headline_en = EXCLUDED.headline_en,
         cards_en = EXCLUDED.cards_en,
         context_digest = EXCLUDED.context_digest,
         context_snapshot = EXCLUDED.context_snapshot,
         raw_model_response = EXCLUDED.raw_model_response,
         model = EXCLUDED.model,
         generated_ms = EXCLUDED.generated_ms,
         created_at = now()`,
      [
        farmerId,
        KIND,
        localised.headline,
        JSON.stringify(localised.cards),
        localised.language,
        grounded.headline,
        JSON.stringify(grounded.cards),
        contextDigest(ctx),
        JSON.stringify(ctx),
        JSON.stringify(raw),
        model,
        Date.now() - started,
      ],
    );
    logger.info(
      { farmerId, ms: Date.now() - started, cards: grounded.cards.length, lang: localised.language },
      'daily brief generated',
    );
  } finally {
    inFlight.delete(farmerId);
  }
}

/**
 * Ensure every located field has today's risk snapshot before the context is built.
 * Without this the first brief of the day cannot reason about risk at all. The risk
 * module caches one snapshot per field per day, so this is a cheap no-op afterwards.
 */
async function warmRiskSnapshots(farmerId: string): Promise<void> {
  const fields = await query<{ id: string }>(
    `SELECT id FROM fields WHERE farmer_id = $1 AND location IS NOT NULL`,
    [farmerId],
  );
  await Promise.all(
    fields.map((f) =>
      getFieldRisk(f.id, farmerId).catch((err) =>
        logger.warn({ err, fieldId: f.id }, 'risk warm-up failed for field'),
      ),
    ),
  );
}

/**
 * Drop anything the model attached to a field that does not exist. The prompt
 * forbids invented field names; this makes that a guarantee rather than a hope.
 */
function groundCards(brief: FarmBrief, ctx: FarmContext): FarmBrief {
  const names = new Map(ctx.fields.map((f) => [f.name.toLowerCase(), f.name]));
  const cards = brief.cards.map((c) => {
    if (!c.fieldName) return c;
    const real = names.get(c.fieldName.trim().toLowerCase());
    if (real) return { ...c, fieldName: real };
    logger.warn({ fieldName: c.fieldName }, 'brief card referenced an unknown field — clearing');
    return { ...c, fieldName: null };
  });
  return { headline: brief.headline, cards };
}

const SEP = '\n@@@\n';

/**
 * Translate the brief into the farmer's language in one Sarvam call, falling back
 * to per-string calls if the delimiter does not survive, and to English if that
 * fails too. A partially translated brief is never persisted.
 */
async function localise(
  brief: FarmBrief,
  language: string,
): Promise<FarmBrief & { language: string }> {
  if (language === 'en-IN' || !integrations.sarvam) {
    return { ...brief, language: 'en-IN' };
  }

  const parts = [brief.headline, ...brief.cards.flatMap((c) => [c.title, c.body, c.basis])];
  try {
    const joined = await translate(parts.join(SEP), language);
    const out = joined.split(SEP).map((s) => s.trim());
    const pieces = out.length === parts.length ? out : await translateEach(parts, language);
    return { ...apply(brief, pieces), language };
  } catch (err) {
    logger.warn({ err, language }, 'brief localisation failed — keeping English');
    return { ...brief, language: 'en-IN' };
  }
}

async function translateEach(parts: string[], language: string): Promise<string[]> {
  logger.debug({ language }, 'brief batch translation lost its delimiters — translating per string');
  const out: string[] = [];
  for (const p of parts) out.push((await translate(p, language)).trim());
  return out;
}

function apply(brief: FarmBrief, pieces: string[]): FarmBrief {
  const [headline, ...rest] = pieces;
  const cards = brief.cards.map((c, i) => ({
    ...c,
    title: rest[i * 3] || c.title,
    body: rest[i * 3 + 1] || c.body,
    basis: rest[i * 3 + 2] || c.basis,
  }));
  return { headline: headline || brief.headline, cards };
}
