import { query, queryMaybe } from '../../db/query.js';
import { AppError } from '../../http/errors.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { diagnoseCropImage, type DiagnosisResult } from '../../integrations/gemini.js';
import { generateAdvisory, toSarvamLang } from '../../integrations/sarvam.js';
import { uploadImage, deleteImage } from '../../integrations/cloudinary.js';
import { downscaleForVision } from '../../lib/image.js';
import { getOwnedField } from '../fields/fields.service.js';
import { latestSnapshot } from '../risk/risk.service.js';
import { addScanFollowup } from '../calendar/calendar.service.js';
import { resolveScanAdmin } from '../../lib/admin-location.js';

export type ScanStatus =
  | 'pending'
  | 'auto_confirmed'
  | 'needs_validation'
  | 'validated'
  | 'corrected'
  | 'rejected';

export interface ScanRow {
  id: string;
  field_id: string | null;
  farmer_id: string;
  image_url: string;
  image_public_id: string | null;
  diagnosis_label: string | null;
  diagnosis_category: string | null;
  affected_part: string | null;
  confidence: number | null;
  severity: string | null;
  advisory_text: string | null;
  advisory_language: string | null;
  status: ScanStatus;
  validated_by: string | null;
  validated_at: string | null;
  validation_note: string | null;
  risk_score: number | null;
  farmer_note: string | null;
  farmer_note_language: string | null;
  lat: number | null;
  lng: number | null;
  location_accuracy_m: number | null;
  district: string | null;
  created_at: string;
  raw_model_response?: unknown;
}

const SCAN_SELECT = `
  s.id, s.field_id, s.farmer_id, s.image_url, s.image_public_id,
  s.diagnosis_label, s.diagnosis_category, s.affected_part, s.confidence, s.severity,
  s.advisory_text, s.advisory_language, s.status,
  s.validated_by, s.validated_at, s.validation_note, s.risk_score,
  s.farmer_note, s.farmer_note_language,
  ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lng,
  s.location_accuracy_m, s.district,
  s.created_at
`;

const SEVERITY_WEIGHT: Record<string, number> = { low: 25, medium: 55, high: 85 };

/**
 * Risk score for a fresh scan (0-100). Combines diagnosis severity with the most
 * recent weather risk snapshot for the field, if one exists. The full weather
 * pipeline (module 4) populates risk_snapshots; here we consume whatever is there.
 */
async function deriveRiskScore(
  fieldId: string | null,
  diagnosis: DiagnosisResult,
): Promise<number | null> {
  const severityTerm =
    diagnosis.category === 'healthy'
      ? 5
      : (diagnosis.severity ? SEVERITY_WEIGHT[diagnosis.severity] : 40) ?? 40;

  let weatherTerm: number | null = null;
  if (fieldId) {
    const snap = await latestSnapshot(fieldId);
    if (snap && snap.risk_score != null) weatherTerm = snap.risk_score;
  }

  if (weatherTerm == null) return Math.round(severityTerm * diagnosis.confidence + 5);
  // 60% current diagnosis, 40% environmental pressure
  return Math.round(
    0.6 * severityTerm * Math.max(diagnosis.confidence, 0.4) + 0.4 * weatherTerm,
  );
}

function decideStatus(d: DiagnosisResult): ScanStatus {
  if (!d.isPlant) return 'rejected';
  if (d.category === 'healthy' && d.confidence >= 0.5) return 'auto_confirmed';
  if (d.category === 'unknown') return 'needs_validation';
  return d.confidence >= env.CONFIDENCE_ESCALATION_THRESHOLD
    ? 'auto_confirmed'
    : 'needs_validation';
}

export interface CreateScanInput {
  farmerId: string;
  farmerLanguage: string | null;
  farmerRegion: string | null;
  image: { buffer: Buffer; mimetype: string };
  fieldId?: string;
  lat?: number;
  lng?: number;
  locationAccuracyM?: number;
  /** The farmer describing the problem in their own words (spoken or typed). */
  farmerNote?: string | null;
  /** Language Sarvam detected in the voice note, e.g. "ta-IN". */
  farmerNoteLanguage?: string | null;
}

