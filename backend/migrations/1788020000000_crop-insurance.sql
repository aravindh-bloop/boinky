-- Up Migration

-- ── Module 4: crop insurance ──
-- A farmer enrols a field under an insurance scheme, files a claim when damage
-- occurs (cause + evidence photos/videos + optional link to a diagnosis scan),
-- and tracks it through review to payout. Officers work the claims district-
-- scoped, exactly like the subsidy applications.

ALTER TABLE schemes
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'subsidy'
    CHECK (kind IN ('subsidy', 'insurance', 'credit'));

CREATE TABLE insurance_policies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_id      UUID REFERENCES fields(id) ON DELETE SET NULL,
  scheme_id     UUID REFERENCES schemes(id) ON DELETE SET NULL,
  crop          TEXT NOT NULL,
  season        TEXT NOT NULL,                 -- e.g. 'Kharif 2026'
  sum_insured   NUMERIC,
  premium_paid  NUMERIC,
  area_acres    NUMERIC,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'lapsed', 'expired')),
  start_date    DATE,
  end_date      DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX insurance_policies_farmer_idx ON insurance_policies (farmer_id);

CREATE TABLE insurance_claims (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id          UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
  farmer_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_id           UUID REFERENCES fields(id) ON DELETE SET NULL,
  scan_id            UUID REFERENCES scans(id) ON DELETE SET NULL,
  cause              TEXT NOT NULL CHECK (cause IN (
                       'flood','drought','pest_disease','hailstorm','cyclone',
                       'fire','unseasonal_rain','frost','other')),
  description        TEXT,
  incident_date      DATE,
  estimated_loss_pct INT,                      -- farmer's own estimate
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                       'draft','submitted','under_review','surveyor_assigned',
                       'approved','rejected','paid')),
  officer_note       TEXT,
  approved_amount    NUMERIC,
  assessed_loss_pct  INT,                      -- officer's figure
  ai_assessment      JSONB,                    -- officer-facing draft (labelled AI estimate)
  district           TEXT,
  reviewed_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  submitted_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX insurance_claims_farmer_idx ON insurance_claims (farmer_id, updated_at DESC);
CREATE INDEX insurance_claims_status_idx ON insurance_claims (status);
CREATE INDEX insurance_claims_district_idx ON insurance_claims (district);

CREATE TABLE insurance_claim_media (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id   UUID NOT NULL REFERENCES insurance_claims(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo', 'video')),
  url        TEXT NOT NULL,
  public_id  TEXT,
  caption    TEXT,
  lat        DOUBLE PRECISION,
  lng        DOUBLE PRECISION,
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX insurance_claim_media_claim_idx ON insurance_claim_media (claim_id, position);

-- The farmer-visible progress timeline. Also carries the farmer <-> officer
-- conversation (kind = 'message'), so the claim has one unified thread.
CREATE TABLE insurance_claim_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id    UUID NOT NULL REFERENCES insurance_claims(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role  TEXT NOT NULL CHECK (actor_role IN ('farmer', 'official', 'system')),
  kind        TEXT NOT NULL CHECK (kind IN (
                'created','submitted','status_change','note','message','media_added')),
  from_status TEXT,
  to_status   TEXT,
  body        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX insurance_claim_events_claim_idx ON insurance_claim_events (claim_id, created_at);

-- Down Migration

DROP TABLE IF EXISTS insurance_claim_events;
DROP TABLE IF EXISTS insurance_claim_media;
DROP TABLE IF EXISTS insurance_claims;
DROP TABLE IF EXISTS insurance_policies;
ALTER TABLE schemes DROP COLUMN IF EXISTS kind;
