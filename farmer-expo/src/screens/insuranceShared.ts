import type { ClaimStage, StageClock } from '../api/types';
import { palette } from '../ui';
import type { TFunc } from '../i18n';

const STAGE_LABELS: Record<ClaimStage, string> = {
  intimation: 'Loss reported',
  survey: 'Field survey',
  assessment: 'Loss assessed',
  approval: 'Claim decided',
  payout: 'Money paid',
  closed: 'Closed',
};

export function stageLabel(stage: ClaimStage | string | null | undefined, t: TFunc): string {
  if (!stage) return t('Unknown');
  return t(STAGE_LABELS[stage as ClaimStage] ?? stage);
}

export interface SlaBadge {
  label: string;
  color: string;
  soft: string;
}

/** The status pill for a tracked claim — on track / due soon / overdue / rejected / paid. */
export function slaBadge(
  clock: StageClock | null | undefined,
  outcome: string | null,
  t: TFunc,
): SlaBadge {
  if (!clock) return { label: t('Tracking'), color: palette.textMuted, soft: palette.surfaceSunken };
  if (outcome === 'rejected') return { label: t('Rejected'), color: palette.danger, soft: palette.dangerSoft };
  if (clock.stage === 'closed') return { label: t('Closed'), color: palette.textMuted, soft: palette.surfaceSunken };
  if (clock.penalInterestDue)
    return { label: t('Payment overdue'), color: palette.danger, soft: palette.dangerSoft };
  if (clock.breached)
    return {
      label: t('{n} days overdue', { n: clock.overdueBy }),
      color: palette.danger,
      soft: palette.dangerSoft,
    };
  if (clock.slaDays != null && clock.daysAtStage >= clock.slaDays - 3)
    return { label: t('Due soon'), color: palette.warn, soft: palette.warnSoft };
  return { label: t('On track'), color: palette.success, soft: palette.successSoft };
}

export const CAUSE_LABELS: Record<string, string> = {
  flood: 'Flood',
  drought: 'Drought',
  pest_disease: 'Pest / disease',
  hailstorm: 'Hailstorm',
  cyclone: 'Cyclone',
  fire: 'Fire',
  unseasonal_rain: 'Unseasonal rain',
  frost: 'Frost',
  prevented_sowing: 'Prevented sowing',
  other: 'Other',
};

export const LOSS_TYPE_LABELS: Record<string, string> = {
  localised: 'Localised (my field only)',
  widespread: 'Widespread (whole area)',
  post_harvest: 'Post-harvest (cut crop in the field)',
  prevented_sowing: 'Could not sow',
  mid_season: 'Mid-season adversity',
};

export const RUNG_ICON: Record<string, 'shield' | 'scroll' | 'user' | 'alerts' | 'money'> = {
  block: 'user',
  district: 'shield',
  dgrc: 'scroll',
  state: 'scroll',
  ombudsman: 'shield',
  krph: 'alerts',
  cpgrams: 'scroll',
};