export async function createScan(input: CreateScanInput): Promise<ScanRow> {
  // 1. Resolve field context + default location
  let ctxCrop: string | null = null;
  let ctxVariety: string | null = null;
  let daysSinceSown: number | null = null;
  let lat = input.lat ?? null;
  let lng = input.lng ?? null;

  if (input.fieldId) {
    const field = await getOwnedField(input.fieldId, input.farmerId);
    ctxCrop = field.crop;
    ctxVariety = field.variety;
    daysSinceSown = field.days_since_sown;
    if (lat == null || lng == null) {
      lat = field.lat;
      lng = field.lng;
    }
  }

  // 2. Downscale for the vision model (big cut in latency/cost), then upload the
  //    original (so a failed AI call still leaves an auditable image).
  const vision = await downscaleForVision(input.image.buffer);
  const uploaded = await uploadImage(input.image.buffer, { folder: 'agripod/scans' });

  try {
    // 3. Vision diagnosis
    const diagnosis = await diagnoseCropImage(
      vision.buffer.toString('base64'),
      vision.mimeType,
      {
        crop: ctxCrop,
        variety: ctxVariety,
        daysSinceSown,
        region: input.farmerRegion,
        farmerNote: input.farmerNote ?? null,
      },
    );

    // 4. Localised advisory is generated in the BACKGROUND (see finishAdvisory
    //    below) so this request returns in ~5s instead of ~25s. The row lands
    //    with advisory_text = NULL; the client polls GET /api/scans/:id until it
    //    is filled. Only plant images get an advisory.
    const lang = toSarvamLang(input.farmerLanguage);
    const advisoryText: string | null = null;

    // 5. Risk score
    const riskScore = await deriveRiskScore(input.fieldId ?? null, diagnosis);

    // 6. Persist
    const status = decideStatus(diagnosis);
    const [row] = await query<ScanRow>(
      `WITH inserted AS (
         INSERT INTO scans (
           field_id, farmer_id, image_url, image_public_id,
           diagnosis_label, diagnosis_category, affected_part, confidence, severity,
           raw_model_response, advisory_text, advisory_language, status, risk_score,
           farmer_note, farmer_note_language, location, location_accuracy_m
         ) VALUES (
           $1, $2, $3, $4,
           $5, $6, $7, $8, $9,
           $10, $11, $12, $13, $14,
           $17, $18,
           CASE WHEN $15::float8 IS NULL OR $16::float8 IS NULL THEN NULL
                ELSE ST_SetSRID(ST_MakePoint($16, $15), 4326)::geography END,
           $19
         )
         RETURNING *
       )
       SELECT ${SCAN_SELECT} FROM inserted s`,
      [
        input.fieldId ?? null,
        input.farmerId,
        uploaded.url,
        uploaded.publicId,
        diagnosis.isPlant ? diagnosis.label : 'Not a crop photo',
        diagnosis.category,
        diagnosis.affectedPart,
        diagnosis.confidence,
        diagnosis.severity,
        JSON.stringify(diagnosis),
        advisoryText,
        diagnosis.isPlant ? lang : null,
        status,
        riskScore,
        lat,
        lng,
        input.farmerNote?.trim() || null,
        input.farmerNoteLanguage ?? null,
        input.locationAccuracyM ?? null,
      ],
    );
    if (!row) throw new Error('Scan insert returned no row');
    logger.info({ scanId: row.id, status, label: row.diagnosis_label }, 'scan created');
    void resolveScanAdmin(row.id, row.lat, row.lng);

    // Follow-up re-scan reminder for a real problem on a known field.
    if (
      input.fieldId &&
      diagnosis.isPlant &&
      diagnosis.category !== 'healthy' &&
      diagnosis.category !== 'unknown'
    ) {
      await addScanFollowup(input.fieldId, diagnosis.label);
    }

    // Fire-and-forget the localised advisory. Render runs a normal long-lived
    // Node process, so this keeps running after the response is sent.
    if (diagnosis.isPlant) {
      void finishAdvisory(row.id, diagnosis, toSarvamLang(input.farmerLanguage), ctxCrop, input.farmerNote ?? null);
    }
    return row;
  } catch (err) {
    // Diagnosis/upload failed before the row was written — clean up the image.
    await deleteImage(uploaded.publicId);
    throw err;
  }
}

/**
 * Generate the localised advisory out-of-band and patch it onto the scan row.
 * Never throws — a failure just leaves advisory_text NULL and the client shows
 * a "couldn't generate advice" state with a retry.
 */
async function finishAdvisory(
  scanId: string,
  diagnosis: DiagnosisResult,
  lang: string,
  crop: string | null,
  farmerNote: string | null,
): Promise<void> {
  try {
    const text = await generateAdvisory(diagnosis, lang, { crop, farmerNote });
    await query(
      `UPDATE scans SET advisory_text = $1, advisory_language = $2
         WHERE id = $3 AND advisory_text IS NULL`,
      [text, lang, scanId],
    );
    logger.info({ scanId }, 'scan advisory attached');
  } catch (err) {
    logger.error({ err, scanId }, 'scan advisory generation failed');
  }
}

/** Re-run advisory generation for a scan whose advisory is still missing. */
export async function retryAdvisory(scanId: string, farmerId: string): Promise<ScanRow> {
  const scan = await getScan(scanId, farmerId, { includeRaw: true });
  if (scan.advisory_text) return scan;
  const diagnosis = (scan.raw_model_response ?? null) as DiagnosisResult | null;
  if (!diagnosis || !diagnosis.isPlant) return scan;
  await finishAdvisory(scanId, diagnosis, scan.advisory_language ?? 'en-IN', null, scan.farmer_note);
  return getScan(scanId, farmerId);
}

export interface ListScansFilter {
  farmerId: string;
  fieldId?: string;
  status?: ScanStatus;
  limit: number;
  offset: number;
}

export async function listScans(f: ListScansFilter): Promise<ScanRow[]> {
  const where: string[] = ['s.farmer_id = $1'];
  const params: unknown[] = [f.farmerId];
  if (f.fieldId) {
    params.push(f.fieldId);
    where.push(`s.field_id = $${params.length}`);
  }
  if (f.status) {
    params.push(f.status);
    where.push(`s.status = $${params.length}`);
  }
  params.push(f.limit, f.offset);
  return query<ScanRow>(
    `SELECT ${SCAN_SELECT} FROM scans s
      WHERE ${where.join(' AND ')}
      ORDER BY s.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
}

export async function getScan(
  scanId: string,
  farmerId: string,
  opts: { includeRaw?: boolean } = {},
): Promise<ScanRow> {
  const row = await queryMaybe<ScanRow>(
    `SELECT ${SCAN_SELECT}${opts.includeRaw ? ', s.raw_model_response' : ''}
       FROM scans s WHERE s.id = $1`,
    [scanId],
  );
  if (!row) throw AppError.notFound('Scan not found');
  if (row.farmer_id !== farmerId) throw AppError.forbidden('This scan belongs to another farmer');
  return row;
}
