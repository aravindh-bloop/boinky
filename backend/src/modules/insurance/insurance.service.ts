import { query, queryMaybe, queryOne, withTransaction } from '../../db/query.js';
import { AppError } from '../../http/errors.js';
import { logger } from '../../lib/logger.js';
import { getOwnedField } from '../fields/fields.service.js';
import { translate } from '../../integrations/sarvam.js';
import { recordEvent } from '../insights/profile.service.js';
import {
  CLAIM_CAUSES,
  LOSS_TYPES,
  STAGE_INFO,
  RUNG_INFO,
  recommendRungs,
  stageClock,
  PENAL_INTEREST_PCT,
  type ClaimCause,
  type ClaimStage,
  type LossType,
  type Rung,
} from './reference.js';

export { CLAIM_CAUSES, LOSS_TYPES } from './reference.js';

// ── policy refs ─────────────────────────────────────────────────────────────

export interface PolicyRefInput {
  fieldId?: string;
  applicationNo?: string;
  season: string;
  crop: string;
  insuranceUnit?: string;
  insurerName?: string;
  sumInsured?: number;
  premiumPaid?: number;
  areaAcres?: number;
  district?: string;
}

export async function addPolicyRef(farmerId: string, input: PolicyRefInput) {
  let district = input.district?.trim() || null;
  if (input.fieldId) {
    const field = await getOwnedField(input.fieldId, farmerId);
    district ||= (field as { district?: string | null }).district ?? null;
  }
  return queryOne(
    `INSERT INTO insurance_policy_ref
       (farmer_id, field_id, application_no, season, crop, insurance_unit,
        insurer_name, sum_insured, premium_paid, area_acres, district)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      farmerId,
      input.fieldId ?? null,
      input.applicationNo?.trim() ?? null,
      input.season.trim(),
      input.crop.trim(),
      input.insuranceUnit?.trim() ?? null,
      input.insurerName?.trim() ?? null,
      input.sumInsured ?? null,
      input.premiumPaid ?? null,
      input.areaAcres ?? null,
      district,
    ],
  );
}

export async function listPolicyRefs(farmerId: string) {
  return query(
    `SELECT p.*, coalesce(f.name, f.crop) AS field_name,
            (SELECT count(*)::int FROM claim_track c WHERE c.policy_ref_id = p.id) AS claim_count
       FROM insurance_policy_ref p
       LEFT JOIN fields f ON f.id = p.field_id
      WHERE p.farmer_id = $1
      ORDER BY p.created_at DESC`,
    [farmerId],
  );
}

export async function updatePolicyRef(id: string, farmerId: string, input: Partial<PolicyRefInput>) {
  await assertOwnedPolicy(id, farmerId);
  const sets: string[] = [];
  const vals: unknown[] = [id];
  const put = (col: string, v: unknown) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };
  if (input.applicationNo !== undefined) put('application_no', input.applicationNo?.trim() || null);
  if (input.season !== undefined) put('season', input.season.trim());
  if (input.crop !== undefined) put('crop', input.crop.trim());
  if (input.insuranceUnit !== undefined) put('insurance_unit', input.insuranceUnit?.trim() || null);
  if (input.insurerName !== undefined) put('insurer_name', input.insurerName?.trim() || null);
  if (input.sumInsured !== undefined) put('sum_insured', input.sumInsured ?? null);
  if (input.premiumPaid !== undefined) put('premium_paid', input.premiumPaid ?? null);
  if (input.areaAcres !== undefined) put('area_acres', input.areaAcres ?? null);
  if (input.district !== undefined) put('district', input.district?.trim() || null);
  if (sets.length === 0) return;
  put('updated_at', new Date());
  await query(`UPDATE insurance_policy_ref SET ${sets.join(', ')} WHERE id = $1`, vals);
}

export async function removePolicyRef(id: string, farmerId: string) {
  await assertOwnedPolicy(id, farmerId);
  await query(`DELETE FROM insurance_policy_ref WHERE id = $1`, [id]);
}

async function assertOwnedPolicy(id: string, farmerId: string) {
  const row = await queryMaybe<{ farmer_id: string }>(
    `SELECT farmer_id FROM insurance_policy_ref WHERE id = $1`,
    [id],
  );
  if (!row) throw AppError.notFound('Policy not found');
  if (row.farmer_id !== farmerId) throw AppError.forbidden('Not your policy');
}

// ── claim tracking ──────────────────────────────────────────────────────────

export interface CreateClaimTrackInput {
  policyRefId: string;
  cause: ClaimCause;
  lossType?: LossType;
  incidentDate?: string;
  docketId?: string;
  farmerEstimatedLossPct?: number;
  note?: string;
}

export async function createClaimTrack(farmerId: string, input: CreateClaimTrackInput) {
  const policy = await queryMaybe<{ id: string; farmer_id: string }>(
    `SELECT id, farmer_id FROM insurance_policy_ref WHERE id = $1`,
    [input.policyRefId],
  );
  if (!policy) throw AppError.notFound('Policy not found');
  if (policy.farmer_id !== farmerId) throw AppError.forbidden('Not your policy');

  const id = await withTransaction(async (c) => {
    const { rows } = await c.query<{ id: string }>(
      `INSERT INTO claim_track
         (policy_ref_id, farmer_id, docket_id, cause, loss_type, incident_date,
          farmer_estimated_loss_pct, note, stage, stage_since)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'intimation',CURRENT_DATE)
       RETURNING id`,
      [
        input.policyRefId,
        farmerId,
        input.docketId?.trim() ?? null,
        input.cause,
        input.lossType ?? 'localised',
        input.incidentDate ?? null,
        input.farmerEstimatedLossPct ?? null,
        input.note?.trim() ?? null,
      ],
    );
    const claimId = rows[0]!.id;
    await c.query(
      `INSERT INTO claim_track_event (claim_id, source, kind, to_stage, body)
       VALUES ($1, 'farmer', 'stage_change', 'intimation', $2)`,
      [claimId, `Loss reported — ${input.cause.replace('_', ' / ')}.`],
    );
    return claimId;
  });

  void recordEvent(
    farmerId,
    'insurance_claim',
    `Started tracking a crop-insurance claim for ${input.cause.replace('_', ' / ')} damage.`,
    id,
  );
  return getClaimTrack(id, farmerId);
}

export async function listClaimTracks(farmerId: string) {
  const rows = await query<Record<string, unknown>>(
    `SELECT c.*, p.crop, p.season, p.insurer_name, p.district, p.sum_insured,
            coalesce(f.name, f.crop) AS field_name
       FROM claim_track c
       JOIN insurance_policy_ref p ON p.id = c.policy_ref_id
       LEFT JOIN fields f ON f.id = p.field_id
      WHERE c.farmer_id = $1
      ORDER BY c.updated_at DESC`,
    [farmerId],
  );
  return rows.map((r) => ({
    ...r,
    clock: stageClock(
      r.stage as ClaimStage,
      r.stage_since as string | Date,
      r.loss_type as LossType,
      (r.outcome as string) ?? null,
    ),
  }));
}

export async function getClaimTrack(id: string, farmerId: string) {
  const claim = await queryMaybe<Record<string, unknown> & { farmer_id: string }>(
    `SELECT c.*, p.crop, p.season, p.insurer_name, p.district, p.sum_insured,
            p.application_no, p.insurance_unit, coalesce(f.name, f.crop) AS field_name
       FROM claim_track c
       JOIN insurance_policy_ref p ON p.id = c.policy_ref_id
       LEFT JOIN fields f ON f.id = p.field_id
      WHERE c.id = $1`,
    [id],
  );
  if (!claim) throw AppError.notFound('Claim not found');
  if (claim.farmer_id !== farmerId) throw AppError.forbidden('Not your claim');

  const [events, escalations] = await Promise.all([
    query(
      `SELECT id, source, kind, from_stage, to_stage, body, at
         FROM claim_track_event WHERE claim_id = $1 ORDER BY at`,
      [id],
    ),
    query(
      `SELECT id, rung, channel, reason, status, external_ref, officer_note, created_at, sent_at
         FROM escalation WHERE claim_id = $1 ORDER BY created_at DESC`,
      [id],
    ),
  ]);

  const stage = claim.stage as ClaimStage;
  const clock = stageClock(
    stage,
    claim.stage_since as string | Date,
    claim.loss_type as LossType,
    (claim.outcome as string) ?? null,
  );

  return {
    claim,
    stageInfo: STAGE_INFO[stage],
    clock,
    timeline: buildTimeline(stage),
    events,
    escalations,
    canEscalate: clock.breached || claim.outcome === 'rejected' || claim.outcome === 'partial',
  };
}

/** The six stages with the current one flagged, for the app's stepper. */
function buildTimeline(current: ClaimStage) {
  const order: ClaimStage[] = ['intimation', 'survey', 'assessment', 'approval', 'payout'];
  const idx = order.indexOf(current === 'closed' ? 'payout' : current);
  return order.map((s, i) => ({
    ...STAGE_INFO[s],
    state: i < idx ? 'done' : i === idx ? 'current' : 'upcoming',
  }));
}

export async function advanceClaimStage(
  id: string,
  farmerId: string,
  input: {
    stage: ClaimStage;
    stageSince?: string;
    outcome?: 'approved' | 'rejected' | 'partial' | 'pending' | null;
    amountExpected?: number | null;
    amountPaid?: number | null;
    paidOn?: string | null;
    docketId?: string | null;
    note?: string | null;
  },
) {
  const claim = await queryMaybe<{ farmer_id: string; stage: ClaimStage }>(
    `SELECT farmer_id, stage FROM claim_track WHERE id = $1`,
    [id],
  );
  if (!claim) throw AppError.notFound('Claim not found');
  if (claim.farmer_id !== farmerId) throw AppError.forbidden('Not your claim');

  await withTransaction(async (c) => {
    await c.query(
      `UPDATE claim_track SET
         stage = $2,
         stage_since = COALESCE($3, CURRENT_DATE),
         outcome = COALESCE($4, outcome),
         amount_expected = COALESCE($5, amount_expected),
         amount_paid = COALESCE($6, amount_paid),
         paid_on = COALESCE($7, paid_on),
         docket_id = COALESCE($8, docket_id),
         note = COALESCE($9, note),
         updated_at = now()
       WHERE id = $1`,
      [
        id,
        input.stage,
        input.stageSince ?? null,
        input.outcome ?? null,
        input.amountExpected ?? null,
        input.amountPaid ?? null,
        input.paidOn ?? null,
        input.docketId ?? null,
        input.note ?? null,
      ],
    );
    if (input.stage !== claim.stage) {
      await c.query(
        `INSERT INTO claim_track_event (claim_id, source, kind, from_stage, to_stage, body)
         VALUES ($1, 'farmer', 'stage_change', $2, $3, $4)`,
        [id, claim.stage, input.stage, input.note?.trim() ?? null],
      );
    }
    if (input.amountPaid != null) {
      await c.query(
        `INSERT INTO claim_track_event (claim_id, source, kind, body)
         VALUES ($1, 'farmer', 'payment', $2)`,
        [id, `Payment recorded: ₹${Math.round(input.amountPaid).toLocaleString('en-IN')}.`],
      );
    }
  });
  return getClaimTrack(id, farmerId);
}

export async function addClaimNote(id: string, farmerId: string, body: string) {
  const claim = await queryMaybe<{ farmer_id: string }>(
    `SELECT farmer_id FROM claim_track WHERE id = $1`,
    [id],
  );
  if (!claim) throw AppError.notFound('Claim not found');
  if (claim.farmer_id !== farmerId) throw AppError.forbidden('Not your claim');
  await withTransaction(async (c) => {
    await c.query(
      `INSERT INTO claim_track_event (claim_id, source, kind, body) VALUES ($1, 'farmer', 'note', $2)`,
      [id, body.trim()],
    );
    await c.query(`UPDATE claim_track SET updated_at = now() WHERE id = $1`, [id]);
  });
}

// ── escalation ──────────────────────────────────────────────────────────────

/** What the app shows on the "escalate" screen — recommended rung + contacts + draft letter. */
export async function escalationOptions(claimId: string, farmerId: string) {
  const { claim, clock } = await getClaimTrack(claimId, farmerId);
  const district = (claim.district as string) ?? null;
  const rec = recommendRungs(claim.stage as ClaimStage, (claim.outcome as string) ?? null);
  const rungs = [rec.primary, ...rec.also];

  const contacts = await lookupDirectory(district, rungs);
  const farmer = await queryOne<{ name: string; phone: string | null }>(
    `SELECT name, phone FROM users WHERE id = $1`,
    [farmerId],
  );
  const letterEn = grievanceLetterEn({
    farmerName: farmer.name,
    farmerPhone: farmer.phone,
    applicationNo: (claim.application_no as string) ?? null,
    crop: claim.crop as string,
    season: claim.season as string,
    district,
    cause: claim.cause as string,
    incidentDate: (claim.incident_date as string) ?? null,
    docketId: (claim.docket_id as string) ?? null,
    stageLabel: STAGE_INFO[claim.stage as ClaimStage].label,
    overdueBy: clock.overdueBy,
    slaDays: clock.slaDays,
    outcome: (claim.outcome as string) ?? null,
    penalInterest: clock.penalInterestDue,
  });

  return {
    district,
    recommended: rec.primary,
    rungs: rungs.map((r) => ({ rung: r, ...RUNG_INFO[r], contacts: contacts.filter((c) => c.rung === r) })),
    letterEn,
  };
}

export interface CreateEscalationInput {
  rung: Rung;
  channel: 'call' | 'sms' | 'email' | 'krph' | 'cpgrams' | 'in_person';
  reason: string;
  directoryId?: string;
  externalRef?: string;
}

export async function createEscalation(claimId: string, farmerId: string, input: CreateEscalationInput) {
  const { claim, clock } = await getClaimTrack(claimId, farmerId);
  const district = (claim.district as string) ?? null;
  const farmer = await queryOne<{ name: string; phone: string | null }>(
    `SELECT name, phone FROM users WHERE id = $1`,
    [farmerId],
  );
  const letterEn = grievanceLetterEn({
    farmerName: farmer.name,
    farmerPhone: farmer.phone,
    applicationNo: (claim.application_no as string) ?? null,
    crop: claim.crop as string,
    season: claim.season as string,
    district,
    cause: claim.cause as string,
    incidentDate: (claim.incident_date as string) ?? null,
    docketId: (claim.docket_id as string) ?? null,
    stageLabel: STAGE_INFO[claim.stage as ClaimStage].label,
    overdueBy: clock.overdueBy,
    slaDays: clock.slaDays,
    outcome: (claim.outcome as string) ?? null,
    penalInterest: clock.penalInterestDue,
  });
  let letterTa = letterEn;
  try {
    letterTa = await translate(letterEn, 'ta-IN');
  } catch (err) {
    logger.warn({ err, claimId }, 'grievance letter translate failed — using English');
  }

  const row = await withTransaction(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO escalation
         (claim_id, farmer_id, district, rung, directory_id, channel, reason,
          letter_en, letter_ta, external_ref, status, sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'sent',now())
       RETURNING *`,
      [
        claimId,
        farmerId,
        district,
        input.rung,
        input.directoryId ?? null,
        input.channel,
        input.reason.trim(),
        letterEn,
        letterTa,
        input.externalRef?.trim() ?? null,
      ],
    );
    await c.query(
      `INSERT INTO claim_track_event (claim_id, source, kind, body)
       VALUES ($1, 'farmer', 'escalation', $2)`,
      [claimId, `Escalated to ${RUNG_INFO[input.rung].label} via ${input.channel}.`],
    );
    await c.query(`UPDATE claim_track SET updated_at = now() WHERE id = $1`, [claimId]);
    return rows[0]!;
  });

  void recordEvent(
    farmerId,
    'insurance_escalation',
    `Escalated a stuck insurance claim to ${RUNG_INFO[input.rung].label}.`,
    claimId,
  );
  return row;
}

