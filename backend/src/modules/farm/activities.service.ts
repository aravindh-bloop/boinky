import { query, queryMaybe, queryOne, withTransaction } from '../../db/query.js';
import { AppError } from '../../http/errors.js';
import { recordEvent } from '../insights/profile.service.js';

export const ACTIVITY_KINDS = [
  'irrigation',
  'spraying',
  'fertilizing',
  'sowing',
  'weeding',
  'scouting',
  'harvest',
  'other',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ActivityRow {
  id: string;
  farmer_id: string;
  field_id: string | null;
  field_name: string | null;
  kind: string;
  title: string;
  note: string | null;
  input_name: string | null;
  quantity: number | null;
  unit: string | null;
  cost: number | null;
  activity_date: string;
  created_at: string;
}

const SELECT = `
  a.id, a.farmer_id, a.field_id,
  coalesce(f.name, f.crop) AS field_name,
  a.kind, a.title, a.note, a.input_name, a.quantity, a.unit, a.cost,
  to_char(a.activity_date, 'YYYY-MM-DD') AS activity_date, a.created_at
`;

export interface ActivityInput {
  fieldId?: string;
  kind: ActivityKind;
  title: string;
  note?: string;
  inputName?: string;
  quantity?: number;
  unit?: string;
  cost?: number;
  activityDate?: string;
  sourceTaskId?: string;
  /** if true and cost>0, also record an expense row */
  logExpense?: boolean;
  expenseCategory?: string;
}

export async function createActivity(farmerId: string, input: ActivityInput): Promise<ActivityRow> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO activities
         (farmer_id, field_id, kind, title, note, input_name, quantity, unit, cost, activity_date, source_task_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, coalesce($10::date, CURRENT_DATE), $11)
       RETURNING id`,
      [
        farmerId,
        input.fieldId ?? null,
        input.kind,
        input.title,
        input.note ?? null,
        input.inputName ?? null,
        input.quantity ?? null,
        input.unit ?? null,
        input.cost ?? null,
        input.activityDate ?? null,
        input.sourceTaskId ?? null,
      ],
    );
    const id = rows[0]!.id;

    if (input.logExpense && input.cost && input.cost > 0) {
      await client.query(
        `INSERT INTO expenses (farmer_id, field_id, category, description, amount, spent_on, activity_id)
         VALUES ($1,$2,$3,$4,$5, coalesce($6::date, CURRENT_DATE), $7)`,
        [
          farmerId,
          input.fieldId ?? null,
          input.expenseCategory ?? categoryForKind(input.kind),
          input.title,
          input.cost,
          input.activityDate ?? null,
          id,
        ],
      );
    }

    if (input.sourceTaskId) {
      await client.query(`UPDATE calendar_tasks SET is_done = true WHERE id = $1`, [input.sourceTaskId]);
    }

    const { rows: full } = await client.query<ActivityRow>(
      `SELECT ${SELECT} FROM activities a LEFT JOIN fields f ON f.id = a.field_id WHERE a.id = $1`,
      [id],
    );
    const row = full[0]!;

    // Feed input-related activities into the farmer's AI profile — this is how
    // "productsTried" and "productsFailed" get populated over time.
    if (input.inputName || input.kind === 'spraying' || input.kind === 'fertilizing') {
      void recordEvent(
        farmerId,
        'activity',
        `Applied ${input.inputName ?? input.title}${row.field_name ? ` on ${row.field_name}` : ''}.`,
        id,
      );
    }
    return row;
  });
}

export async function listActivities(opts: {
  farmerId: string;
  fieldId?: string;
  limit: number;
  offset: number;
}): Promise<ActivityRow[]> {
  const params: unknown[] = [opts.farmerId];
  let where = 'a.farmer_id = $1';
  if (opts.fieldId) {
    params.push(opts.fieldId);
    where += ` AND a.field_id = $${params.length}`;
  }
  params.push(opts.limit, opts.offset);
  return query<ActivityRow>(
    `SELECT ${SELECT} FROM activities a LEFT JOIN fields f ON f.id = a.field_id
      WHERE ${where}
      ORDER BY a.activity_date DESC, a.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
}

export async function deleteActivity(id: string, farmerId: string): Promise<void> {
  const rows = await query(`DELETE FROM activities WHERE id = $1 AND farmer_id = $2 RETURNING id`, [
    id,
    farmerId,
  ]);
  if (rows.length === 0) throw AppError.notFound('Activity not found');
}

function categoryForKind(kind: string): string {
  switch (kind) {
    case 'spraying':
      return 'pesticide';
    case 'fertilizing':
      return 'fertilizer';
    case 'sowing':
      return 'seed';
    case 'irrigation':
      return 'irrigation';
    case 'weeding':
      return 'labour';
    default:
      return 'other';
  }
}
