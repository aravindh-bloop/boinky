import { query, queryMaybe, queryOne } from '../../db/query.js';
import { AppError } from '../../http/errors.js';
import { logger } from '../../lib/logger.js';
import { getManagementGuidance, type DiagnosisResult } from '../../integrations/gemini.js';
import { generateAdvisory, toSarvamLang } from '../../integrations/sarvam.js';
import { recordEvent } from '../insights/profile.service.js';

// ── Overview stats ──

export interface OverviewStats {
  region: string | null;
  scans: { total: number; last7d: number; needs_validation: number };
  byStatus: Record<string, number>;
  activeAlerts: number;
  topDiagnoses: { label: string | null; count: number; high: number }[];
  byCrop: { crop: string | null; count: number }[];
  byDistrict: { district: string; count: number; high: number }[];
}

function regionFilter(region: string | null, alias: string, params: unknown[]): string {
  if (!region) return 'TRUE';
  params.push(region);
  return `${alias} = $${params.length}`;
}

export async function getOverview(region: string | null): Promise<OverviewStats> {
  // Scans are scoped to region via the owning farmer's region.
  const p1: unknown[] = [];
  const rf = regionFilter(region, 'u.region', p1);
  const scanAgg = await queryOne<{
    total: number;
    last7d: number;
    needs_validation: number;
  }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE s.created_at > now() - interval '7 days')::int AS last7d,
            count(*) FILTER (WHERE s.status = 'needs_validation')::int AS needs_validation
       FROM scans s JOIN users u ON u.id = s.farmer_id
      WHERE ${rf}`,
    p1,
  );

  const p2: unknown[] = [];
  const rf2 = regionFilter(region, 'u.region', p2);
  const statusRows = await query<{ status: string; n: number }>(
    `SELECT s.status, count(*)::int AS n
       FROM scans s JOIN users u ON u.id = s.farmer_id
      WHERE ${rf2}
      GROUP BY s.status`,
    p2,
  );

  const p3: unknown[] = [];
  const rf3 = region ? (p3.push(region), `(a.region IS NULL OR a.region = $1)`) : 'TRUE';
  const alerts = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM alerts a
      WHERE a.created_at > now() - interval '14 days' AND ${rf3}`,
    p3,
  );

  const p4: unknown[] = [];
  const rf4 = regionFilter(region, 'u.region', p4);
  const topDiagnoses = await query<{ label: string | null; count: number; high: number }>(
    `SELECT s.diagnosis_label AS label, count(*)::int AS count,
            count(*) FILTER (WHERE s.severity = 'high')::int AS high
       FROM scans s JOIN users u ON u.id = s.farmer_id
      WHERE ${rf4} AND s.created_at > now() - interval '30 days'
        AND s.diagnosis_category NOT IN ('healthy', 'unknown')
      GROUP BY s.diagnosis_label
      ORDER BY count DESC
      LIMIT 8`,
    p4,
  );

  const p5: unknown[] = [];
  const rf5 = regionFilter(region, 'u.region', p5);
  const byCrop = await query<{ crop: string | null; count: number }>(
    `SELECT lower(f.crop) AS crop, count(*)::int AS count
       FROM scans s
       JOIN users u ON u.id = s.farmer_id
       LEFT JOIN fields f ON f.id = s.field_id
      WHERE ${rf5} AND s.created_at > now() - interval '30 days'
      GROUP BY lower(f.crop)
      ORDER BY count DESC
      LIMIT 10`,
    p5,
  );

  const p6: unknown[] = [];
  const rf6 = regionFilter(region, 'u.region', p6);
  const byDistrict = await query<{ district: string; count: number; high: number }>(
    `SELECT coalesce(nullif(s.district, ''), 'Unresolved') AS district,
            count(*)::int AS count,
            count(*) FILTER (WHERE s.severity = 'high')::int AS high
       FROM scans s JOIN users u ON u.id = s.farmer_id
      WHERE ${rf6} AND s.created_at > now() - interval '30 days'
      GROUP BY 1
      ORDER BY count DESC
      LIMIT 12`,
    p6,
  );

  return {
    region,
    scans: scanAgg,
    byStatus: Object.fromEntries(statusRows.map((r) => [r.status, r.n])),
    activeAlerts: alerts.n,
    topDiagnoses,
    byCrop,
    byDistrict,
  };
}

