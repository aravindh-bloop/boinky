import { query, queryMaybe } from '../../db/query.js';
import { AppError } from '../../http/errors.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import {
  diagnoseCropImage,
  diagnoseCropImageSet,
  type DiagnosisResult,
  type ScanImageInput,
} from '../../integrations/gemini.js';
import { generateAdvisory, toSarvamLang } from '../../integrations/sarvam.js';
import {
  uploadImage,
  deleteImage,
  uploadVideo,
  deleteVideo,
  imageDerivedUrl,
  videoFrameUrls,
  fetchImageAsBase64,
} from '../../integrations/cloudinary.js';
import { downscaleForVision } from '../../lib/image.js';
import { getOwnedField } from '../fields/fields.service.js';
import { latestSnapshot } from '../risk/risk.service.js';
import { addScanFollowup } from '../calendar/calendar.service.js';
import { resolveScanAdmin } from '../../lib/admin-location.js';
import { recordEvent } from '../insights/profile.service.js';

function scanEventLine(d: DiagnosisResult, crop: string | null): string | null {
  if (!d.isPlant) return null;
  const where = crop ? ` on ${crop}` : '';
  if (d.category === 'healthy') return `Scanned a plant${where} — looked healthy.`;
  return `Scanned a plant${where} — AI diagnosed ${d.label}${d.severity ? ` (${d.severity} severity)` : ''}.`;
}

export type ScanStatus =
  | 'draft'
  | 'pending'
  | 'auto_confirmed'
  | 'needs_validation'
  | 'validated'
  | 'corrected'
  | 'rejected';

export type ScanMediaKind =
  | 'whole_plant'
  | 'affected_closeup'
  | 'leaf_underside'
  | 'stem_base'
  | 'fruit_panicle'
  | 'field_wide'
  | 'video'
  | 'extra';

/** The minimum set a farmer must capture before a scan can be submitted. */
export const REQUIRED_ANGLES: ScanMediaKind[] = ['whole_plant', 'affected_closeup'];

/** Every angle the guided wizard offers, in capture order. */
export const SCAN_ANGLES: ScanMediaKind[] = [
  'whole_plant',
  'affected_closeup',
  'leaf_underside',
  'stem_base',
  'fruit_panicle',
  'field_wide',
];

export interface ScanMediaRow {
  id: string;
  scan_id: string;
  kind: ScanMediaKind;
  url: string;
  public_id: string | null;
  resource: 'image' | 'video';
  width: number | null;
  height: number | null;
  bytes: number | null;
  format: string | null;
  duration_s: number | null;
  position: number;
  created_at: string;
}

const SCAN_MEDIA_COLS =
  'id, scan_id, kind, url, public_id, resource, width, height, bytes, format, duration_s, position, created_at';
const SCAN_MEDIA_SELECT = SCAN_MEDIA_COLS.split(', ')
  .map((c) => `m.${c}`)
  .join(', ');

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
  image_quality: string | null;
  coverage_gaps: string[] | null;
  submitted_at: string | null;
  created_at: string;
  raw_model_response?: unknown;
  /** Attached by getScan / listScans. */
  media?: ScanMediaRow[];
}

const SCAN_SELECT = `
  s.id, s.field_id, s.farmer_id, s.image_url, s.image_public_id,
  s.diagnosis_label, s.diagnosis_category, s.affected_part, s.confidence, s.severity,
  s.advisory_text, s.advisory_language, s.status,
  s.validated_by, s.validated_at, s.validation_note, s.risk_score,
  s.farmer_note, s.farmer_note_language,
  ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lng,
  s.location_accuracy_m, s.district,
  s.image_quality, s.coverage_gaps, s.submitted_at,
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
    const line = scanEventLine(diagnosis, ctxCrop);
    if (line) void recordEvent(input.farmerId, 'scan', line, row.id);

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

/** 👍 / 👎 on the advice a scan gave. A 👎 becomes a profile event. */
export async function rateAdvisory(
  scanId: string,
  farmerId: string,
  helpful: boolean,
): Promise<void> {
  const scan = await getScan(scanId, farmerId);
  await query(`UPDATE scans SET advisory_helpful = $2 WHERE id = $1`, [scanId, helpful]);
  if (!helpful) {
    void recordEvent(
      farmerId,
      'advisory_feedback',
      `Said the advice for "${scan.diagnosis_label ?? 'a scan'}" did not help them.`,
      scanId,
    );
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
  } else {
    // Drafts are work-in-progress — never surface them in the history list.
    where.push(`s.status <> 'draft'`);
  }
  params.push(f.limit, f.offset);
  const rows = await query<ScanRow>(
    `SELECT ${SCAN_SELECT} FROM scans s
      WHERE ${where.join(' AND ')}
      ORDER BY s.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  await attachMedia(rows);
  return rows;
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
  await attachMedia([row]);
  return row;
}

