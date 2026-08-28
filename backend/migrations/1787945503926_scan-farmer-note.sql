-- Up Migration

-- The farmer's own description of the problem, spoken in their language and
-- transcribed by Sarvam (or typed). Fed to the vision model alongside the photo:
-- symptoms like "the lower leaves wilt at night" are invisible in a still image.
ALTER TABLE scans
  ADD COLUMN farmer_note          TEXT,
  ADD COLUMN farmer_note_language TEXT;

-- Down Migration
ALTER TABLE scans
  DROP COLUMN IF EXISTS farmer_note,
  DROP COLUMN IF EXISTS farmer_note_language;
