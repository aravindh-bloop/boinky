-- Up Migration

-- ── Module 2: per-farmer AI personalisation + conversational assistant ──

-- Append-only log of things worth remembering about a farmer. Distilled into
-- farmer_ai_profile. Populated by hooks in the scan, correction, activity and
-- feedback paths — never by the model.
CREATE TABLE farmer_ai_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,          -- scan | correction | advisory_feedback | activity | insurance_claim | chat | manual
  ref_id     UUID,                   -- the scan / claim / thread this came from, if any
  summary    TEXT NOT NULL,          -- one plain sentence, English
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX farmer_ai_events_farmer_idx ON farmer_ai_events (farmer_id, created_at DESC);

-- A rolling, model-written portrait of the farmer's operation. One row per
-- farmer, regenerated when the event log changes materially.
CREATE TABLE farmer_ai_profile (
  farmer_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  summary       TEXT NOT NULL,       -- <= ~200 words, English, spoken style
  facts         JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {crops[], productsFailed[], prefersOrganic, hasPod, ...}
  source_digest TEXT NOT NULL,
  model         TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Ask AgriPod" conversational assistant.
CREATE TABLE assistant_threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'New question',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX assistant_threads_farmer_idx ON assistant_threads (farmer_id, last_message_at DESC);

CREATE TABLE assistant_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID NOT NULL REFERENCES assistant_threads(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  body       TEXT NOT NULL,
  body_en    TEXT,                   -- the assistant's English draft, before localisation
  helpful    BOOLEAN,                -- 👍 / 👎 on an assistant message
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX assistant_messages_thread_idx ON assistant_messages (thread_id, created_at);

-- 👍 / 👎 on a scan advisory, feeding the profile.
ALTER TABLE scans ADD COLUMN advisory_helpful BOOLEAN;

-- Down Migration

ALTER TABLE scans DROP COLUMN IF EXISTS advisory_helpful;
DROP TABLE IF EXISTS assistant_messages;
DROP TABLE IF EXISTS assistant_threads;
DROP TABLE IF EXISTS farmer_ai_profile;
DROP TABLE IF EXISTS farmer_ai_events;
