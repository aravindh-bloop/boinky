-- Up Migration

-- ── Generated AI insight sets (daily brief today; weekly digest / follow-ups later) ──
-- One row per farmer per kind per day. `context_snapshot` stores the exact real-world
-- inputs the model was given, and `context_digest` lets us detect that the underlying
-- facts changed (new scan, risk shift, task completed) and the brief needs regenerating.
CREATE TABLE ai_insights (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL DEFAULT 'daily_brief',
  for_date           DATE NOT NULL,
  headline           TEXT NOT NULL,
  cards              JSONB NOT NULL,
  language           TEXT NOT NULL DEFAULT 'en-IN',
  headline_en        TEXT,
  cards_en           JSONB,
  context_digest     TEXT NOT NULL,
  context_snapshot   JSONB NOT NULL,
  raw_model_response JSONB,
  model              TEXT,
  generated_ms       INT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (farmer_id, kind, for_date)
);
CREATE INDEX ai_insights_farmer_idx ON ai_insights (farmer_id, kind, for_date DESC);

-- Down Migration
DROP TABLE IF EXISTS ai_insights;
