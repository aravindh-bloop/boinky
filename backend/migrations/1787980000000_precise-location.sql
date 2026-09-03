-- Up Migration

-- ── Module 3: exact coordinates + district-wise identification ──
-- A city name is too coarse for outbreak tracking and officer scoping. Every
-- field and every scan now carries its GPS accuracy and its resolved
-- administrative area (state / district / sub-district / village).

ALTER TABLE users
  ADD COLUMN district TEXT;
CREATE INDEX users_district_idx ON users (district);

ALTER TABLE fields
  ADD COLUMN location_accuracy_m NUMERIC,
  ADD COLUMN district            TEXT,
  ADD COLUMN subdistrict         TEXT,
  ADD COLUMN village             TEXT,
  ADD COLUMN admin_resolved_at   TIMESTAMPTZ;
CREATE INDEX fields_district_idx ON fields (district);

ALTER TABLE scans
  ADD COLUMN location_accuracy_m NUMERIC,
  ADD COLUMN district            TEXT;
CREATE INDEX scans_district_idx ON scans (district);

-- ── Reverse-geocode cache ──
-- Keyed by lat/lng rounded to 3 decimal places (~110 m cells). The resolver
-- (BigDataCloud reverse-geocode, keyless + free; PostGIS admin_areas when
-- seeded) writes here once per cell and every later lookup is a table read.
CREATE TABLE geocode_cache (
  lat_key     NUMERIC(6,3) NOT NULL,
  lng_key     NUMERIC(6,3) NOT NULL,
  state       TEXT,
  district    TEXT,
  subdistrict TEXT,
  village     TEXT,
  source      TEXT NOT NULL DEFAULT 'bigdatacloud',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lat_key, lng_key)
);

-- ── Optional authoritative boundary set ──
-- Left empty by default. If an India district/taluk boundary GeoJSON is seeded
-- here (scripts/seed-admin-areas.ts), resolveAdmin() prefers an offline
-- ST_Contains lookup over the network call.
CREATE TABLE admin_areas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level       TEXT NOT NULL,                 -- 'state' | 'district' | 'subdistrict'
  name        TEXT NOT NULL,
  parent_name TEXT,
  state       TEXT,
  geom        GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX admin_areas_geom_idx  ON admin_areas USING GIST (geom);
CREATE INDEX admin_areas_level_idx ON admin_areas (level);

-- Down Migration

DROP TABLE IF EXISTS admin_areas;
DROP TABLE IF EXISTS geocode_cache;

DROP INDEX IF EXISTS scans_district_idx;
ALTER TABLE scans
  DROP COLUMN IF EXISTS location_accuracy_m,
  DROP COLUMN IF EXISTS district;

DROP INDEX IF EXISTS fields_district_idx;
ALTER TABLE fields
  DROP COLUMN IF EXISTS location_accuracy_m,
  DROP COLUMN IF EXISTS district,
  DROP COLUMN IF EXISTS subdistrict,
  DROP COLUMN IF EXISTS village,
  DROP COLUMN IF EXISTS admin_resolved_at;

DROP INDEX IF EXISTS users_district_idx;
ALTER TABLE users
  DROP COLUMN IF EXISTS district;
