-- Up Migration

-- ── Module 4 (pivot): PMFBY claim TRACKER + escalation ──
-- AgriPod no longer runs its own claim intake / AI assessment / payout (that
-- re-implemented the government's DigiClaim pipeline). It now sits on top of
-- PMFBY as a transparency + escalation layer:
--   * the farmer records the PMFBY policy they already hold,
--   * tracks a claim through the six real stages, farmer-reported (Phase 0),
--   * every stage is timed against the published PMFBY SLA,
--   * a stuck / rejected claim is routed to the correct officer for that
--     district and stage, with a pre-filled bilingual grievance.
-- See docs/INSURANCE_TRACKER.md.

DROP TABLE IF EXISTS insurance_claim_events CASCADE;
DROP TABLE IF EXISTS insurance_claim_media CASCADE;
DROP TABLE IF EXISTS insurance_claims CASCADE;
DROP TABLE IF EXISTS insurance_policies CASCADE;
-- schemes.kind is kept — it categorises schemes for the subsidy module too.

-- The PMFBY policy the farmer holds, as taken from their acknowledgement slip /
-- enrolment SMS (or, later, verified against NCIP).
CREATE TABLE insurance_policy_ref (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_id         UUID REFERENCES fields(id) ON DELETE SET NULL,
  application_no   TEXT,                       -- PMFBY application / receipt no.
  season           TEXT NOT NULL,              -- 'Kharif 2026'
  crop             TEXT NOT NULL,
  insurance_unit   TEXT,                       -- notified village / panchayat unit
  insurer_name     TEXT,
  sum_insured      NUMERIC,
  premium_paid     NUMERIC,
  area_acres       NUMERIC,
  district         TEXT,
  source           TEXT NOT NULL DEFAULT 'manual'
                     CHECK (source IN ('manual', 'ocr', 'ncip')),
  ncip_verified_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX insurance_policy_ref_farmer_idx ON insurance_policy_ref (farmer_id);

-- Curated directory of escalation contacts. district = NULL → a statewide /
-- national channel (KRPH, CPGRAMS, Ombudsman, State Directorate). Admin-
-- maintained from the officer dashboard; `verified` + `last_verified` track
-- whether a human has confirmed the row against a public source.
CREATE TABLE officer_directory (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district      TEXT,
  rung          TEXT NOT NULL CHECK (rung IN (
                  'block', 'district', 'dgrc', 'state', 'ombudsman', 'krph', 'cpgrams')),
  designation   TEXT NOT NULL,
  name          TEXT,
  office        TEXT,
  phone         TEXT,
  email         TEXT,
  url           TEXT,
  note          TEXT,
  verified      BOOLEAN NOT NULL DEFAULT false,
  last_verified DATE,
  updated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX officer_directory_lookup_idx ON officer_directory (district, rung);
CREATE UNIQUE INDEX officer_directory_uniq_idx
  ON officer_directory (COALESCE(district, ''), rung, designation);

-- One tracked claim against a policy. `stage` is farmer-reported in Phase 0 —
-- the SLA maths is computed from `stage_since`, never stored.
CREATE TABLE claim_track (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_ref_id             UUID NOT NULL REFERENCES insurance_policy_ref(id) ON DELETE CASCADE,
  farmer_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  docket_id                 TEXT,              -- intimation / docket no. from the govt channel
  cause                     TEXT NOT NULL CHECK (cause IN (
                              'flood', 'drought', 'pest_disease', 'hailstorm', 'cyclone',
                              'fire', 'unseasonal_rain', 'frost', 'prevented_sowing', 'other')),
  loss_type                 TEXT NOT NULL DEFAULT 'localised' CHECK (loss_type IN (
                              'localised', 'widespread', 'post_harvest', 'prevented_sowing', 'mid_season')),
  incident_date             DATE,
  stage                     TEXT NOT NULL DEFAULT 'intimation' CHECK (stage IN (
                              'intimation', 'survey', 'assessment', 'approval', 'payout', 'closed')),
  stage_since               DATE NOT NULL DEFAULT CURRENT_DATE,
  outcome                   TEXT CHECK (outcome IN ('approved', 'rejected', 'partial', 'pending')),
  amount_expected           NUMERIC,
  amount_paid               NUMERIC,
  paid_on                   DATE,
  farmer_estimated_loss_pct INT,
  note                      TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX claim_track_farmer_idx ON claim_track (farmer_id, updated_at DESC);
CREATE INDEX claim_track_policy_idx ON claim_track (policy_ref_id);

-- Timeline entries. Written by the farmer today; by an SMS / NCIP sync later.
CREATE TABLE claim_track_event (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id   UUID NOT NULL REFERENCES claim_track(id) ON DELETE CASCADE,
  source     TEXT NOT NULL DEFAULT 'farmer'
               CHECK (source IN ('farmer', 'officer', 'sms', 'ncip', 'system')),
  kind       TEXT NOT NULL CHECK (kind IN (
               'stage_change', 'note', 'docket', 'payment', 'escalation')),
  from_stage TEXT,
  to_stage   TEXT,
  body       TEXT,
  at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX claim_track_event_claim_idx ON claim_track_event (claim_id, at);

-- Escalations routed out of AgriPod. The one place we write on the farmer's
-- behalf. `external_ref` is the KRPH docket / CPGRAMS registration the farmer
-- gets back; officers pick escalations up in the dashboard.
CREATE TABLE escalation (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id      UUID NOT NULL REFERENCES claim_track(id) ON DELETE CASCADE,
  farmer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  district      TEXT,
  rung          TEXT NOT NULL CHECK (rung IN (
                  'block', 'district', 'dgrc', 'state', 'ombudsman', 'krph', 'cpgrams')),
  directory_id  UUID REFERENCES officer_directory(id) ON DELETE SET NULL,
  channel       TEXT NOT NULL CHECK (channel IN (
                  'call', 'sms', 'email', 'krph', 'cpgrams', 'in_person')),
  reason        TEXT NOT NULL,
  letter_en     TEXT,
  letter_ta     TEXT,
  external_ref  TEXT,
  status        TEXT NOT NULL DEFAULT 'drafted' CHECK (status IN (
                  'drafted', 'sent', 'acknowledged', 'in_progress', 'resolved', 'closed')),
  officer_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  officer_note  TEXT,
  sent_at       TIMESTAMPTZ,
  last_nudge_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX escalation_district_idx ON escalation (district, status);
CREATE INDEX escalation_farmer_idx ON escalation (farmer_id, created_at DESC);

-- Down Migration

DROP TABLE IF EXISTS escalation;
DROP TABLE IF EXISTS claim_track_event;
DROP TABLE IF EXISTS claim_track;
DROP TABLE IF EXISTS officer_directory;
DROP TABLE IF EXISTS insurance_policy_ref;
