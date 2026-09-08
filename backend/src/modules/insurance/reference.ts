/**
 * PMFBY reference knowledge for the claim tracker.
 *
 * Every number here is a published figure from the PMFBY Revised / Revamped
 * Operational Guidelines and the Krishi Rakshak (KRPH) framework — not a guess,
 * not a simulation. It is the same class of curated domain data as
 * `crop-profiles.ts`. Sources are listed in `docs/INSURANCE_TRACKER.md`.
 */

export const CLAIM_STAGES = [
  'intimation',
  'survey',
  'assessment',
  'approval',
  'payout',
  'closed',
] as const;
export type ClaimStage = (typeof CLAIM_STAGES)[number];

export const LOSS_TYPES = [
  'localised', // hail, landslide, inundation, cloudburst, natural fire — individual assessment
  'widespread', // yield shortfall over the insurance unit — CCE / YES-TECH
  'post_harvest', // cut & spread in the field, up to 14 days, cyclone / unseasonal rain
  'prevented_sowing', // adverse season prevented sowing — 25% of sum insured
  'mid_season', // mid-season adversity — on-account payment
] as const;
export type LossType = (typeof LOSS_TYPES)[number];

export const CLAIM_CAUSES = [
  'flood',
  'drought',
  'pest_disease',
  'hailstorm',
  'cyclone',
  'fire',
  'unseasonal_rain',
  'frost',
  'prevented_sowing',
  'other',
] as const;
export type ClaimCause = (typeof CLAIM_CAUSES)[number];

export interface StageInfo {
  key: ClaimStage;
  label: string;
  /** Who is responsible while the claim sits at this stage. */
  owner: string;
  /**
   * Published time limit, in days, measured from when the claim entered this
   * stage. `null` where the guideline gives no fixed number for the farmer to
   * hold anyone to. For individual/localised claims; widespread claims use the
   * longer season window (see `settlementWindowDays`).
   */
  slaDays: number | null;
  meaning: string;
  /** Concrete next step if the stage overruns its SLA. */
  ifStuck: string;
}

export const STAGE_INFO: Record<ClaimStage, StageInfo> = {
  intimation: {
    key: 'intimation',
    label: 'Loss reported',
    owner: 'You → the insurance company / bank / agriculture office',
    slaDays: 3, // the farmer must intimate within 72 hours of the event
    meaning:
      'The loss has been reported through the Crop Insurance App, pmfby.gov.in, the KRPH helpline 14447, the insurer, the bank or the agriculture office. A docket number is generated.',
    ifStuck:
      'If more than 72 hours have passed since the event and you have not been able to report it, call KRPH 14447 immediately and note the date and time you tried earlier.',
  },
  survey: {
    key: 'survey',
    label: 'Field survey',
    owner: 'Insurance company loss assessor + State Agriculture Department official',
    slaDays: 10, // assessor deputed within 48h; joint survey completed within ~10 days
    meaning:
      'The insurer must depute a loss assessor within 48 hours of intimation and complete a joint field survey with an agriculture-department officer.',
    ifStuck:
      'No surveyor after 10 days: contact the Block Agricultural Officer and the insurer district office; then escalate to the District Joint Director of Agriculture.',
  },
  assessment: {
    key: 'assessment',
    label: 'Loss assessed',
    owner: 'Insurance company (individual claims) / State DES via CCE (widespread)',
    slaDays: 15,
    meaning:
      'The survey report / Crop Cutting Experiment yield is finalised and the loss percentage is fixed. This is the number the claim amount is calculated from.',
    ifStuck:
      'Ask the insurer and the District Agriculture Office in writing for the survey report / CCE result. You can also seek the yield data by RTI.',
  },
  approval: {
    key: 'approval',
    label: 'Claim approved / decided',
    owner: 'Insurance company, validated on the National Crop Insurance Portal',
    slaDays: 15,
    meaning:
      'The claim amount is computed on NCIP and approved (or rejected, with a reason). Disputes at this stage go to the District Grievance Redressal Committee.',
    ifStuck:
      'If rejected or under-assessed, raise a grievance with the District Grievance Redressal Committee (chaired by the District Collector) and, in parallel, KRPH 14447.',
  },
  payout: {
    key: 'payout',
    label: 'Money paid',
    owner: 'Insurance company → PFMS → your bank account (DigiClaim)',
    slaDays: 15, // individual claim settled within 15 days of survey report / yield data
    meaning:
      'The approved amount is disbursed electronically to your Aadhaar-linked bank account. You get an SMS; the credit shows on your passbook.',
    ifStuck:
      'Approved but not paid: the insurer owes you 12% annual interest for the delay. Report it to KRPH 14447 and the District Joint Director of Agriculture.',
  },
  closed: {
    key: 'closed',
    label: 'Closed',
    owner: '—',
    slaDays: null,
    meaning: 'The claim is settled and paid, or finally rejected with no pending grievance.',
    ifStuck: '',
  },
};

/**
 * Widespread (area-yield) claims are settled within two months of the crop
 * cutoff / harvest, subject to yield data and subsidy release. Beyond that the
 * insurer owes the farmer penal interest.
 */