export async function getScanMedia(scanId: string): Promise<ScanMediaRow[]> {
  return query<ScanMediaRow>(
    `SELECT ${SCAN_MEDIA_SELECT} FROM scan_media m WHERE m.scan_id = $1 ORDER BY m.position, m.created_at`,
    [scanId],
  );
}

/** One query for many scans' media, grouped back onto each row. */
async function attachMedia(rows: ScanRow[]): Promise<void> {
  if (rows.length === 0) return;
  const ids = rows.map((r) => r.id);
  const media = await query<ScanMediaRow>(
    `SELECT ${SCAN_MEDIA_SELECT} FROM scan_media m WHERE m.scan_id = ANY($1) ORDER BY m.position, m.created_at`,
    [ids],
  );
  const byScan = new Map<string, ScanMediaRow[]>();
  for (const m of media) {
    const arr = byScan.get(m.scan_id) ?? [];
    arr.push(m);
    byScan.set(m.scan_id, arr);
  }
  for (const r of rows) r.media = byScan.get(r.id) ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-angle "resource verification" scan (Module 1)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateDraftInput {
  farmerId: string;
  fieldId?: string;
  lat?: number;
  lng?: number;
  locationAccuracyM?: number;
}

/** Open a draft scan the farmer fills with a guided photo set, then submits. */
export async function createScanDraft(
  input: CreateDraftInput,
): Promise<{ scanId: string; requiredAngles: ScanMediaKind[]; angles: ScanMediaKind[] }> {
  let lat = input.lat ?? null;
  let lng = input.lng ?? null;
  if (input.fieldId) {
    const field = await getOwnedField(input.fieldId, input.farmerId);
    if (lat == null || lng == null) {
      lat = field.lat;
      lng = field.lng;
    }
  }

  const [row] = await query<{ id: string }>(
    `INSERT INTO scans (field_id, farmer_id, image_url, status, location, location_accuracy_m)
     VALUES ($1, $2, '', 'draft',
       CASE WHEN $3::float8 IS NULL OR $4::float8 IS NULL THEN NULL
            ELSE ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography END,
       $5)
     RETURNING id`,
    [input.fieldId ?? null, input.farmerId, lat, lng, input.locationAccuracyM ?? null],
  );
  if (!row) throw new Error('Draft scan insert returned no row');
  return { scanId: row.id, requiredAngles: REQUIRED_ANGLES, angles: SCAN_ANGLES };
}

async function loadDraft(scanId: string, farmerId: string): Promise<ScanRow> {
  const scan = await getScan(scanId, farmerId, { includeRaw: false });
  if (scan.status !== 'draft') {
    throw AppError.badRequest('This scan has already been submitted');
  }
  return scan;
}

export interface AddMediaInput {
  kind: ScanMediaKind;
  file: { buffer: Buffer; mimetype: string; originalname: string };
  resource: 'image' | 'video';
  position?: number;
}

export async function addScanMedia(
  scanId: string,
  farmerId: string,
  input: AddMediaInput,
): Promise<ScanMediaRow> {
  await loadDraft(scanId, farmerId);
  const existing = await getScanMedia(scanId);
  if (existing.length >= 8) throw AppError.badRequest('A scan can hold at most 8 photos and one video');
  if (input.resource === 'video' && existing.some((m) => m.resource === 'video')) {
    throw AppError.badRequest('Only one video per scan');
  }

  const position = input.position ?? existing.length;

  const inserted = await (input.resource === 'video'
    ? (async () => {
        const up = await uploadVideo(input.file.buffer, { folder: 'agripod/scans' });
        return query<ScanMediaRow>(
          `INSERT INTO scan_media (scan_id, kind, url, public_id, resource, bytes, format, duration_s, position)
           VALUES ($1, 'video', $2, $3, 'video', $4, $5, $6, $7)
           RETURNING ${SCAN_MEDIA_COLS}`,
          [scanId, up.url, up.publicId, up.bytes, up.format, up.durationS, position],
        );
      })()
    : (async () => {
        const uploaded = await uploadImage(input.file.buffer, { folder: 'agripod/scans' });
        return query<ScanMediaRow>(
          `INSERT INTO scan_media (scan_id, kind, url, public_id, resource, width, height, bytes, format, position)
           VALUES ($1, $2, $3, $4, 'image', $5, $6, $7, $8, $9)
           RETURNING ${SCAN_MEDIA_COLS}`,
          [
            scanId,
            input.kind,
            uploaded.url,
            uploaded.publicId,
            uploaded.width,
            uploaded.height,
            uploaded.bytes,
            uploaded.format,
            position,
          ],
        );
      })());
  const row = inserted[0];
  if (!row) throw new Error('scan_media insert returned no row');

  // Keep scans.image_url pointing at the best available cover (whole-plant first).
  await query(
    `UPDATE scans SET image_url = $2, image_public_id = $3
       WHERE id = $1 AND (image_url = '' OR $4 = 'whole_plant')`,
    [scanId, row.url, row.public_id, input.kind],
  );

  return row;
}

export async function removeScanMedia(
  scanId: string,
  mediaId: string,
  farmerId: string,
): Promise<void> {
  await loadDraft(scanId, farmerId);
  const m = await queryMaybe<ScanMediaRow>(
    `SELECT ${SCAN_MEDIA_SELECT} FROM scan_media m WHERE m.id = $1 AND m.scan_id = $2`,
    [mediaId, scanId],
  );
  if (!m) throw AppError.notFound('Media not found');

  if (m.public_id) {
    if (m.resource === 'video') await deleteVideo(m.public_id);
    else await deleteImage(m.public_id);
  }
  await query(`DELETE FROM scan_media WHERE id = $1`, [mediaId]);

  // If we just removed the cover, repoint it at whatever image remains.
  const rest = await getScanMedia(scanId);
  const cover = rest.find((x) => x.kind === 'whole_plant' && x.resource === 'image') ??
    rest.find((x) => x.resource === 'image');
  await query(`UPDATE scans SET image_url = $2, image_public_id = $3 WHERE id = $1`, [
    scanId,
    cover?.url ?? '',
    cover?.public_id ?? null,
  ]);
}

export interface SubmitDraftInput {
  farmerId: string;
  farmerLanguage: string | null;
  farmerRegion: string | null;
  farmerNote?: string | null;
  farmerNoteLanguage?: string | null;
  /** Submit even though a required angle is missing. */
  force?: boolean;
}

/** Finalise a draft: run the multi-image diagnosis, then the async advisory. */
export async function submitScanDraft(
  scanId: string,
  input: SubmitDraftInput,
): Promise<ScanRow> {
  const draft = await loadDraft(scanId, input.farmerId);
  const media = await getScanMedia(scanId);
  if (media.length === 0) throw AppError.badRequest('Add at least one photo before submitting');

  const haveKinds = new Set(media.map((m) => m.kind));
  const missing = REQUIRED_ANGLES.filter((a) => !haveKinds.has(a));
  if (missing.length > 0 && !input.force) {
    throw AppError.unprocessable('Some required photos are missing', { missingAngles: missing });
  }

  // Field context for the diagnosis prompt + risk score.
  let ctxCrop: string | null = null;
  let ctxVariety: string | null = null;
  let daysSinceSown: number | null = null;
  if (draft.field_id) {
    const field = await getOwnedField(draft.field_id, input.farmerId);
    ctxCrop = field.crop;
    ctxVariety = field.variety;
    daysSinceSown = field.days_since_sown;
  }

  // Assemble the image set: each photo downscaled via a Cloudinary derivation,
  // plus up to 3 frames sampled from the video. Fetched in parallel.
  const fetches: Promise<ScanImageInput | null>[] = [];
  for (const m of media) {
    if (!m.public_id) continue;
    if (m.resource === 'image') {
      fetches.push(
        fetchImageAsBase64(imageDerivedUrl(m.public_id)).then((got) =>
          got ? { kind: m.kind, base64: got.data, mimeType: got.mimeType } : null,
        ),
      );
    } else if (m.resource === 'video') {
      for (const frameUrl of videoFrameUrls(m.public_id)) {
        fetches.push(
          fetchImageAsBase64(frameUrl).then((got) =>
            got ? { kind: 'video', base64: got.data, mimeType: got.mimeType } : null,
          ),
        );
      }
    }
  }
  const images = (await Promise.all(fetches)).filter((x): x is ScanImageInput => x !== null);
  if (images.length === 0) {
    throw AppError.upstream('Could not read the captured photos for diagnosis');
  }

  const diagnosis = await diagnoseCropImageSet(images, {
    crop: ctxCrop,
    variety: ctxVariety,
    daysSinceSown,
    region: input.farmerRegion,
    farmerNote: input.farmerNote ?? null,
  });

  const lang = toSarvamLang(input.farmerLanguage);
  const riskScore = await deriveRiskScore(draft.field_id, diagnosis);
  const status = decideStatus(diagnosis);

  const [row] = await query<ScanRow>(
    `WITH updated AS (
       UPDATE scans SET
         diagnosis_label = $2, diagnosis_category = $3, affected_part = $4,
         confidence = $5, severity = $6, raw_model_response = $7,
         advisory_text = NULL, advisory_language = $8, status = $9, risk_score = $10,
         image_quality = $11, coverage_gaps = $12,
         farmer_note = $13, farmer_note_language = $14,
         submitted_at = now(), created_at = now()
       WHERE id = $1
       RETURNING *
     )
     SELECT ${SCAN_SELECT} FROM updated s`,
    [
      scanId,
      diagnosis.isPlant ? diagnosis.label : 'Not a crop photo',
      diagnosis.category,
      diagnosis.affectedPart,
      diagnosis.confidence,
      diagnosis.severity,
      JSON.stringify(diagnosis),
      diagnosis.isPlant ? lang : null,
      status,
      riskScore,
      diagnosis.imageQuality ?? null,
      JSON.stringify(diagnosis.coverageGaps ?? []),
      input.farmerNote?.trim() || null,
      input.farmerNoteLanguage ?? null,
    ],
  );
  if (!row) throw new Error('Scan submit returned no row');
  logger.info(
    { scanId, status, label: row.diagnosis_label, images: images.length, quality: diagnosis.imageQuality },
    'scan draft submitted',
  );

  void resolveScanAdmin(row.id, row.lat, row.lng);
  const evtLine = scanEventLine(diagnosis, ctxCrop);
  if (evtLine) void recordEvent(input.farmerId, 'scan', evtLine, row.id);

  if (
    draft.field_id &&
    diagnosis.isPlant &&
    diagnosis.category !== 'healthy' &&
    diagnosis.category !== 'unknown'
  ) {
    await addScanFollowup(draft.field_id, diagnosis.label);
  }

  if (diagnosis.isPlant) {
    void finishAdvisory(row.id, diagnosis, lang, ctxCrop, input.farmerNote ?? null);
  }

  await attachMedia([row]);
  return row;
}

/** Best-effort cleanup of drafts a farmer started and never submitted. */
export async function purgeStaleDrafts(olderThanHours = 24): Promise<number> {
  const stale = await query<{ id: string }>(
    `SELECT id FROM scans WHERE status = 'draft' AND created_at < now() - make_interval(hours => $1::int)`,
    [olderThanHours],
  );
  for (const s of stale) {
    const media = await getScanMedia(s.id);
    for (const m of media) {
      if (!m.public_id) continue;
      if (m.resource === 'video') await deleteVideo(m.public_id).catch(() => {});
      else await deleteImage(m.public_id).catch(() => {});
    }
    await query(`DELETE FROM scans WHERE id = $1`, [s.id]);
  }
  if (stale.length) logger.info({ n: stale.length }, 'purged stale scan drafts');
  return stale.length;
}
