import { query, queryMaybe, queryOne, withTransaction } from '../../db/query.js';
import { AppError } from '../../http/errors.js';
import { logger } from '../../lib/logger.js';
import { getOwnedField } from '../fields/fields.service.js';
import { resolveAdmin } from '../../integrations/geocode.js';
import {
  uploadImage,
  uploadVideo,
  deleteImage,
  deleteVideo,
  imageDerivedUrl,
  videoFrameUrls,
  fetchImageAsBase64,
} from '../../integrations/cloudinary.js';
import { assessClaimDamage, type ScanImageInput } from '../../integrations/gemini.js';
import { recordEvent } from '../insights/profile.service.js';

export type ClaimStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'surveyor_assigned'
  | 'approved'
  | 'rejected'
  | 'paid';

export const CLAIM_CAUSES = [
  'flood',
  'drought',
  'pest_disease',
  'hailstorm',
  'cyclone',
  'fire',
  'unseasonal_rain',
  'frost',
  'other',
] as const;
export type ClaimCause = (typeof CLAIM_CAUSES)[number];

// ── policies ──────────────────────────────────────────────────────────────

export interface EnrollInput {
  fieldId?: string;
  schemeId?: string;
  crop: string;
  season: string;
  sumInsured?: number;
  premiumPaid?: number;
  areaAcres?: number;
  startDate?: string;
  endDate?: string;
}

export async function enrollPolicy(farmerId: string, input: EnrollInput) {
  if (input.fieldId) await getOwnedField(input.fieldId, farmerId); // ownership
  return queryOne(
    `INSERT INTO insurance_policies
       (farmer_id, field_id, scheme_id, crop, season, sum_insured, premium_paid, area_acres, start_date, end_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      farmerId,
      input.fieldId ?? null,
      input.schemeId ?? null,
      input.crop.trim(),
      input.season.trim(),
      input.sumInsured ?? null,
      input.premiumPaid ?? null,
      input.areaAcres ?? null,
      input.startDate ?? null,
      input.endDate ?? null,
    ],
  );
}

export async function listPolicies(farmerId: string) {
  return query(
    `SELECT p.*, s.title AS scheme_title, coalesce(f.name, f.crop) AS field_name,
            (SELECT count(*)::int FROM insurance_claims c WHERE c.policy_id = p.id) AS claim_count
       FROM insurance_policies p
       LEFT JOIN schemes s ON s.id = p.scheme_id
       LEFT JOIN fields f ON f.id = p.field_id
      WHERE p.farmer_id = $1
      ORDER BY p.created_at DESC`,
    [farmerId],
  );
}

/** Insurance-type schemes for the "enrol" picker. */
export async function listInsuranceSchemes() {
  return query(
    `SELECT id, title, description, benefit_amount, apply_link FROM schemes
      WHERE kind = 'insurance' ORDER BY title`,
  );
}

// ── claims: farmer side ───────────────────────────────────────────────────

export interface CreateClaimInput {
  policyId: string;
  cause: ClaimCause;
  description?: string;
  incidentDate?: string;
  scanId?: string;
  estimatedLossPct?: number;
  lat?: number;
  lng?: number;
}

export async function createClaim(farmerId: string, input: CreateClaimInput) {
  const policy = await queryMaybe<{ id: string; field_id: string | null; farmer_id: string }>(
    `SELECT id, field_id, farmer_id FROM insurance_policies WHERE id = $1`,
    [input.policyId],
  );
  if (!policy) throw AppError.notFound('Policy not found');
  if (policy.farmer_id !== farmerId) throw AppError.forbidden('Not your policy');

  if (input.scanId) {
    const scan = await queryMaybe<{ farmer_id: string }>(`SELECT farmer_id FROM scans WHERE id = $1`, [
      input.scanId,
    ]);
    if (!scan || scan.farmer_id !== farmerId) throw AppError.badRequest('That scan is not yours');
  }

  const claim = await withTransaction(async (c) => {
    const { rows } = await c.query<{ id: string }>(
      `INSERT INTO insurance_claims
         (policy_id, farmer_id, field_id, scan_id, cause, description, incident_date, estimated_loss_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        input.policyId,
        farmerId,
        policy.field_id,
        input.scanId ?? null,
        input.cause,
        input.description?.trim() ?? null,
        input.incidentDate ?? null,
        input.estimatedLossPct ?? null,
      ],
    );
    const id = rows[0]!.id;
    await c.query(
      `INSERT INTO insurance_claim_events (claim_id, actor_id, actor_role, kind, body)
       VALUES ($1, $2, 'farmer', 'created', $3)`,
      [id, farmerId, `Started a claim for ${input.cause.replace('_', ' / ')}.`],
    );
    return id;
  });

  if (input.lat != null && input.lng != null) {
    void resolveAdmin(input.lat, input.lng)
      .then((a) => query(`UPDATE insurance_claims SET district = $2 WHERE id = $1`, [claim, a.district]))
      .catch(() => {});
  }
  return getClaim(claim, { id: farmerId, role: 'farmer' });
}

