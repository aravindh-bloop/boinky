import type { RiskLevel } from '../risk/risk.model.js';

export interface YieldLossEstimate {
  areaAcres: number;
  estimatedLossPctLow: number;
  estimatedLossPctHigh: number;
  basis: string;
  disclaimer: string;
}

/**
 * Yield-loss bands by projected end-of-horizon risk level, grounded in
 * published damage-function research for comparable unmanaged pest/disease
 * pressure — not fitted to this app's data, disclosed as an estimate:
 *  - ICAR-IARI wheat aphid/disease avoidable-loss studies: ~6-10% at
 *    moderate infestation
 *  - Savary et al., "The global burden of pathogens and pests on major food
 *    crops" (Nature Ecology & Evolution, 2019): losses commonly 20-40%+ of
 *    attainable yield under sustained pressure, up to ~70% without any crop
 *    protection in severe cases
 * No rupee figure is produced — this backend has no crop-price/MSP table to
 * ground a currency estimate honestly, so the estimate stops at area + a
 * percentage range (mirrors pesticides.service.ts's SafetyReport.disclaimer
 * convention: an estimate is shown as an estimate, with its basis attached).
 */
const BANDS: Record<RiskLevel, [number, number]> = {
  low: [3, 8],
  medium: [10, 22],
  high: [20, 40],
};

export function estimateYieldLoss(areaAcres: number, level: RiskLevel): YieldLossEstimate {
  const [lo, hi] = BANDS[level];
  return {
    areaAcres: Math.round(areaAcres * 10) / 10,
    estimatedLossPctLow: lo,
    estimatedLossPctHigh: hi,
    basis: `Projected ${level} risk across ~${Math.round(areaAcres)} acres in the area if left unmanaged`,
    disclaimer:
      'A model estimate from published damage-function research for comparable pest/disease pressure — ' +
      'not a measurement or a guarantee. Actual loss depends on the management action taken, the exact ' +
      'pathogen or pest, and local conditions.',
  };
}