export async function listMyEscalations(farmerId: string) {
  return query(
    `SELECT e.*, c.cause, p.crop, p.season
       FROM escalation e
       JOIN claim_track c ON c.id = e.claim_id
       JOIN insurance_policy_ref p ON p.id = c.policy_ref_id
      WHERE e.farmer_id = $1
      ORDER BY e.created_at DESC`,
    [farmerId],
  );
}

// ── officer directory ───────────────────────────────────────────────────────

/** District rows first, then statewide / national channels, in ladder order. */
export async function lookupDirectory(district: string | null, rungs?: Rung[]) {
  const order = `array_position(ARRAY['block','district','dgrc','state','ombudsman','krph','cpgrams']::text[], rung)`;
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM officer_directory
      WHERE (district = $1 OR district IS NULL)
      ORDER BY (district IS NULL), ${order}`,
    [district],
  );
  return (rungs ? rows.filter((r) => rungs.includes(r.rung as Rung)) : rows) as (Record<
    string,
    unknown
  > & { rung: Rung })[];
}

export async function listDirectory(district?: string) {
  if (district) return lookupDirectory(district);
  return query(
    `SELECT * FROM officer_directory
      ORDER BY (district IS NULL), district,
        array_position(ARRAY['block','district','dgrc','state','ombudsman','krph','cpgrams']::text[], rung)`,
  );
}

export async function upsertDirectoryRow(
  officerId: string,
  input: {
    id?: string;
    district?: string | null;
    rung: Rung;
    designation: string;
    name?: string | null;
    office?: string | null;
    phone?: string | null;
    email?: string | null;
    url?: string | null;
    note?: string | null;
    verified?: boolean;
  },
) {
  if (input.id) {
    return queryOne(
      `UPDATE officer_directory SET
         district = $2, rung = $3, designation = $4, name = $5, office = $6,
         phone = $7, email = $8, url = $9, note = $10, verified = $11,
         last_verified = CASE WHEN $11 THEN CURRENT_DATE ELSE last_verified END,
         updated_by = $12, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [
        input.id,
        input.district?.trim() || null,
        input.rung,
        input.designation.trim(),
        input.name?.trim() ?? null,
        input.office?.trim() ?? null,
        input.phone?.trim() ?? null,
        input.email?.trim() ?? null,
        input.url?.trim() ?? null,
        input.note?.trim() ?? null,
        input.verified ?? false,
        officerId,
      ],
    );
  }
  return queryOne(
    `INSERT INTO officer_directory
       (district, rung, designation, name, office, phone, email, url, note, verified, last_verified, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CASE WHEN $10 THEN CURRENT_DATE END, $11)
     RETURNING *`,
    [
      input.district?.trim() || null,
      input.rung,
      input.designation.trim(),
      input.name?.trim() ?? null,
      input.office?.trim() ?? null,
      input.phone?.trim() ?? null,
      input.email?.trim() ?? null,
      input.url?.trim() ?? null,
      input.note?.trim() ?? null,
      input.verified ?? false,
      officerId,
    ],
  );
}

