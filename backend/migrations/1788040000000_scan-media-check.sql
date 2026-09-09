-- Up Migration

-- Per-photo verdict from the guided capture wizard's angle check (Gemini judges
-- each freshly-taken photo against the requested view before the farmer moves to
-- the next shot). See modules/scans + gemini.checkScanAngle.
ALTER TABLE scan_media
  ADD COLUMN check_status TEXT NOT NULL DEFAULT 'unchecked'
    CHECK (check_status IN ('unchecked', 'ok', 'weak', 'rejected')),
  ADD COLUMN check_note TEXT;

-- Down Migration

ALTER TABLE scan_media DROP COLUMN IF EXISTS check_status;
ALTER TABLE scan_media DROP COLUMN IF EXISTS check_note;
