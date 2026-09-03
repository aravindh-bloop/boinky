-- Up Migration

-- ── Module 1: multi-angle "resource verification" scan ──
-- One photo of a leaf is not enough to diagnose a plant. A scan now carries a
-- guided set — whole plant, affected close-up, leaf underside, stem/base,
-- fruit/panicle, a wide field view, and optionally a short video. Gemini
-- diagnoses the whole set in one call and reports coverage gaps.
--
-- scans.image_url stays as the cover image (the whole-plant shot, or the first
-- media) so every existing read path keeps working.

CREATE TABLE scan_media (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id      UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN (
                 'whole_plant','affected_closeup','leaf_underside',
                 'stem_base','fruit_panicle','field_wide','video','extra')),
  url          TEXT NOT NULL,
  public_id    TEXT,
  resource     TEXT NOT NULL DEFAULT 'image' CHECK (resource IN ('image','video')),
  width        INT,
  height       INT,
  bytes        INT,
  format       TEXT,
  duration_s   NUMERIC,
  position     INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX scan_media_scan_idx ON scan_media (scan_id, position);

-- A scan can now exist in a 'draft' state while the farmer captures the set.
-- Draft scans have no diagnosis yet and are excluded from every feed / queue /
-- hotspot query (all of which already filter on concrete statuses, but the
-- check constraint needs widening).
ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_status_check;
ALTER TABLE scans ADD CONSTRAINT scans_status_check CHECK (status IN (
  'draft','pending','auto_confirmed','needs_validation','validated','corrected','rejected'));

ALTER TABLE scans
  ADD COLUMN image_quality  TEXT,          -- good | partial | poor  (from the set diagnosis)
  ADD COLUMN coverage_gaps  JSONB,         -- string[] of missing / unusable views
  ADD COLUMN submitted_at   TIMESTAMPTZ;   -- when the draft was finalised for diagnosis

-- Down Migration

ALTER TABLE scans
  DROP COLUMN IF EXISTS image_quality,
  DROP COLUMN IF EXISTS coverage_gaps,
  DROP COLUMN IF EXISTS submitted_at;

ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_status_check;
ALTER TABLE scans ADD CONSTRAINT scans_status_check CHECK (status IN (
  'pending','auto_confirmed','needs_validation','validated','corrected','rejected'));

DROP TABLE IF EXISTS scan_media;
