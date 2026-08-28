import { query, queryMaybe } from '../../db/query.js';
import { AppError } from '../../http/errors.js';
import { getUserById } from '../auth/auth.service.js';

export interface SchemeRow {
  id: string;
  title: string;
  description: string | null;
  eligibility_criteria: Record<string, unknown> | null;
  benefit_amount: string | null;
  apply_link: string | null;
  created_at: string;
  relevant?: boolean;
  match_reasons?: string[];
}

interface FarmerContext {
  region: string | null;
  crops: string[];
}

/** Decide whether a scheme is relevant to a farmer and why. */
function evaluate(
  scheme: SchemeRow,
  ctx: FarmerContext,
): { relevant: boolean; reasons: string[] } {
  const el = scheme.eligibility_criteria ?? {};
  const reasons: string[] = [];
  let relevant = true;

  const asList = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).toLowerCase()) : v == null ? [] : [String(v).toLowerCase()];

  // State (all app users are treated as Maharashtra for this build)
  if (typeof el.state === 'string') {
    if (el.state.toLowerCase() === 'maharashtra') reasons.push('available in Maharashtra');
    else relevant = false;
  }

  // District list
  if (Array.isArray(el.districts)) {
    const districts = asList(el.districts);
    if (ctx.region && districts.includes(ctx.region.toLowerCase())) {
      reasons.push(`covers ${ctx.region} district`);
    } else {
      relevant = false;
    }
  }

  // Crop targeting
  if (el.crop != null) {
    const wanted = asList(el.crop);
    const hit = ctx.crops.find((c) => wanted.some((w) => c.includes(w) || w.includes(c)));
    if (hit) reasons.push(`supports ${hit}`);
    else relevant = false;
  }

  // Practice (e.g. organic) — informational, don't exclude
  if (typeof el.practice === 'string') reasons.push(`for ${el.practice} farming`);
  if (typeof el.purpose === 'string') reasons.push(`for ${el.purpose}`);

  if (relevant && reasons.length === 0) reasons.push('open to all farmers');
  return { relevant, reasons };
}

export interface ListSchemesOptions {
  farmerId?: string;
  onlyRelevant?: boolean;
  search?: string;
}

export async function listSchemes(opts: ListSchemesOptions): Promise<SchemeRow[]> {
  const params: unknown[] = [];
  let where = 'TRUE';
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`);
    where = `(lower(title) LIKE $1 OR lower(description) LIKE $1)`;
  }
  const rows = await query<SchemeRow>(
    `SELECT id, title, description, eligibility_criteria, benefit_amount, apply_link, created_at
       FROM schemes WHERE ${where} ORDER BY title`,
    params,
  );

  if (!opts.farmerId) return rows;

  const me = await getUserById(opts.farmerId);
  const crops = await query<{ crop: string }>(
    `SELECT DISTINCT lower(crop) AS crop FROM fields WHERE farmer_id = $1`,
    [opts.farmerId],
  );
  const ctx: FarmerContext = { region: me.region, crops: crops.map((c) => c.crop) };

  const evaluated = rows.map((s) => {
    const { relevant, reasons } = evaluate(s, ctx);
    return { ...s, relevant, match_reasons: reasons };
  });

  const sorted = evaluated.sort(
    (a, b) => Number(b.relevant) - Number(a.relevant) || a.title.localeCompare(b.title),
  );
  return opts.onlyRelevant ? sorted.filter((s) => s.relevant) : sorted;
}

export async function getScheme(id: string): Promise<SchemeRow> {
  const row = await queryMaybe<SchemeRow>(
    `SELECT id, title, description, eligibility_criteria, benefit_amount, apply_link, created_at
       FROM schemes WHERE id = $1`,
    [id],
  );
  if (!row) throw AppError.notFound('Scheme not found');
  return row;
}
