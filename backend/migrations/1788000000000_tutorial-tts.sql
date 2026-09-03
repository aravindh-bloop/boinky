-- Up Migration

-- ── Module 5: tutorial + voice assistant onboarding ──

ALTER TABLE users
  ADD COLUMN onboarded_at      TIMESTAMPTZ,
  ADD COLUMN tutorial_progress JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Cache for synthesised speech, so replaying a tutorial step (or an assistant
-- reply) costs nothing. Keyed by a hash of the exact text + speaker; one row per
-- language. `audio` is the ordered list of base64 WAV chunks.
CREATE TABLE tts_cache (
  hash       TEXT NOT NULL,
  lang       TEXT NOT NULL,
  audio      JSONB NOT NULL,
  chars      INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (hash, lang)
);

-- Down Migration

DROP TABLE IF EXISTS tts_cache;
ALTER TABLE users
  DROP COLUMN IF EXISTS onboarded_at,
  DROP COLUMN IF EXISTS tutorial_progress;
