import { query, queryMaybe, queryOne } from '../../db/query.js';
import { AppError } from '../../http/errors.js';
import { logger } from '../../lib/logger.js';
import { estimatePHI } from '../../integrations/gemini.js';
import { cropProfile } from '../risk/crop-profiles.js';
import { getScan } from '../scans/scans.service.js';
import { getOwnedField } from '../fields/fields.service.js';

export interface PesticideRef {
  id: string;
  pesticide_name: string;
  active_ingredient: string | null;
  crop: string | null;
  target_pest_or_disease: string | null;
  pre_harvest_interval_days: number | null;
  safe_dosage: string | null;
  precautions: string | null;
  source: 'curated' | 'ai_estimate' | 'official';
  updated_at: string;
}

const FORMULATION_CODES =
  /\b(WP|WG|SC|EC|SL|SP|SG|DF|WS|CS|OD|ME|FS|GR|DP|EW|ZC|SE|WDG)\b/gi;

/** "Cymoxanil 8% + Mancozeb 64% WP (2 g/L)" -> { cleaned, ingredients: ['cymoxanil','mancozeb'] } */
export function normalizePesticide(raw: string): { cleaned: string; ingredients: string[] } {
  const noParen = raw.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const ingredients = noParen
    .split(/\s*\+\s*/)
    .map((p) =>
      p
        .replace(/\d+(\.\d+)?\s*%?/g, ' ')
        .replace(/\bppm\b/gi, ' ')
        .replace(FORMULATION_CODES, ' ')
        .replace(/[^a-zA-Z\- ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase(),
    )
    .filter((s) => s.length > 2);
  return { cleaned: noParen.toLowerCase(), ingredients };
}

export async function searchReference(q: string, crop?: string): Promise<PesticideRef[]> {
  const term = `%${q.toLowerCase()}%`;
  return query<PesticideRef>(
    `SELECT * FROM pesticide_reference
      WHERE (lower(pesticide_name) LIKE $1 OR lower(active_ingredient) LIKE $1
             OR lower(target_pest_or_disease) LIKE $1)
        AND ($2::text IS NULL OR crop IS NULL OR lower(crop) = lower($2))
      ORDER BY (crop IS NOT NULL) DESC, pesticide_name
      LIMIT 25`,
    [term, crop ?? null],
  );
}

/**
 * Resolve a PHI reference for a (possibly messy) pesticide string + crop.
 * Table lookup first (crop-specific preferred, then most conservative); on a miss,
 * ask Gemini and persist the answer as an `ai_estimate` row.
 */
export async function lookupPHI(rawName: string, crop: string | null): Promise<PesticideRef> {
  const { cleaned, ingredients } = normalizePesticide(rawName);
  const ingArr = ingredients.length ? ingredients : [cleaned];

  const hit = await queryMaybe<PesticideRef>(
    `SELECT pr.*,
       (
         (CASE WHEN lower(pr.pesticide_name) = $1 THEN 5 ELSE 0 END)
         + (SELECT count(*) FROM unnest($3::text[]) t
              WHERE lower(pr.pesticide_name) LIKE '%' || t || '%'
                 OR lower(coalesce(pr.active_ingredient, '')) LIKE '%' || t || '%')
       ) AS match_score
     FROM pesticide_reference pr
      WHERE ($2::text IS NULL OR pr.crop IS NULL OR lower(pr.crop) = lower($2))
        AND (
          lower(pr.pesticide_name) = $1
          OR lower(pr.pesticide_name) LIKE $1 || '%'
          OR $1 LIKE lower(pr.pesticide_name) || '%'
          OR lower(pr.active_ingredient) = ANY($3)
          OR EXISTS (
            SELECT 1 FROM unnest($3::text[]) t
             WHERE lower(coalesce(pr.active_ingredient, '')) LIKE '%' || t || '%'
                OR lower(pr.pesticide_name) LIKE '%' || t || '%'
          )
        )
      ORDER BY match_score DESC,
               (pr.crop IS NOT NULL) DESC,
               pr.pre_harvest_interval_days DESC NULLS LAST
      LIMIT 1`,
    [cleaned, crop, ingArr],
  );
  if (hit) {
    const { match_score: _drop, ...ref } = hit as PesticideRef & { match_score?: number };
    return ref;
  }

  logger.info({ rawName, crop }, 'PHI not in reference table — asking Gemini');
  const est = await estimatePHI(rawName, crop);
  const displayName = rawName.replace(/\([^)]*\)/g, '').trim().slice(0, 200);

  return queryOne<PesticideRef>(
    `INSERT INTO pesticide_reference
       (pesticide_name, active_ingredient, crop, target_pest_or_disease,
        pre_harvest_interval_days, safe_dosage, precautions, source, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'ai_estimate', now())
     ON CONFLICT (lower(pesticide_name), lower(coalesce(crop, '*')))
     DO UPDATE SET pre_harvest_interval_days = EXCLUDED.pre_harvest_interval_days,
                   active_ingredient = EXCLUDED.active_ingredient,
                   safe_dosage = EXCLUDED.safe_dosage,
                   precautions = EXCLUDED.precautions,
                   updated_at = now()
     RETURNING *`,
    [
      displayName,
      est.activeIngredient ?? (ingArr[0] ?? null),
      crop,
      est.targetPestOrDisease,
      est.preHarvestIntervalDays,
      est.safeDosage,
      est.precautions,
    ],
  );
}

export interface SafetyItem {
  input: string;
  matched: string;
  activeIngredient: string | null;
  phiDays: number | null;
  source: PesticideRef['source'];
  verdict: 'safe' | 'caution' | 'unsafe' | 'unknown';
  note: string;
}

export interface ScanSafetyReport {
  scanId: string;
  crop: string | null;
  expectedHarvestDate: string | null;
  daysToHarvest: number | null;
  overall: 'safe' | 'caution' | 'unsafe' | 'unknown';
  items: SafetyItem[];
  disclaimer: string;
}

const DISCLAIMER =
  'Pre-harvest intervals are indicative. Always confirm the waiting period, dose and ' +
  'registered crop on the product label before spraying.';

function verdictFor(
  phiDays: number | null,
  daysToHarvest: number | null,
): { verdict: SafetyItem['verdict']; note: string } {
  if (phiDays == null) {
    return { verdict: 'unknown', note: 'Pre-harvest interval could not be determined.' };
  }
  if (daysToHarvest == null) {
    return {
      verdict: 'caution',
      note: `Wait at least ${phiDays} day(s) after spraying before harvest. Set a harvest date on this field for an exact check.`,
    };
  }
  if (daysToHarvest >= phiDays + 5) {
    return { verdict: 'safe', note: `Safe: ~${daysToHarvest} days to harvest, well over the ${phiDays}-day waiting period.` };
  }
  if (daysToHarvest >= phiDays) {
    return { verdict: 'caution', note: `Borderline: ~${daysToHarvest} days to harvest vs a ${phiDays}-day waiting period. Spray immediately after, not later.` };
  }
  return {
    verdict: 'unsafe',
    note: `Do NOT spray: only ~${daysToHarvest} days to harvest but this product needs ${phiDays} days before harvest. Choose a shorter-PHI product or delay harvest.`,
  };
}

const RANK: Record<SafetyItem['verdict'], number> = { safe: 0, unknown: 1, caution: 2, unsafe: 3 };

export async function checkScanSafety(
  scanId: string,
  farmerId: string,
  explicitHarvestDate?: string,
): Promise<ScanSafetyReport> {
  const scan = await getScan(scanId, farmerId, { includeRaw: true });
  const raw = scan.raw_model_response as { recommendedInputs?: unknown } | null;
  const inputs = Array.isArray(raw?.recommendedInputs)
    ? (raw!.recommendedInputs as unknown[]).map(String).filter(Boolean)
    : [];

  // Resolve crop + expected harvest date from the field
  let crop: string | null = null;
  let harvestDate: string | null = explicitHarvestDate ?? null;
  if (scan.field_id) {
    const field = await getOwnedField(scan.field_id, farmerId);
    crop = field.crop;
    if (!harvestDate && field.sown_date) {
      const profile = cropProfile(field.crop);
      const d = new Date(field.sown_date);
      d.setDate(d.getDate() + profile.durationDays);
      harvestDate = d.toISOString().slice(0, 10);
    }
  }

  const daysToHarvest =
    harvestDate == null
      ? null
      : Math.round((Date.parse(harvestDate) - Date.now()) / 86_400_000);

  const items: SafetyItem[] = [];
  for (const input of inputs) {
    const ref = await lookupPHI(input, crop);
    const { verdict, note } = verdictFor(ref.pre_harvest_interval_days, daysToHarvest);
    items.push({
      input,
      matched: ref.pesticide_name,
      activeIngredient: ref.active_ingredient,
      phiDays: ref.pre_harvest_interval_days,
      source: ref.source,
      verdict,
      note,
    });
  }

  const overall =
    items.length === 0
      ? 'unknown'
      : (Object.entries(RANK)
          .sort((a, b) => b[1] - a[1])
          .find(([v]) => items.some((i) => i.verdict === v))?.[0] as SafetyItem['verdict']);

  return {
    scanId,
    crop,
    expectedHarvestDate: harvestDate,
    daysToHarvest,
    overall,
    items,
    disclaimer: DISCLAIMER,
  };
}
