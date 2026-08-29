-- Up Migration

-- Every unique English string the backend generates (calendar task titles, weather
-- advisories, alert reasoning) or the app UI catalog is translated once via Sarvam
-- and reused. Keyed by a hash of the source so lookups are cheap.
CREATE TABLE translation_cache (
  source_hash TEXT NOT NULL,
  lang        TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translated  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_hash, lang)
);

-- Down Migration
DROP TABLE IF EXISTS translation_cache;