export const SETTLEMENT_WINDOW_DAYS_WIDESPREAD = 60;
export const PENAL_INTEREST_PCT = 12; // % per annum, insurer → farmer, for delayed settlement

// ── the escalation ladder ────────────────────────────────────────────────────

export const RUNGS = ['block', 'district', 'dgrc', 'state', 'ombudsman', 'krph', 'cpgrams'] as const;
export type Rung = (typeof RUNGS)[number];

export const RUNG_INFO: Record<Rung, { label: string; role: string }> = {
  block: {
    label: 'Block Agricultural Officer',
    role: 'First point of contact; co-signs the joint survey.',
  },
  district: {
    label: 'District Joint Director of Agriculture',
    role: 'District PMFBY nodal officer; member-secretary of the grievance committee.',
  },
  dgrc: {
    label: 'District Grievance Redressal Committee',
    role: 'Formal grievance forum, chaired by the District Collector.',
  },
  state: {
    label: 'State Nodal Officer / Directorate of Agriculture',
    role: 'State-level dispute resolution and the State Grievance Redressal Committee.',
  },
  ombudsman: {
    label: 'Insurance Ombudsman',
    role: 'Independent redress for insurance-service complaints (IRDAI).',
  },
  krph: {
    label: 'Krishi Rakshak Portal & Helpline (14447)',
    role: 'Official single-window PMFBY grievance channel.',
  },
  cpgrams: {
    label: 'CPGRAMS (pgportal.gov.in)',
    role: 'Central public grievance portal — routes to the department.',
  },
};

/**
 * Which rung to point the farmer at, given where the claim is stuck and whether
 * it was rejected / under-paid. Returns a primary rung plus always-available
 * parallel channels.
 */
export function recommendRungs(stage: ClaimStage, outcome: string | null): {
  primary: Rung;
  also: Rung[];
} {
  const parallel: Rung[] = ['krph', 'cpgrams'];
  if (outcome === 'rejected' || outcome === 'partial') {
    return { primary: 'dgrc', also: ['state', 'ombudsman', ...parallel] };
  }
  switch (stage) {
    case 'intimation':
      return { primary: 'krph', also: ['block', 'cpgrams'] };
    case 'survey':
      return { primary: 'block', also: ['district', ...parallel] };
    case 'assessment':
    case 'approval':
      return { primary: 'district', also: ['dgrc', ...parallel] };
    case 'payout':
      return { primary: 'district', also: ['dgrc', 'ombudsman', ...parallel] };
    default:
      return { primary: 'krph', also: ['district', 'cpgrams'] };
  }
}

// ── the PMFBY claim formula (for the "how was this calculated" explainer) ─────

export interface AreaYieldInputs {
  thresholdYield: number; // kg/ha — avg of best 5 of last 7 years × indemnity level
  actualYield: number; // kg/ha — from CCE / YES-TECH
  sumInsured: number; // ₹ for the insured area
}

/** Area approach: ((TY − AY) / TY) × SI, floored at 0. */
export function areaYieldClaim(i: AreaYieldInputs): number {
  if (i.thresholdYield <= 0) return 0;
  const shortfall = (i.thresholdYield - i.actualYield) / i.thresholdYield;
  return Math.max(0, Math.round(shortfall * i.sumInsured));
}

/** Individual / localised: assessed loss % × sum insured × affected-area share. */
export function individualClaim(lossPct: number, sumInsured: number, affectedAreaShare = 1): number {
  return Math.max(0, Math.round((lossPct / 100) * sumInsured * affectedAreaShare));
}

export const PREVENTED_SOWING_PAYOUT_PCT = 25; // % of sum insured

// ── SLA computation ─────────────────────────────────────────────────────────

export interface StageClock {
  stage: ClaimStage;
  daysAtStage: number;
  slaDays: number | null;
  overdueBy: number; // days past SLA, 0 if within
  breached: boolean;
  expectedBy: string | null; // ISO date the stage should have cleared
  penalInterestDue: boolean;
}

export function stageClock(
  stage: ClaimStage,
  stageSince: string | Date,
  lossType: LossType,
  outcome: string | null,
): StageClock {
  const since =
    stageSince instanceof Date
      ? stageSince
      : new Date(String(stageSince).slice(0, 10) + 'T00:00:00');
  const days = Math.max(0, Math.floor((Date.now() - since.getTime()) / 86_400_000));
  let sla = STAGE_INFO[stage].slaDays;
  if (stage === 'payout' && lossType === 'widespread') sla = SETTLEMENT_WINDOW_DAYS_WIDESPREAD;

  const overdueBy = sla == null ? 0 : Math.max(0, days - sla);
  const expectedBy =
    sla == null
      ? null
      : new Date(since.getTime() + sla * 86_400_000).toISOString().slice(0, 10);
  const penalInterestDue =
    stage === 'payout' && outcome === 'approved' && overdueBy > 0;

  return {
    stage,
    daysAtStage: days,
    slaDays: sla,
    overdueBy,
    breached: overdueBy > 0,
    expectedBy,
    penalInterestDue,
  };
}
