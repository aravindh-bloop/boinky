import { query, queryMaybe } from '../../db/query.js';
import { AppError } from '../../http/errors.js';

export interface FieldRow {
  id: string;
  farmer_id: string;
  name: string | null;
  crop: string;
  variety: string | null;
  sown_date: string | null;
  lat: number | null;
  lng: number | null;
  area_acres: number | null;
  created_at: string;
  /** Days since sowing, or null if no sown_date. Convenience for crop-stage logic. */
  days_since_sown: number | null;
}

// Shared SELECT projection: expands the GEOGRAPHY point into lat/lng and derives age.
const FIELD_SELECT = `
  f.id, f.farmer_id, f.name, f.crop, f.variety,
  to_char(f.sown_date, 'YYYY-MM-DD') AS sown_date,
  ST_Y(f.location::geometry) AS lat,
  ST_X(f.location::geometry) AS lng,
  f.area_acres, f.created_at,
  CASE WHEN f.sown_date IS NULL THEN NULL
       ELSE (CURRENT_DATE - f.sown_date) END AS days_since_sown
`;

export interface FieldInput {
  name?: string;
  crop: string;
  variety?: string;
  sownDate?: string; // YYYY-MM-DD
  lat?: number;
  lng?: number;
  areaAcres?: number;
}

export async function createField(farmerId: string, input: FieldInput): Promise<FieldRow> {
  const [row] = await query<FieldRow>(
    `WITH inserted AS (
       INSERT INTO fields (farmer_id, name, crop, variety, sown_date, location, area_acres)
       VALUES (
         $1, $2, $3, $4, $5,
         CASE WHEN $6::float8 IS NULL OR $7::float8 IS NULL THEN NULL
              ELSE ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography END,
         $8
       )
       RETURNING *
     )
     SELECT ${FIELD_SELECT} FROM inserted f`,
    [
      farmerId,
      input.name ?? null,
      input.crop,
      input.variety ?? null,
      input.sownDate ?? null,
      input.lat ?? null,
      input.lng ?? null,
      input.areaAcres ?? null,
    ],
  );
  if (!row) throw new Error('Field insert returned no row');
  return row;
}

export async function listFields(farmerId: string): Promise<FieldRow[]> {
  return query<FieldRow>(
    `SELECT ${FIELD_SELECT} FROM fields f WHERE f.farmer_id = $1 ORDER BY f.created_at DESC`,
    [farmerId],
  );
}

/** Fetch a field and assert the given farmer owns it. */
export async function getOwnedField(fieldId: string, farmerId: string): Promise<FieldRow> {
  const row = await queryMaybe<FieldRow>(
    `SELECT ${FIELD_SELECT} FROM fields f WHERE f.id = $1`,
    [fieldId],
  );
  if (!row) throw AppError.notFound('Field not found');
  if (row.farmer_id !== farmerId) throw AppError.forbidden('This field belongs to another farmer');
  return row;
}

export async function updateField(
  fieldId: string,
  farmerId: string,
  input: Partial<FieldInput>,
): Promise<FieldRow> {
  await getOwnedField(fieldId, farmerId); // ownership check

  const [row] = await query<FieldRow>(
    `WITH updated AS (
       UPDATE fields SET
         name = COALESCE($3, name),
         crop = COALESCE($4, crop),
         variety = COALESCE($5, variety),
         sown_date = COALESCE($6::date, sown_date),
         area_acres = COALESCE($7, area_acres),
         location = CASE
           WHEN $8::float8 IS NOT NULL AND $9::float8 IS NOT NULL
             THEN ST_SetSRID(ST_MakePoint($9, $8), 4326)::geography
           ELSE location END
       WHERE id = $1 AND farmer_id = $2
       RETURNING *
     )
     SELECT ${FIELD_SELECT} FROM updated f`,
    [
      fieldId,
      farmerId,
      input.name ?? null,
      input.crop ?? null,
      input.variety ?? null,
      input.sownDate ?? null,
      input.areaAcres ?? null,
      input.lat ?? null,
      input.lng ?? null,
    ],
  );
  if (!row) throw AppError.notFound('Field not found');
  return row;
}

export async function deleteField(fieldId: string, farmerId: string): Promise<void> {
  const res = await query(`DELETE FROM fields WHERE id = $1 AND farmer_id = $2 RETURNING id`, [
    fieldId,
    farmerId,
  ]);
  if (res.length === 0) throw AppError.notFound('Field not found');
}
