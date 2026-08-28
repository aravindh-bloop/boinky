-- Up Migration

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ── Users (shared table; role distinguishes farmer vs official) ──
CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  phone              TEXT UNIQUE,
  email              TEXT UNIQUE,
  password_hash      TEXT NOT NULL,
  role               TEXT NOT NULL CHECK (role IN ('farmer', 'official')),
  preferred_language TEXT NOT NULL DEFAULT 'en',
  region             TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX users_role_idx   ON users (role);
CREATE INDEX users_region_idx ON users (region);

-- ── Fields (a farmer can have multiple plots) ──
CREATE TABLE fields (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT,
  crop       TEXT NOT NULL,
  variety    TEXT,
  sown_date  DATE,
  location   GEOGRAPHY(POINT, 4326),
  area_acres NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fields_farmer_idx   ON fields (farmer_id);
CREATE INDEX fields_location_idx ON fields USING GIST (location);

-- ── Scans (the core detection event) ──
CREATE TABLE scans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id           UUID REFERENCES fields(id) ON DELETE SET NULL,
  farmer_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url          TEXT NOT NULL,
  image_public_id    TEXT,
  diagnosis_label    TEXT,
  diagnosis_category TEXT,                       -- 'disease' | 'pest' | 'deficiency' | 'healthy' | 'unknown'
  affected_part      TEXT,
  confidence         NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  severity           TEXT CHECK (severity IN ('low', 'medium', 'high') OR severity IS NULL),
  raw_model_response JSONB,
  advisory_text      TEXT,
  advisory_language  TEXT,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'auto_confirmed', 'needs_validation',
                                         'validated', 'corrected', 'rejected')),
  validated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at       TIMESTAMPTZ,
  validation_note    TEXT,
  risk_score         NUMERIC,
  location           GEOGRAPHY(POINT, 4326),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX scans_farmer_idx   ON scans (farmer_id);
CREATE INDEX scans_field_idx    ON scans (field_id);
CREATE INDEX scans_status_idx   ON scans (status);
CREATE INDEX scans_created_idx  ON scans (created_at DESC);
CREATE INDEX scans_location_idx ON scans USING GIST (location);

-- ── Weather / risk snapshots (cached per field per day) ──
CREATE TABLE risk_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id     UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  temperature  NUMERIC,
  humidity     NUMERIC,
  rainfall_mm  NUMERIC,
  risk_level   TEXT CHECK (risk_level IN ('low', 'medium', 'high') OR risk_level IS NULL),
  risk_score   NUMERIC,
  risk_reason  TEXT,
  raw_weather  JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (field_id, date)
);
CREATE INDEX risk_snapshots_field_date_idx ON risk_snapshots (field_id, date DESC);

-- ── Regional alerts broadcast by officials ──
CREATE TABLE alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  official_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region      TEXT,
  crop        TEXT,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  severity    TEXT CHECK (severity IN ('low', 'medium', 'high') OR severity IS NULL),
  center      GEOGRAPHY(POINT, 4326),
  radius_km   NUMERIC,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX alerts_region_idx  ON alerts (region);
CREATE INDEX alerts_crop_idx    ON alerts (crop);
CREATE INDEX alerts_created_idx ON alerts (created_at DESC);

-- ── Crop calendar tasks (per field, per date) ──
CREATE TABLE calendar_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id    UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  task_date   DATE NOT NULL,
  task_type   TEXT,   -- irrigation | spraying | fertilizing | scouting | harvest
  title       TEXT NOT NULL,
  description TEXT,
  source      TEXT NOT NULL DEFAULT 'system',  -- system | official | scan_derived
  is_done     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX calendar_tasks_field_date_idx ON calendar_tasks (field_id, task_date);

-- ── Government schemes / subsidies catalogue ──
CREATE TABLE schemes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                TEXT NOT NULL,
  description          TEXT,
  eligibility_criteria JSONB,   -- e.g. {"crop": "cotton", "state": "Maharashtra"}
  benefit_amount       TEXT,
  apply_link           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Farmer inventory / stock ──
CREATE TABLE inventory_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_name     TEXT NOT NULL,
  item_type     TEXT,   -- seed | fertilizer | pesticide | equipment
  quantity      NUMERIC,
  unit          TEXT,
  low_stock_at  NUMERIC,
  purchase_date DATE,
  expiry_date   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX inventory_farmer_idx ON inventory_items (farmer_id);

-- ── Pesticide safety reference (PHI / residue checks) ──
CREATE TABLE pesticide_reference (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pesticide_name           TEXT NOT NULL,
  target_pest_or_disease   TEXT,
  crop                     TEXT,
  pre_harvest_interval_days INT,
  safe_dosage              TEXT,
  precautions              TEXT
);
CREATE INDEX pesticide_reference_name_idx ON pesticide_reference (lower(pesticide_name));

-- ── Reserved for future hardware pod integration (inactive this phase) ──
CREATE TABLE pod_readings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id       UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  soil_moisture  NUMERIC,
  soil_ph        NUMERIC,
  reading_source TEXT NOT NULL DEFAULT 'manual',  -- 'esp32' when hardware returns
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Down Migration

DROP TABLE IF EXISTS pod_readings;
DROP TABLE IF EXISTS pesticide_reference;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS schemes;
DROP TABLE IF EXISTS calendar_tasks;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS risk_snapshots;
DROP TABLE IF EXISTS scans;
DROP TABLE IF EXISTS fields;
DROP TABLE IF EXISTS users;