// ── officer side: escalations inbox ─────────────────────────────────────────

export async function listEscalationsForOfficer(f: {
  region: string | null;
  status?: string;
  limit: number;
  offset: number;
}) {
  const params: unknown[] = [];
  const where: string[] = [`1 = 1`];
  if (f.region) {
    params.push(f.region);
    where.push(`(e.district = $${params.length} OR u.region = $${params.length})`);
  }
  if (f.status) {
    params.push(f.status);
    where.push(`e.status = $${params.length}`);
  }
  params.push(f.limit, f.offset);
  return query(
    `SELECT e.id, e.rung, e.channel, e.reason, e.status, e.external_ref, e.created_at, e.sent_at,
            e.officer_note, e.district,
            c.id AS claim_id, c.cause, c.stage, c.stage_since, c.outcome,
            p.crop, p.season, p.insurer_name, p.application_no,
            u.id AS farmer_id, u.name AS farmer_name, u.phone AS farmer_phone
       FROM escalation e
       JOIN claim_track c ON c.id = e.claim_id
       JOIN insurance_policy_ref p ON p.id = c.policy_ref_id
       JOIN users u ON u.id = e.farmer_id
      WHERE ${where.join(' AND ')}
      ORDER BY (e.status IN ('sent','acknowledged')) DESC, e.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
}

export async function getEscalationForOfficer(id: string) {
  const esc = await queryMaybe<Record<string, unknown>>(
    `SELECT e.*, c.cause, c.stage, c.stage_since, c.loss_type, c.outcome, c.docket_id,
            c.incident_date, c.amount_expected, c.amount_paid,
            p.crop, p.season, p.insurer_name, p.application_no, p.sum_insured, p.insurance_unit,
            u.name AS farmer_name, u.phone AS farmer_phone, u.region AS farmer_region
       FROM escalation e
       JOIN claim_track c ON c.id = e.claim_id
       JOIN insurance_policy_ref p ON p.id = c.policy_ref_id
       JOIN users u ON u.id = e.farmer_id
      WHERE e.id = $1`,
    [id],
  );
  if (!esc) throw AppError.notFound('Escalation not found');
  const events = await query(
    `SELECT source, kind, from_stage, to_stage, body, at
       FROM claim_track_event WHERE claim_id = $1 ORDER BY at`,
    [esc.claim_id],
  );
  return { escalation: esc, events };
}

export async function updateEscalationStatus(
  id: string,
  officerId: string,
  input: { status: string; note?: string | null },
) {
  const valid = ['acknowledged', 'in_progress', 'resolved', 'closed'];
  if (!valid.includes(input.status)) throw AppError.badRequest('Invalid status');
  return queryOne(
    `UPDATE escalation SET
       status = $2, officer_id = $3,
       officer_note = COALESCE($4, officer_note), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, input.status, officerId, input.note?.trim() ?? null],
  );
}