export async function listMyClaims(farmerId: string) {
  return query(
    `SELECT c.id, c.cause, c.status, c.incident_date, c.estimated_loss_pct, c.approved_amount,
            c.created_at, c.updated_at, c.submitted_at,
            p.crop, p.season, coalesce(f.name, f.crop) AS field_name,
            (SELECT count(*)::int FROM insurance_claim_media m WHERE m.claim_id = c.id) AS media_count
       FROM insurance_claims c
       JOIN insurance_policies p ON p.id = c.policy_id
       LEFT JOIN fields f ON f.id = c.field_id
      WHERE c.farmer_id = $1
      ORDER BY c.updated_at DESC`,
    [farmerId],
  );
}

interface Actor {
  id: string;
  role: 'farmer' | 'official';
}

export async function getClaim(claimId: string, actor: Actor) {
  const claim = await queryMaybe<Record<string, unknown> & { farmer_id: string }>(
    `SELECT c.*, p.crop, p.season, p.sum_insured, p.premium_paid, s.title AS scheme_title,
            coalesce(f.name, f.crop) AS field_name,
            u.name AS farmer_name, u.phone AS farmer_phone, u.region,
            sc.diagnosis_label AS scan_diagnosis
       FROM insurance_claims c
       JOIN insurance_policies p ON p.id = c.policy_id
       LEFT JOIN schemes s ON s.id = p.scheme_id
       LEFT JOIN fields f ON f.id = c.field_id
       LEFT JOIN users u ON u.id = c.farmer_id
       LEFT JOIN scans sc ON sc.id = c.scan_id
      WHERE c.id = $1`,
    [claimId],
  );
  if (!claim) throw AppError.notFound('Claim not found');
  if (actor.role === 'farmer' && claim.farmer_id !== actor.id) {
    throw AppError.forbidden('Not your claim');
  }

  const [media, events] = await Promise.all([
    query(
      `SELECT id, kind, url, caption, lat, lng, position FROM insurance_claim_media
        WHERE claim_id = $1 ORDER BY position, created_at`,
      [claimId],
    ),
    query(
      `SELECT e.id, e.actor_role, e.kind, e.from_status, e.to_status, e.body, e.created_at
         FROM insurance_claim_events e
        WHERE e.claim_id = $1 ORDER BY e.created_at`,
      [claimId],
    ),
  ]);

  // The AI draft assessment is officer-only.
  if (actor.role === 'farmer') delete (claim as Record<string, unknown>).ai_assessment;

  return { claim, media, events };
}

