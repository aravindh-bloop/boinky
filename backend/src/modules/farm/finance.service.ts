import { query, queryOne } from '../../db/query.js';
import { AppError } from '../../http/errors.js';

export const EXPENSE_CATEGORIES = [
  'seed',
  'fertilizer',
  'pesticide',
  'labour',
  'machinery',
  'irrigation',
  'transport',
  'other',
] as const;

export interface ExpenseRow {
  id: string;
  field_id: string | null;
  field_name: string | null;
  category: string;
  description: string | null;
  amount: number;
  spent_on: string;
  created_at: string;
}

const E_SELECT = `
  e.id, e.field_id, coalesce(f.name, f.crop) AS field_name,
  e.category, e.description, e.amount,
  to_char(e.spent_on, 'YYYY-MM-DD') AS spent_on, e.created_at
`;

export async function createExpense(
  farmerId: string,
  input: {
    fieldId?: string;
    category: string;
    description?: string;
    amount: number;
    spentOn?: string;
  },
): Promise<ExpenseRow> {
  const [row] = await query<ExpenseRow>(
    `WITH ins AS (
       INSERT INTO expenses (farmer_id, field_id, category, description, amount, spent_on)
       VALUES ($1,$2,$3,$4,$5, coalesce($6::date, CURRENT_DATE)) RETURNING *
     )
     SELECT ${E_SELECT} FROM ins e LEFT JOIN fields f ON f.id = e.field_id`,
    [farmerId, input.fieldId ?? null, input.category, input.description ?? null, input.amount, input.spentOn ?? null],
  );
  return row!;
}

