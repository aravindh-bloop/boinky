-- Up Migration

-- ── Hardware pod: a real ESP32 + sensor rig bound to one field ──
-- The pod authenticates with a device key (only its sha256 hash is stored). It
-- POSTs readings unauthenticated-by-JWT to /api/pod/readings with that key.
CREATE TABLE pod_devices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id     UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  farmer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label        TEXT NOT NULL DEFAULT 'AgriPod sensor',
  key_hash     TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pod_devices_key_idx   ON pod_devices (key_hash);
CREATE INDEX        pod_devices_field_idx ON pod_devices (field_id);
CREATE INDEX        pod_devices_farmer_idx ON pod_devices (farmer_id);

-- The reserved pod_readings table gains the columns the real rig sends.
ALTER TABLE pod_readings
  ADD COLUMN device_id    UUID REFERENCES pod_devices(id) ON DELETE SET NULL,
  ADD COLUMN temperature  NUMERIC,
  ADD COLUMN air_humidity NUMERIC,
  ADD COLUMN battery_pct  NUMERIC,
  ADD COLUMN raw          JSONB;

CREATE INDEX pod_readings_field_time_idx ON pod_readings (field_id, created_at DESC);

-- Down Migration

DROP INDEX IF EXISTS pod_readings_field_time_idx;
ALTER TABLE pod_readings
  DROP COLUMN IF EXISTS device_id,
  DROP COLUMN IF EXISTS temperature,
  DROP COLUMN IF EXISTS air_humidity,
  DROP COLUMN IF EXISTS battery_pct,
  DROP COLUMN IF EXISTS raw;
DROP TABLE IF EXISTS pod_devices;
