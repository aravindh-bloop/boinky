import { createHash } from 'node:crypto';
import { query, queryMaybe } from '../../db/query.js';
import { logger } from '../../lib/logger.js';
import { integrations } from '../../config/env.js';
import { distillFarmerProfile, type FarmerProfile } from '../../integrations/gemini.js';

/**
 * A rolling, model-written portrait of one farmer, distilled from an append-only
 * event log (`farmer_ai_events`). Every generative feature reads it as background
 * so its advice is personal — "you told me Mancozeb did not work", "you farm
 * organically", "your rice gets brown planthopper most years".
 *
 * Read path never blocks on the model: returns the cached row (or null the very
 * first time) and regenerates in the background when the event log has changed.
 */

const EVENT_WINDOW = 50;
const inFlight = new Set<string>();

export interface StoredProfile extends FarmerProfile {
  updatedAt: string;
}

/** Log something worth remembering. De-duplicates an identical line within the hour. */
export async function recordEvent(
  farmerId: string,
  kind: string,
  summary: string,
  refId?: string | null,
): Promise<void> {
  const line = summary.trim();
  if (!line) return;
  try {
    const dupe = await queryMaybe<{ id: string }>(
      `SELECT id FROM farmer_ai_events
        WHERE farmer_id = $1 AND kind = $2 AND summary = $3
          AND created_at > now() - interval '1 hour'
        LIMIT 1`,
      [farmerId, kind, line],
    );
    if (dupe) return;
    await query(
      `INSERT INTO farmer_ai_events (farmer_id, kind, ref_id, summary) VALUES ($1, $2, $3, $4)`,
      [farmerId, kind, refId ?? null, line],
    );
  } catch (err) {
    logger.warn({ err, farmerId, kind }, 'recordEvent failed (non-fatal)');
  }
}

export async function getFarmerProfile(farmerId: string): Promise<StoredProfile | null> {
  if (!integrations.gemini) return null;

  const events = await query<{ id: string; kind: string; summary: string; created_at: string }>(
    `SELECT id, kind, summary, to_char(created_at,'YYYY-MM-DD') AS created_at
       FROM farmer_ai_events WHERE farmer_id = $1
      ORDER BY created_at DESC LIMIT $2`,
    [farmerId, EVENT_WINDOW],
  );
  if (events.length === 0) return null;

  const digest = createHash('sha1')
    .update(events.map((e) => e.id).join(','))
    .digest('hex')
    .slice(0, 16);

  const existing = await queryMaybe<{
    summary: string;
    facts: Record<string, unknown>;
    source_digest: string;
    updated_at: string;
  }>(
    `SELECT summary, facts, source_digest, updated_at FROM farmer_ai_profile WHERE farmer_id = $1`,
    [farmerId],
  );

  if (existing && existing.source_digest === digest) {
    return { summary: existing.summary, facts: existing.facts, updatedAt: existing.updated_at };
  }

  // Stale (or missing) — regenerate in the background, serve what we have now.
  void regenerateProfile(farmerId, events, existing?.summary ? existing : null, digest).catch(
    (err) => logger.warn({ err, farmerId }, 'profile regen failed'),
  );

  return existing
    ? { summary: existing.summary, facts: existing.facts, updatedAt: existing.updated_at }
    : null;
}

async function regenerateProfile(
  farmerId: string,
  events: { kind: string; summary: string; created_at: string }[],
  prior: { summary: string; facts: Record<string, unknown> } | null,
  digest: string,
): Promise<void> {
  if (inFlight.has(farmerId)) return;
  inFlight.add(farmerId);
  const started = Date.now();
  try {
    const { profile, model } = await distillFarmerProfile(
      JSON.stringify(events.map((e) => ({ when: e.created_at, kind: e.kind, what: e.summary }))),
      prior ? JSON.stringify(prior) : null,
    );
    await query(
      `INSERT INTO farmer_ai_profile (farmer_id, summary, facts, source_digest, model)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (farmer_id) DO UPDATE SET
         summary = EXCLUDED.summary, facts = EXCLUDED.facts,
         source_digest = EXCLUDED.source_digest, model = EXCLUDED.model, updated_at = now()`,
      [farmerId, profile.summary, JSON.stringify(profile.facts), digest, model],
    );
    logger.info({ farmerId, ms: Date.now() - started }, 'farmer profile regenerated');
  } finally {
    inFlight.delete(farmerId);
  }
}