export async function escalationSummaryForOfficer(region: string | null) {
  const params: unknown[] = [];
  const rf = region ? (params.push(region), `WHERE (e.district = $1 OR u.region = $1)`) : '';
  const byStatus = await query<{ status: string; n: number }>(
    `SELECT e.status, count(*)::int AS n
       FROM escalation e JOIN users u ON u.id = e.farmer_id ${rf}
      GROUP BY e.status`,
    params,
  );
  const byRung = await query<{ rung: string; n: number }>(
    `SELECT e.rung, count(*)::int AS n
       FROM escalation e JOIN users u ON u.id = e.farmer_id ${rf}
      GROUP BY e.rung ORDER BY n DESC`,
    params,
  );
  const map = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));
  return {
    byStatus: map,
    byRung,
    open: (map['sent'] ?? 0) + (map['acknowledged'] ?? 0) + (map['in_progress'] ?? 0),
    resolved: map['resolved'] ?? 0,
  };
}

// ── grievance letter (deterministic mail-merge, not AI) ──────────────────────

function grievanceLetterEn(d: {
  farmerName: string;
  farmerPhone: string | null;
  applicationNo: string | null;
  crop: string;
  season: string;
  district: string | null;
  cause: string;
  incidentDate: string | null;
  docketId: string | null;
  stageLabel: string;
  overdueBy: number;
  slaDays: number | null;
  outcome: string | null;
  penalInterest: boolean;
}): string {
  const lines: string[] = [];
  lines.push('Subject: Grievance regarding a pending crop-insurance claim under PMFBY');
  lines.push('');
  lines.push('Respected Sir / Madam,');
  lines.push('');
  lines.push(
    `I, ${d.farmerName}${d.farmerPhone ? ` (mobile ${d.farmerPhone})` : ''}, am a PMFBY-insured ` +
      `farmer${d.district ? ` in ${d.district} district` : ''}. I am writing about a crop-insurance ` +
      `claim that has not progressed within the time limits laid down in the PMFBY Operational Guidelines.`,
  );
  lines.push('');
  lines.push('Claim details:');
  if (d.applicationNo) lines.push(`  • PMFBY application / policy no.: ${d.applicationNo}`);
  if (d.docketId) lines.push(`  • Loss intimation / docket no.: ${d.docketId}`);
  lines.push(`  • Crop and season: ${d.crop}, ${d.season}`);
  lines.push(`  • Cause of loss: ${d.cause.replace('_', ' / ')}`);
  if (d.incidentDate) lines.push(`  • Date of loss: ${d.incidentDate}`);
  lines.push(`  • Current stage: ${d.stageLabel}`);
  lines.push('');
  if (d.outcome === 'rejected') {
    lines.push(
      'The claim has been rejected. I request that the rejection be reviewed by the District ' +
        'Grievance Redressal Committee, and that the survey report / yield data on which the ' +
        'decision was based be shared with me.',
    );
  } else if (d.outcome === 'partial') {
    lines.push(
      'The claim has been settled for less than the assessed loss. I request a review of the ' +
        'assessment and the calculation.',
    );
  } else if (d.slaDays != null && d.overdueBy > 0) {
    lines.push(
      `This stage has now overrun its published time limit of ${d.slaDays} days by ` +
        `${d.overdueBy} days. I request that it be moved forward without further delay.`,
    );
  } else {
    lines.push('I request an update on the current status of this claim and the expected next step.');
  }
  if (d.penalInterest) {
    lines.push('');
    lines.push(
      'As the claim was approved but not paid within the prescribed window, I also request the ' +
        `12% per annum penal interest payable to the farmer for delayed settlement.`,
    );
  }
  lines.push('');
  lines.push('I request your kind intervention. I am available for any verification required.');
  lines.push('');
  lines.push('Yours faithfully,');
  lines.push(d.farmerName);
  return lines.join('\n');
}

export { PENAL_INTEREST_PCT };
