-- Up Migration

ALTER TABLE pesticide_reference
  ADD COLUMN active_ingredient TEXT,
  ADD COLUMN source TEXT NOT NULL DEFAULT 'curated'
    CHECK (source IN ('curated', 'ai_estimate', 'official')),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- One reference row per (pesticide, crop). crop NULL = applies to any crop.
CREATE UNIQUE INDEX pesticide_reference_name_crop_uniq
  ON pesticide_reference (lower(pesticide_name), lower(coalesce(crop, '*')));

-- Down Migration

DROP INDEX IF EXISTS pesticide_reference_name_crop_uniq;
ALTER TABLE pesticide_reference
  DROP COLUMN IF EXISTS active_ingredient,
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS updated_at;
