import { createHash, randomBytes } from 'node:crypto';
import { query, queryMaybe, queryOne } from '../../db/query.js';
import { AppError } from '../../http/errors.js';
import { getOwnedField } from '../fields/fields.service.js';

/** A pod is "online" if it has reported within this window. */
const ONLINE_WINDOW_MIN = 12;

const hashKey = (k: string) => createHash('sha256').update(k.trim()).digest('hex');

export interface PodReading {
  id: string;
  field_id: string;
  device_id: string | null;
  temperature: number | null;
  soil_moisture: number | null;
  soil_ph: number | null;
  air_humidity: number | null;
  battery_pct: number | null;
  created_at: string;
}

export interface PodDevice {
  id: string;
  field_id: string;
  field_name: string | null;
  label: string;
  last_seen_at: string | null;
  online: boolean;
  created_at: string;
}

// ── ingest (called by the device, no JWT) ─────────────────────────────────

export interface IngestInput {
  key: string;
  temperature?: number | null;
  soilMoisture?: number | null;
  ph?: number | null;
  airHumidity?: number | null;
  battery?: number | null;
  raw?: unknown;
}

export async function ingestReading(input: IngestInput): Promise<{ deviceId: string; fieldId: string }> {
  const device = await queryMaybe<{ id: string; field_id: string }>(
    `SELECT id, field_id FROM pod_devices WHERE key_hash = $1`,
    [hashKey(input.key)],
  );
  if (!device) throw AppError.unauthorized('Unknown pod key');

  await queryOne(
    `INSERT INTO pod_readings
       (field_id, device_id, temperature, soil_moisture, soil_ph, air_humidity,
        battery_pct, reading_source, raw)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'esp32', $8)
     RETURNING id`,
    [
      device.field_id,
      device.id,
      num(input.temperature),
      num(input.soilMoisture),
      num(input.ph),
      num(input.airHumidity),
      num(input.battery),
      input.raw ? JSON.stringify(input.raw) : null,
    ],
  );
  await query(`UPDATE pod_devices SET last_seen_at = now() WHERE id = $1`, [device.id]);
  return { deviceId: device.id, fieldId: device.field_id };
}

// ── read (app, farmer JWT) ────────────────────────────────────────────────

export async function latestForField(
  farmerId: string,
  fieldId: string,
): Promise<{ device: PodDevice | null; reading: PodReading | null; history: PodReading[] }> {
  await getOwnedField(fieldId, farmerId);

  const device = await queryMaybe<PodDevice>(
    `SELECT d.id, d.field_id, f.name AS field_name, d.label, d.last_seen_at,
            (d.last_seen_at > now() - make_interval(mins => $2)) AS online, d.created_at
       FROM pod_devices d JOIN fields f ON f.id = d.field_id
      WHERE d.field_id = $1
      ORDER BY d.created_at DESC LIMIT 1`,
    [fieldId, ONLINE_WINDOW_MIN],
  );

  const reading = await queryMaybe<PodReading>(
    `SELECT id, field_id, device_id, temperature, soil_moisture, soil_ph,
            air_humidity, battery_pct, created_at
       FROM pod_readings WHERE field_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [fieldId],
  );

  const history = await query<PodReading>(
    `SELECT id, field_id, device_id, temperature, soil_moisture, soil_ph,
            air_humidity, battery_pct, created_at
       FROM pod_readings
      WHERE field_id = $1 AND created_at > now() - interval '24 hours'
      ORDER BY created_at DESC LIMIT 288`,
    [fieldId],
  );

  return { device, reading, history: history.reverse() };
}

export async function listDevices(farmerId: string): Promise<PodDevice[]> {
  return query<PodDevice>(
    `SELECT d.id, d.field_id, f.name AS field_name, d.label, d.last_seen_at,
            (d.last_seen_at > now() - make_interval(mins => $2)) AS online, d.created_at
       FROM pod_devices d JOIN fields f ON f.id = d.field_id
      WHERE d.farmer_id = $1
      ORDER BY d.created_at DESC`,
    [farmerId, ONLINE_WINDOW_MIN],
  );
}

/** Create a device for one of the farmer's fields. Returns the key ONCE. */
export async function registerDevice(
  farmerId: string,
  fieldId: string,
  label: string,
): Promise<{ deviceId: string; key: string }> {
  await getOwnedField(fieldId, farmerId);
  const key = `pod_${randomBytes(20).toString('hex')}`;
  const row = await queryOne<{ id: string }>(
    `INSERT INTO pod_devices (field_id, farmer_id, label, key_hash)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [fieldId, farmerId, label.trim() || 'AgriPod sensor', hashKey(key)],
  );
  return { deviceId: row.id, key };
}

export async function deleteDevice(farmerId: string, deviceId: string): Promise<void> {
  const res = await query(
    `DELETE FROM pod_devices WHERE id = $1 AND farmer_id = $2 RETURNING id`,
    [deviceId, farmerId],
  );
  if (res.length === 0) throw AppError.notFound('Pod not found');
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};
