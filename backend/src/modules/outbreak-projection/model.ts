import { computeRisk, type RiskLevel } from '../risk/risk.model.js';
import type { WeatherDay } from '../../integrations/weather.js';
import type { ProjectionContext } from './context.js';

export type SeriesPhase = 'observed' | 'forecast' | 'extrapolated';

export interface SeriesPoint {
  date: string;
  phase: SeriesPhase;
  /** Real observed cumulative confirmed-case count — set on 'observed' points only. */
  observedCount: number | null;
  /** The cumulative-affected series value at this point (observed value, or model projection). */
  projectedCount: number;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  tempMeanC: number | null;
  humidityMeanPct: number | null;
  rainfallMm: number | null;
}

export interface ProjectionSeries {
  points: SeriesPoint[];
  finalScore: number;
  finalLevel: RiskLevel;
}

/**
 * Apparent-infection-rate bounds the daily risk score (0-100, from the same
 * transparent heuristic used elsewhere in this app) is linearly mapped into
 * for the logistic step below. Polycyclic plant-disease/pest progress over
 * time is commonly modelled as logistic growth, with the rate driven by
 * environmental favourability — see:
 *  - "Plant Disease Models and Forecasting" (Phytopathology / APS, 2023)
 *  - "Model-Based Forecasting of Agricultural Crop Disease Risk" (Frontiers
 *    in Environmental Science, 2018)
 * These are literature-informed bounds, not a fitted constant for any one
 * pathosystem — disclosed as such in the API response's modelDisclosure.
 */
const R_MIN = 0.02;
const R_MAX = 0.35;

function rateFromScore(score: number): number {
  return R_MIN + (score / 100) * (R_MAX - R_MIN);
}

/**
 * Builds one continuous cumulative-affected-count series: real observed
 * weekly totals, then a forward projection from the last observed value —
 * days 1-7 driven by the live weather forecast (phase 'forecast'), days 8+
 * holding the last forecast day's conditions constant and explicitly flagged
 * 'extrapolated' rather than presented as a forecast.
 */
export function runProjection(ctx: ProjectionContext, horizonDays: number): ProjectionSeries {
  const points: SeriesPoint[] = [];

  let cum = 0;
  for (const h of ctx.history) {
    cum += h.count;
    points.push({
      date: h.bucket,
      phase: 'observed',
      observedCount: cum,
      projectedCount: cum,
      riskScore: null,
      riskLevel: null,
      tempMeanC: null,
      humidityMeanPct: null,
      rainfallMm: null,
    });
  }

  let S = ctx.s0;
  const K = ctx.carryingCapacity;
  let finalScore = 0;
  let finalLevel: RiskLevel = 'low';
  const today = new Date();

  for (let i = 1; i <= horizonDays; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const iso = date.toISOString().slice(0, 10);

    const forecastDay = i <= ctx.forecast.length ? ctx.forecast[i - 1] : ctx.forecast.at(-1);
    const phase: SeriesPhase = i <= ctx.forecast.length ? 'forecast' : 'extrapolated';
    const weather: WeatherDay = forecastDay ?? {
      date: iso,
      tempMinC: null,
      tempMaxC: null,
      tempMeanC: null,
      humidityMeanPct: null,
      humidityMaxPct: null,
      highHumidityHours: 0,
      rainfallMm: null,
      isForecast: true,
    };

    const daysSinceSown = ctx.medianDaysSinceSown != null ? ctx.medianDaysSinceSown + i : null;
    const risk = computeRisk({
      weather,
      crop: ctx.crop,
      daysSinceSown,
      nearbyOutbreaks: ctx.recentHighSeverity,
    });

    const r = rateFromScore(risk.score);
    S = Math.min(S + r * S * (1 - S / K), K);
    finalScore = risk.score;
    finalLevel = risk.level;

    points.push({
      date: iso,
      phase,
      observedCount: null,
      projectedCount: Math.round(S),
      riskScore: risk.score,
      riskLevel: risk.level,
      tempMeanC: weather.tempMeanC,
      humidityMeanPct: weather.humidityMeanPct,
      rainfallMm: weather.rainfallMm,
    });
  }

  return { points, finalScore, finalLevel };
}