export async function addClaimMedia(
  claimId: string,
  farmerId: string,
  input: {
    kind: 'photo' | 'video';
    file: { buffer: Buffer; mimetype: string; originalname: string };
    caption?: string;
    lat?: number;
    lng?: number;
  },
) {
  const claim = await assertDraft(claimId, farmerId);
  const count = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM insurance_claim_media WHERE claim_id = $1`,
    [claimId],
  );
  if (count.n >= 10) throw AppError.badRequest('A claim can hold at most 10 photos and one video');

  let url: string;
  let publicId: string;
  if (input.kind === 'video') {
    const has = await queryMaybe(`SELECT 1 FROM insurance_claim_media WHERE claim_id = $1 AND kind = 'video'`, [
      claimId,
    ]);
    if (has) throw AppError.badRequest('Only one video per claim');
    const up = await uploadVideo(input.file.buffer, { folder: 'agripod/claims' });
    url = up.url;
    publicId = up.publicId;
  } else {
    const up = await uploadImage(input.file.buffer, { folder: 'agripod/claims' });
    url = up.url;
    publicId = up.publicId;
  }

  const [row] = await query(
    `INSERT INTO insurance_claim_media (claim_id, kind, url, public_id, caption, lat, lng, position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, kind, url, caption, lat, lng, position`,
    [claimId, input.kind, url, publicId, input.caption?.trim() ?? null, input.lat ?? null, input.lng ?? null, count.n],
  );
  void claim;
  return row;
}

export async function removeClaimMedia(claimId: string, mediaId: string, farmerId: string) {
  await assertDraft(claimId, farmerId);
  const m = await queryMaybe<{ public_id: string | null; kind: string }>(
    `SELECT public_id, kind FROM insurance_claim_media WHERE id = $1 AND claim_id = $2`,
    [mediaId, claimId],
  );
  if (!m) throw AppError.notFound('Media not found');
  if (m.public_id) {
    if (m.kind === 'video') await deleteVideo(m.public_id);
    else await deleteImage(m.public_id);
  }
  await query(`DELETE FROM insurance_claim_media WHERE id = $1`, [mediaId]);
}

export async function submitClaim(claimId: string, farmerId: string) {
  const claim = await assertDraft(claimId, farmerId);
  const media = await query<{ id: string; kind: string; public_id: string | null }>(
    `SELECT id, kind, public_id FROM insurance_claim_media WHERE claim_id = $1`,
    [claimId],
  );
  if (media.length === 0) {
    throw AppError.unprocessable('Add at least one photo of the damage before submitting');
  }

  await withTransaction(async (c) => {
    await c.query(
      `UPDATE insurance_claims SET status = 'submitted', submitted_at = now(), updated_at = now()
        WHERE id = $1`,
      [claimId],
    );
    await c.query(
      `INSERT INTO insurance_claim_events (claim_id, actor_id, actor_role, kind, from_status, to_status, body)
       VALUES ($1, $2, 'farmer', 'submitted', 'draft', 'submitted', $3)`,
      [claimId, farmerId, `Submitted with ${media.length} photo${media.length > 1 ? 's' : ''}.`],
    );
  });

  void recordEvent(
    farmerId,
    'insurance_claim',
    `Filed a crop-insurance claim for ${String(claim.cause).replace('_', ' / ')} damage.`,
    claimId,
  );

  // Officer-facing AI draft assessment — background, best-effort.
  void draftAssessment(claimId).catch((err) =>
    logger.warn({ err, claimId }, 'claim assessment failed'),
  );

  return getClaim(claimId, { id: farmerId, role: 'farmer' });
}

async function draftAssessment(claimId: string): Promise<void> {
  const claim = await queryMaybe<{
    cause: string;
    description: string | null;
    incident_date: string | null;
    crop: string | null;
    scan_diagnosis: string | null;
  }>(
    `SELECT c.cause, c.description, to_char(c.incident_date,'YYYY-MM-DD') AS incident_date,
            p.crop, sc.diagnosis_label AS scan_diagnosis
       FROM insurance_claims c
       JOIN insurance_policies p ON p.id = c.policy_id
       LEFT JOIN scans sc ON sc.id = c.scan_id
      WHERE c.id = $1`,
    [claimId],
  );
  if (!claim) return;

  const media = await query<{ kind: string; public_id: string | null }>(
    `SELECT kind, public_id FROM insurance_claim_media WHERE claim_id = $1 ORDER BY position LIMIT 6`,
    [claimId],
  );
  const fetches: Promise<ScanImageInput | null>[] = [];
  for (const m of media) {
    if (!m.public_id) continue;
    if (m.kind === 'video') {
      for (const f of videoFrameUrls(m.public_id).slice(0, 2)) {
        fetches.push(
          fetchImageAsBase64(f).then((g) => (g ? { kind: 'video', base64: g.data, mimeType: g.mimeType } : null)),
        );
      }
    } else {
      fetches.push(
        fetchImageAsBase64(imageDerivedUrl(m.public_id)).then((g) =>
          g ? { kind: 'field_wide', base64: g.data, mimeType: g.mimeType } : null,
        ),
      );
    }
  }
  const images = (await Promise.all(fetches)).filter((x): x is ScanImageInput => x !== null);
  if (images.length === 0) return;

  const assessment = await assessClaimDamage(images, {
    cause: claim.cause,
    crop: claim.crop,
    description: claim.description,
    incidentDate: claim.incident_date,
    scanDiagnosis: claim.scan_diagnosis,
  });
  await query(`UPDATE insurance_claims SET ai_assessment = $2 WHERE id = $1`, [
    claimId,
    JSON.stringify(assessment),
  ]);
  logger.info({ claimId, plausible: assessment.causePlausible }, 'claim assessment attached');
}

export async function postClaimMessage(claimId: string, actor: Actor, body: string) {
  const claim = await queryMaybe<{ farmer_id: string }>(
    `SELECT farmer_id FROM insurance_claims WHERE id = $1`,
    [claimId],
  );
  if (!claim) throw AppError.notFound('Claim not found');
  if (actor.role === 'farmer' && claim.farmer_id !== actor.id) throw AppError.forbidden('Not your claim');
  await withTransaction(async (c) => {
    await c.query(
      `INSERT INTO insurance_claim_events (claim_id, actor_id, actor_role, kind, body)
       VALUES ($1, $2, $3, 'message', $4)`,
      [claimId, actor.id, actor.role, body.trim()],
    );
    await c.query(`UPDATE insurance_claims SET updated_at = now() WHERE id = $1`, [claimId]);
  });
}

async function assertDraft(claimId: string, farmerId: string): Promise<Record<string, unknown>> {
  const claim = await queryMaybe<Record<string, unknown> & { farmer_id: string; status: string }>(
    `SELECT * FROM insurance_claims WHERE id = $1`,
    [claimId],
  );
  if (!claim) throw AppError.notFound('Claim not found');
  if (claim.farmer_id !== farmerId) throw AppError.forbidden('Not your claim');
  if (claim.status !== 'draft') throw AppError.badRequest('This claim has already been submitted');
  return claim;
}

// ── claims: officer side ──────────────────────────────────────────────────

export interface OfficerClaimFilter {
  region: string | null;
  district?: string;
  status?: ClaimStatus;
  cause?: ClaimCause;
  limit: number;
  offset: number;
}

export async function listClaimsForOfficer(f: OfficerClaimFilter) {
  const params: unknown[] = [];
  const where: string[] = [`c.status <> 'draft'`];
  if (f.region) {
    params.push(f.region);
    where.push(`u.region = $${params.length}`);
  }
  if (f.district) {
    params.push(f.district);
    where.push(`c.district = $${params.length}`);
  }
  if (f.status) {
    params.push(f.status);
    where.push(`c.status = $${params.length}`);
  }
  if (f.cause) {
    params.push(f.cause);
    where.push(`c.cause = $${params.length}`);
  }
  params.push(f.limit, f.offset);
  return query(
    `SELECT c.id, c.cause, c.status, c.incident_date, c.estimated_loss_pct,
            c.assessed_loss_pct, c.approved_amount, c.district,
            c.created_at, c.updated_at, c.submitted_at,
            (c.ai_assessment IS NOT NULL) AS has_assessment,
            p.crop, p.season, p.sum_insured,
            u.id AS farmer_id, u.name AS farmer_name, u.phone AS farmer_phone, u.region,
            (SELECT count(*)::int FROM insurance_claim_media m WHERE m.claim_id = c.id) AS media_count
       FROM insurance_claims c
       JOIN insurance_policies p ON p.id = c.policy_id
       JOIN users u ON u.id = c.farmer_id
      WHERE ${where.join(' AND ')}
      ORDER BY (c.status IN ('submitted','under_review')) DESC, c.updated_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
}

const CLAIM_FLOW: Record<ClaimStatus, ClaimStatus[]> = {
  draft: [],
  submitted: ['under_review', 'surveyor_assigned', 'approved', 'rejected'],
  under_review: ['surveyor_assigned', 'approved', 'rejected'],
  surveyor_assigned: ['approved', 'rejected', 'under_review'],
  approved: ['paid', 'rejected'],
  rejected: [],
  paid: [],
};

export async function decideClaim(
  id: string,
  officerId: string,
  input: {
    status: ClaimStatus;
    note?: string | null;
    approvedAmount?: number | null;
    assessedLossPct?: number | null;
  },
) {
  const claim = await queryMaybe<{ status: ClaimStatus; farmer_id: string }>(
    `SELECT status, farmer_id FROM insurance_claims WHERE id = $1`,
    [id],
  );
  if (!claim) throw AppError.notFound('Claim not found');
  if (!CLAIM_FLOW[claim.status]?.includes(input.status)) {
    throw AppError.badRequest(`Cannot move a claim from ${claim.status} to ${input.status}`);
  }
  if ((input.status === 'approved' || input.status === 'paid') && (input.approvedAmount == null || input.approvedAmount < 0)) {
    throw AppError.badRequest('An approved amount is required');
  }

  const updated = await withTransaction(async (c) => {
    const { rows } = await c.query(
      `UPDATE insurance_claims SET
         status = $2,
         officer_note = COALESCE($3, officer_note),
         approved_amount = CASE WHEN $2 IN ('approved','paid') THEN $4 ELSE approved_amount END,
         assessed_loss_pct = COALESCE($5, assessed_loss_pct),
         reviewed_by = $6, reviewed_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, input.status, input.note ?? null, input.approvedAmount ?? null, input.assessedLossPct ?? null, officerId],
    );
    await c.query(
      `INSERT INTO insurance_claim_events (claim_id, actor_id, actor_role, kind, from_status, to_status, body)
       VALUES ($1, $2, 'official', 'status_change', $3, $4, $5)`,
      [id, officerId, claim.status, input.status, input.note?.trim() ?? null],
    );
    return rows[0]!;
  });

  return updated;
}

export async function insuranceSummaryForOfficer(region: string | null) {
  const params: unknown[] = [];
  const rf = region ? (params.push(region), `AND u.region = $1`) : '';
  const byStatus = await query<{ status: ClaimStatus; n: number }>(
    `SELECT c.status, count(*)::int AS n
       FROM insurance_claims c JOIN users u ON u.id = c.farmer_id
      WHERE c.status <> 'draft' ${rf}
      GROUP BY c.status`,
    params,
  );
  const byCause = await query<{ cause: string; n: number }>(
    `SELECT c.cause, count(*)::int AS n
       FROM insurance_claims c JOIN users u ON u.id = c.farmer_id
      WHERE c.status <> 'draft' ${rf}
      GROUP BY c.cause ORDER BY n DESC`,
    params,
  );
  const paid = await queryOne<{ total: number; policies: number; insured: number }>(
    `SELECT
       (SELECT coalesce(sum(c.approved_amount),0)::float FROM insurance_claims c
          JOIN users u ON u.id = c.farmer_id WHERE c.status = 'paid' ${rf}) AS total,
       (SELECT count(*)::int FROM insurance_policies p
          JOIN users u ON u.id = p.farmer_id WHERE p.status = 'active' ${rf}) AS policies,
       (SELECT coalesce(sum(p.sum_insured),0)::float FROM insurance_policies p
          JOIN users u ON u.id = p.farmer_id WHERE p.status = 'active' ${rf}) AS insured`,
    params,
  );
  const map = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));
  return {
    byStatus: map,
    byCause,
    totalPaid: paid.total,
    activePolicies: paid.policies,
    sumInsured: paid.insured,
    pendingReview: (map['submitted'] ?? 0) + (map['under_review'] ?? 0) + (map['surveyor_assigned'] ?? 0),
    approvedNotPaid: map['approved'] ?? 0,
  };
}
