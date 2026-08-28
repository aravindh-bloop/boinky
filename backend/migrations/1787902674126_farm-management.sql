-- Up Migration

-- ── Farm activity log (operations the farmer performed) ──
CREATE TABLE activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_id      UUID REFERENCES fields(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL,   -- irrigation | spraying | fertilizing | sowing | weeding | scouting | other
  title         TEXT NOT NULL,
  note          TEXT,
  input_name    TEXT,            -- e.g. pesticide / fertiliser used
  quantity      NUMERIC,
  unit          TEXT,
  cost          NUMERIC,         -- optional inline cost, rolled into expenses view
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source_task_id UUID REFERENCES calendar_tasks(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activities_farmer_date_idx ON activities (farmer_id, activity_date DESC);
CREATE INDEX activities_field_idx ON activities (field_id);

-- ── Input costs / expenses ──
CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_id     UUID REFERENCES fields(id) ON DELETE SET NULL,
  category     TEXT NOT NULL,   -- seed | fertilizer | pesticide | labour | machinery | irrigation | transport | other
  description  TEXT,
  amount       NUMERIC NOT NULL CHECK (amount >= 0),
  spent_on     DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_id  UUID REFERENCES activities(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX expenses_farmer_date_idx ON expenses (farmer_id, spent_on DESC);
CREATE INDEX expenses_field_idx ON expenses (field_id);

-- ── Harvest / yield records (money in) ──
CREATE TABLE harvests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_id      UUID REFERENCES fields(id) ON DELETE SET NULL,
  harvested_on  DATE NOT NULL DEFAULT CURRENT_DATE,
  crop          TEXT,
  quantity      NUMERIC NOT NULL CHECK (quantity >= 0),
  unit          TEXT NOT NULL DEFAULT 'quintal',
  unit_price    NUMERIC,
  revenue       NUMERIC,
  buyer         TEXT,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX harvests_farmer_idx ON harvests (farmer_id, harvested_on DESC);
CREATE INDEX harvests_field_idx ON harvests (field_id);

-- ── Daily forecast cache (avoid hammering Open-Meteo) ──
CREATE TABLE weather_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_key    TEXT NOT NULL,          -- rounded "lat,lng"
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload     JSONB NOT NULL,
  UNIQUE (grid_key)
);

-- Down Migration
DROP TABLE IF EXISTS weather_cache;
DROP TABLE IF EXISTS harvests;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS activities;