// ── Validation queue ──

export interface QueueItem {
  id: string;
  image_url: string;
  diagnosis_label: string | null;
  diagnosis_category: string | null;
  severity: string | null;
  confidence: number | null;
  status: string;
  lat: number | null;
  lng: number | null;
  created_at: string;
  farmer_name: string;
  farmer_phone: string | null;
  crop: string | null;
  region: string | null;
  district: string | null;
}

const QUEUE_SELECT = `
  s.id, s.image_url, s.diagnosis_label, s.diagnosis_category, s.severity, s.confidence,
  s.status, ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lng,
  s.created_at, u.name AS farmer_name, u.phone AS farmer_phone,
  lower(f.crop) AS crop, u.region, s.district
`;

export async function getValidationQueue(opts: {
  region: string | null;
  crop?: string;
  district?: string;
  includeResolved?: boolean;
  limit: number;
  offset: number;
}): Promise<QueueItem[]> {
  const params: unknown[] = [];
  const where: string[] = [];
  where.push(
    opts.includeResolved
      ? `s.status IN ('needs_validation', 'validated', 'corrected', 'rejected')`
      : `s.status = 'needs_validation'`,
  );
  if (opts.region) {
    params.push(opts.region);
    where.push(`u.region = $${params.length}`);
  }
  if (opts.district) {
    params.push(opts.district);
    where.push(`s.district = $${params.length}`);
  }
  if (opts.crop) {
    params.push(opts.crop.toLowerCase());
    where.push(`lower(f.crop) = $${params.length}`);
  }
  params.push(opts.limit, opts.offset);
  return query<QueueItem>(
    `SELECT ${QUEUE_SELECT}
       FROM scans s
       JOIN users u ON u.id = s.farmer_id
       LEFT JOIN fields f ON f.id = s.field_id
      WHERE ${where.join(' AND ')}
      ORDER BY (s.severity = 'high') DESC, s.created_at ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
}

/** Full scan detail for the officer review panel — includes the whole media set. */
export async function getScanForOfficer(scanId: string) {
  const scan = await queryMaybe(
    `SELECT s.id, s.image_url, s.diagnosis_label, s.diagnosis_category, s.affected_part,
            s.severity, s.confidence, s.status, s.advisory_text, s.validation_note,
            s.image_quality, s.coverage_gaps, s.farmer_note, s.farmer_note_language,
            s.risk_score, s.district, s.location_accuracy_m,
            ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lng,
            s.created_at, s.submitted_at,
            u.name AS farmer_name, u.phone AS farmer_phone, u.region,
            lower(f.crop) AS crop, f.variety, f.name AS field_name
       FROM scans s
       JOIN users u ON u.id = s.farmer_id
       LEFT JOIN fields f ON f.id = s.field_id
      WHERE s.id = $1 AND s.status <> 'draft'`,
    [scanId],
  );
  if (!scan) throw AppError.notFound('Scan not found');
  const media = await query(
    `SELECT id, kind, url, resource, duration_s, position
       FROM scan_media WHERE scan_id = $1 ORDER BY position, created_at`,
    [scanId],
  );
  return { ...scan, media };
}

// ── Validate / correct a scan ──

export type ValidateAction = 'confirm' | 'correct' | 'reject';

export interface ValidateInput {
  action: ValidateAction;
  correctedLabel?: string;
  correctedCategory?: DiagnosisResult['category'];
  correctedSeverity?: DiagnosisResult['severity'];
  note?: string;
}

export async function validateScan(
  scanId: string,
  officialId: string,
  input: ValidateInput,
) {
  const scan = await queryMaybe<{
    id: string;
    field_id: string | null;
    farmer_id: string;
    diagnosis_label: string | null;
    diagnosis_category: string | null;
    severity: string | null;
    raw_model_response: Record<string, unknown> | null;
    advisory_language: string | null;
  }>(
    `SELECT id, field_id, farmer_id, diagnosis_label, diagnosis_category, severity,
            raw_model_response, advisory_language
       FROM scans WHERE id = $1`,
    [scanId],
  );
  if (!scan) throw AppError.notFound('Scan not found');

  if (input.action === 'reject') {
    return apply(scanId, officialId, {
      status: 'rejected',
      note: input.note ?? 'Not a valid diagnosis',
    });
  }

  if (input.action === 'confirm') {
    return apply(scanId, officialId, { status: 'validated', note: input.note ?? null });
  }

  // correct
  if (!input.correctedLabel) {
    throw AppError.badRequest('correctedLabel is required when action is "correct"');
  }
  const label = input.correctedLabel;
  const category = input.correctedCategory ?? 'disease';
  const severity =
    input.correctedSeverity ?? (scan.severity as DiagnosisResult['severity']) ?? null;

  // Regenerate management guidance + localized advisory for the corrected diagnosis.
  let advisoryText: string | null = null;
  let crop: string | null = null;
  if (scan.field_id) {
    const f = await queryMaybe<{ crop: string }>(`SELECT crop FROM fields WHERE id = $1`, [
      scan.field_id,
    ]);
    crop = f?.crop ?? null;
  }
  try {
    const guidance = await getManagementGuidance(label, category, crop);
    const lang = toSarvamLang(scan.advisory_language ?? 'en');
    const synthetic: DiagnosisResult = {
      label,
      category,
      affectedPart: null,
      severity,
      confidence: 1,
      isPlant: true,
      summary: guidance.summary,
      recommendedActions: guidance.recommendedActions,
      recommendedInputs: guidance.recommendedInputs,
      preventiveTips: guidance.preventiveTips,
    };
    advisoryText = await generateAdvisory(synthetic, lang, { crop });
  } catch (err) {
    logger.warn({ err, scanId }, 'advisory regen after correction failed — keeping old advisory');
  }

  void recordEvent(
    scan.farmer_id,
    'correction',
    `An extension officer corrected a scan diagnosis from "${scan.diagnosis_label}" to "${label}".`,
    scanId,
  );

  return apply(scanId, officialId, {
    status: 'corrected',
    label,
    category,
    severity,
    advisoryText,
    note: input.note ?? `Corrected from "${scan.diagnosis_label}" to "${label}"`,
  });
}

async function apply(
  scanId: string,
  officialId: string,
  patch: {
    status: string;
    label?: string;
    category?: string;
    severity?: string | null;
    advisoryText?: string | null;
    note: string | null;
  },
) {
  return queryOne(
    `UPDATE scans SET
       status = $2,
       diagnosis_label = COALESCE($3, diagnosis_label),
       diagnosis_category = COALESCE($4, diagnosis_category),
       severity = COALESCE($5, severity),
       advisory_text = COALESCE($6, advisory_text),
       validation_note = $7,
       validated_by = $8,
       validated_at = now()
     WHERE id = $1
     RETURNING id, status, diagnosis_label, diagnosis_category, severity,
               advisory_text, validation_note, validated_at`,
    [
      scanId,
      patch.status,
      patch.label ?? null,
      patch.category ?? null,
      patch.severity ?? null,
      patch.advisoryText ?? null,
      patch.note,
      officialId,
    ],
  );
}

// ── Directory & trends ──

// ── District-wise breakdown ──

export interface DistrictRow {
  district: string;
  scans: number;
  needs_validation: number;
  high_severity: number;
  farmers: number;
  fields: number;
  top_diagnosis: string | null;
  last_activity: string | null;
}

/**
 * Outbreak load per district over the last `days`, from the resolved
 * `scans.district` (Module 3). Scans whose coordinate has not been reverse-
 * geocoded yet fall under "Unresolved".
 */
export async function getDistrictBreakdown(
  region: string | null,
  days = 30,
): Promise<DistrictRow[]> {
  const params: unknown[] = [days];
  const rf = region ? (params.push(region), `u.region = $2`) : 'TRUE';
  return query<DistrictRow>(
    `SELECT coalesce(nullif(s.district, ''), 'Unresolved') AS district,
            count(*)::int AS scans,
            count(*) FILTER (WHERE s.status = 'needs_validation')::int AS needs_validation,
            count(*) FILTER (WHERE s.severity = 'high')::int AS high_severity,
            count(DISTINCT s.farmer_id)::int AS farmers,
            count(DISTINCT s.field_id)::int AS fields,
            mode() WITHIN GROUP (ORDER BY s.diagnosis_label)
              FILTER (WHERE s.diagnosis_category NOT IN ('healthy', 'unknown')) AS top_diagnosis,
            max(s.created_at) AS last_activity
       FROM scans s JOIN users u ON u.id = s.farmer_id
      WHERE s.created_at > now() - make_interval(days => $1::int) AND ${rf}
      GROUP BY 1
      ORDER BY scans DESC`,
    params,
  );
}

export async function getDirectory(opts: {
  region: string | null;
  search?: string;
  limit: number;
  offset: number;
}) {
  const params: unknown[] = [];
  const where: string[] = [`u.role = 'farmer'`];
  if (opts.region) {
    params.push(opts.region);
    where.push(`u.region = $${params.length}`);
  }
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`);
    where.push(`(lower(u.name) LIKE $${params.length} OR u.phone LIKE $${params.length})`);
  }
  params.push(opts.limit, opts.offset);
  return query(
    `SELECT u.id, u.name, u.phone, u.region, u.preferred_language, u.created_at,
            count(DISTINCT f.id)::int AS field_count,
            count(DISTINCT s.id)::int AS scan_count,
            array_remove(array_agg(DISTINCT lower(f.crop)), NULL) AS crops
       FROM users u
       LEFT JOIN fields f ON f.farmer_id = u.id
       LEFT JOIN scans s ON s.farmer_id = u.id
      WHERE ${where.join(' AND ')}
      GROUP BY u.id
      ORDER BY u.name
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
}

export async function getTrends(region: string | null, days: number) {
  const params: unknown[] = [days];
  const rf = region ? (params.push(region), `u.region = $2`) : 'TRUE';

  const weekly = await query<{ week: string; category: string | null; count: number }>(
    `SELECT to_char(date_trunc('week', s.created_at), 'YYYY-MM-DD') AS week,
            s.diagnosis_category AS category, count(*)::int AS count
       FROM scans s JOIN users u ON u.id = s.farmer_id
      WHERE s.created_at > now() - make_interval(days => $1::int) AND ${rf}
      GROUP BY 1, 2
      ORDER BY 1`,
    params,
  );

  const p2: unknown[] = [days];
  const rf2 = region ? (p2.push(region), `u.region = $2`) : 'TRUE';
  const byDiagnosis = await query<{ label: string | null; count: number; high: number }>(
    `SELECT s.diagnosis_label AS label, count(*)::int AS count,
            count(*) FILTER (WHERE s.severity = 'high')::int AS high
       FROM scans s JOIN users u ON u.id = s.farmer_id
      WHERE s.created_at > now() - make_interval(days => $1::int) AND ${rf2}
        AND s.diagnosis_category NOT IN ('healthy', 'unknown')
      GROUP BY 1 ORDER BY count DESC LIMIT 10`,
    p2,
  );

  return { weekly, byDiagnosis };
}