export async function listExpenses(opts: {
  farmerId: string;
  fieldId?: string;
  limit: number;
  offset: number;
}): Promise<ExpenseRow[]> {
  const params: unknown[] = [opts.farmerId];
  let where = 'e.farmer_id = $1';
  if (opts.fieldId) {
    params.push(opts.fieldId);
    where += ` AND e.field_id = $${params.length}`;
  }
  params.push(opts.limit, opts.offset);
  return query<ExpenseRow>(
    `SELECT ${E_SELECT} FROM expenses e LEFT JOIN fields f ON f.id = e.field_id
      WHERE ${where} ORDER BY e.spent_on DESC, e.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
}

export async function deleteExpense(id: string, farmerId: string): Promise<void> {
  const rows = await query(`DELETE FROM expenses WHERE id = $1 AND farmer_id = $2 RETURNING id`, [id, farmerId]);
  if (rows.length === 0) throw AppError.notFound('Expense not found');
}

// ── Harvests ──

export interface HarvestRow {
  id: string;
  field_id: string | null;
  field_name: string | null;
  harvested_on: string;
  crop: string | null;
  quantity: number;
  unit: string;
  unit_price: number | null;
  revenue: number | null;
  buyer: string | null;
  note: string | null;
  created_at: string;
}

const H_SELECT = `
  h.id, h.field_id, coalesce(f.name, f.crop) AS field_name,
  to_char(h.harvested_on, 'YYYY-MM-DD') AS harvested_on,
  h.crop, h.quantity, h.unit, h.unit_price, h.revenue, h.buyer, h.note, h.created_at
`;

export async function createHarvest(
  farmerId: string,
  input: {
    fieldId?: string;
    harvestedOn?: string;
    crop?: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    revenue?: number;
    buyer?: string;
    note?: string;
  },
): Promise<HarvestRow> {
  const revenue =
    input.revenue ?? (input.unitPrice != null ? input.unitPrice * input.quantity : null);
  const [row] = await query<HarvestRow>(
    `WITH ins AS (
       INSERT INTO harvests (farmer_id, field_id, harvested_on, crop, quantity, unit, unit_price, revenue, buyer, note)
       VALUES ($1,$2, coalesce($3::date, CURRENT_DATE), $4,$5, coalesce($6,'quintal'), $7,$8,$9,$10)
       RETURNING *
     )
     SELECT ${H_SELECT} FROM ins h LEFT JOIN fields f ON f.id = h.field_id`,
    [
      farmerId,
      input.fieldId ?? null,
      input.harvestedOn ?? null,
      input.crop ?? null,
      input.quantity,
      input.unit ?? null,
      input.unitPrice ?? null,
      revenue,
      input.buyer ?? null,
      input.note ?? null,
    ],
  );
  return row!;
}

export async function listHarvests(opts: {
  farmerId: string;
  fieldId?: string;
  limit: number;
  offset: number;
}): Promise<HarvestRow[]> {
  const params: unknown[] = [opts.farmerId];
  let where = 'h.farmer_id = $1';
  if (opts.fieldId) {
    params.push(opts.fieldId);
    where += ` AND h.field_id = $${params.length}`;
  }
  params.push(opts.limit, opts.offset);
  return query<HarvestRow>(
    `SELECT ${H_SELECT} FROM harvests h LEFT JOIN fields f ON f.id = h.field_id
      WHERE ${where} ORDER BY h.harvested_on DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
}

export async function deleteHarvest(id: string, farmerId: string): Promise<void> {
  const rows = await query(`DELETE FROM harvests WHERE id = $1 AND farmer_id = $2 RETURNING id`, [id, farmerId]);
  if (rows.length === 0) throw AppError.notFound('Harvest not found');
}

// ── Summary (season overview) ──

export interface FinanceSummary {
  since: string;
  totalSpent: number;
  totalRevenue: number;
  net: number;
  byCategory: { category: string; amount: number }[];
  byField: { fieldId: string | null; fieldName: string | null; spent: number; revenue: number }[];
  harvestQty: { unit: string; quantity: number }[];
}

export async function financeSummary(farmerId: string, days: number): Promise<FinanceSummary> {
  const since = `now() - make_interval(days => ${Math.max(1, Math.min(3650, days))})`;

  const spent = await queryOne<{ total: number }>(
    `SELECT coalesce(sum(amount),0)::float AS total FROM expenses
      WHERE farmer_id = $1 AND spent_on > ${since}`,
    [farmerId],
  );
  const rev = await queryOne<{ total: number }>(
    `SELECT coalesce(sum(revenue),0)::float AS total FROM harvests
      WHERE farmer_id = $1 AND harvested_on > ${since}`,
    [farmerId],
  );
  const byCategory = await query<{ category: string; amount: number }>(
    `SELECT category, sum(amount)::float AS amount FROM expenses
      WHERE farmer_id = $1 AND spent_on > ${since}
      GROUP BY category ORDER BY amount DESC`,
    [farmerId],
  );
  const byField = await query<{ fieldId: string | null; fieldName: string | null; spent: number; revenue: number }>(
    `SELECT fld.id AS "fieldId", coalesce(fld.name, fld.crop) AS "fieldName",
            coalesce(ex.spent,0)::float AS spent, coalesce(hv.revenue,0)::float AS revenue
       FROM fields fld
       LEFT JOIN (SELECT field_id, sum(amount) spent FROM expenses
                   WHERE farmer_id = $1 AND spent_on > ${since} GROUP BY field_id) ex ON ex.field_id = fld.id
       LEFT JOIN (SELECT field_id, sum(revenue) revenue FROM harvests
                   WHERE farmer_id = $1 AND harvested_on > ${since} GROUP BY field_id) hv ON hv.field_id = fld.id
      WHERE fld.farmer_id = $1
      ORDER BY revenue DESC, spent DESC`,
    [farmerId],
  );
  const harvestQty = await query<{ unit: string; quantity: number }>(
    `SELECT unit, sum(quantity)::float AS quantity FROM harvests
      WHERE farmer_id = $1 AND harvested_on > ${since}
      GROUP BY unit`,
    [farmerId],
  );

  return {
    since: `${days} days`,
    totalSpent: spent.total,
    totalRevenue: rev.total,
    net: rev.total - spent.total,
    byCategory,
    byField,
    harvestQty,
  };
}
