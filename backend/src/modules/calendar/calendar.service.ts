import { query, queryMaybe, withTransaction } from '../../db/query.js';
import { AppError } from '../../http/errors.js';
import { logger } from '../../lib/logger.js';
import { generateTasks, type TaskType } from './task-templates.js';
import { localizeMany } from '../../lib/localize.js';
import { farmerLang } from '../../lib/farmer-lang.js';

export interface CalendarTask {
  id: string;
  field_id: string;
  task_date: string;
  task_type: string | null;
  title: string;
  description: string | null;
  source: string;
  is_done: boolean;
  created_at: string;
}

const taskCols = (p = '') => `
  ${p}id, ${p}field_id, to_char(${p}task_date, 'YYYY-MM-DD') AS task_date,
  ${p}task_type, ${p}title, ${p}description, ${p}source, ${p}is_done, ${p}created_at
`;
const TASK_SELECT = taskCols();

interface FieldLite {
  id: string;
  farmer_id: string;
  crop: string;
  sown_date: string | null;
}

async function getOwnedFieldLite(fieldId: string, farmerId: string): Promise<FieldLite> {
  const row = await queryMaybe<FieldLite>(
    `SELECT id, farmer_id, crop, to_char(sown_date,'YYYY-MM-DD') AS sown_date
       FROM fields WHERE id = $1`,
    [fieldId],
  );
  if (!row) throw AppError.notFound('Field not found');
  if (row.farmer_id !== farmerId) throw AppError.forbidden('This field belongs to another farmer');
  return row;
}

/** Assert the task belongs to a field owned by this farmer; return it. */
async function getOwnedTask(taskId: string, farmerId: string): Promise<CalendarTask> {
  const row = await queryMaybe<CalendarTask & { farmer_id: string }>(
    `SELECT ${taskCols('t.')}, f.farmer_id
       FROM calendar_tasks t JOIN fields f ON f.id = t.field_id
      WHERE t.id = $1`,
    [taskId],
  );
  if (!row) throw AppError.notFound('Task not found');
  if (row.farmer_id !== farmerId) throw AppError.forbidden('Not your task');
  return row;
}

/**
 * (Re)build the system-generated calendar for a field from crop-stage templates.
 * Preserves manually added tasks and the done/undone state of regenerated tasks.
 */
export async function regenerateFieldCalendar(
  fieldId: string,
  farmerId: string,
): Promise<{ created: number }> {
  const field = await getOwnedFieldLite(fieldId, farmerId);
  if (!field.sown_date) {
    throw AppError.badRequest('Set a sowing date on this field to generate its calendar');
  }
  const sown = new Date(field.sown_date);
  const generated = generateTasks(field.crop);

  return withTransaction(async (client) => {
    const { rows: prevDone } = await client.query<{ key: string }>(
      `SELECT to_char(task_date,'YYYY-MM-DD') || '|' || title AS key
         FROM calendar_tasks WHERE field_id = $1 AND source = 'system' AND is_done = true`,
      [fieldId],
    );
    const doneKeys = new Set(prevDone.map((r) => r.key));

    await client.query(`DELETE FROM calendar_tasks WHERE field_id = $1 AND source = 'system'`, [
      fieldId,
    ]);

    let created = 0;
    for (const t of generated) {
      const date = new Date(sown);
      date.setDate(date.getDate() + t.offsetDays);
      const iso = date.toISOString().slice(0, 10);
      await client.query(
        `INSERT INTO calendar_tasks
           (field_id, task_date, task_type, title, description, source, is_done)
         VALUES ($1, $2, $3, $4, $5, 'system', $6)`,
        [fieldId, iso, t.taskType, t.title, t.description, doneKeys.has(`${iso}|${t.title}`)],
      );
      created++;
    }
    logger.info({ fieldId, created }, 'regenerated crop calendar');
    return { created };
  });
}

export async function listTasks(
  fieldId: string,
  farmerId: string,
  range: { from?: string; to?: string },
): Promise<CalendarTask[]> {
  await getOwnedFieldLite(fieldId, farmerId);
  const params: unknown[] = [fieldId];
  const where = [`field_id = $1`];
  if (range.from) {
    params.push(range.from);
    where.push(`task_date >= $${params.length}`);
  }
  if (range.to) {
    params.push(range.to);
    where.push(`task_date <= $${params.length}`);
  }
  const tasks = await query<CalendarTask>(
    `SELECT ${TASK_SELECT} FROM calendar_tasks
      WHERE ${where.join(' AND ')}
      ORDER BY task_date, task_type`,
    params,
  );
  return localizeTasks(tasks, farmerId);
}

/** Translate task title/description to the farmer's language on read. */
export async function localizeTasks<T extends { title: string; description: string | null }>(
  tasks: T[],
  farmerId: string,
): Promise<T[]> {
  const lang = await farmerLang(farmerId).catch(() => 'en-IN');
  if (lang === 'en-IN' || tasks.length === 0) return tasks;
  const parts = tasks.flatMap((t) => [t.title, t.description ?? '']);
  const tr = await localizeMany(parts, lang).catch(() => parts);
  return tasks.map((t, i) => ({
    ...t,
    title: tr[i * 2] ?? t.title,
    description: t.description ? (tr[i * 2 + 1] ?? t.description) : t.description,
  }));
}

export interface AddTaskInput {
  taskDate: string;
  title: string;
  taskType?: TaskType;
  description?: string;
}

export async function addTask(
  fieldId: string,
  farmerId: string,
  input: AddTaskInput,
): Promise<CalendarTask> {
  await getOwnedFieldLite(fieldId, farmerId);
  const [row] = await query<CalendarTask>(
    `INSERT INTO calendar_tasks (field_id, task_date, task_type, title, description, source)
     VALUES ($1, $2, $3, $4, $5, 'user')
     RETURNING ${TASK_SELECT}`,
    [fieldId, input.taskDate, input.taskType ?? 'other', input.title, input.description ?? null],
  );
  return row!;
}

export async function updateTask(
  taskId: string,
  farmerId: string,
  patch: { isDone?: boolean; title?: string; description?: string; taskDate?: string },
): Promise<CalendarTask> {
  await getOwnedTask(taskId, farmerId);
  const [row] = await query<CalendarTask>(
    `UPDATE calendar_tasks SET
       is_done = COALESCE($2, is_done),
       title = COALESCE($3, title),
       description = COALESCE($4, description),
       task_date = COALESCE($5::date, task_date)
     WHERE id = $1
     RETURNING ${TASK_SELECT}`,
    [taskId, patch.isDone ?? null, patch.title ?? null, patch.description ?? null, patch.taskDate ?? null],
  );
  return row!;
}

export async function deleteTask(taskId: string, farmerId: string): Promise<void> {
  await getOwnedTask(taskId, farmerId);
  await query(`DELETE FROM calendar_tasks WHERE id = $1`, [taskId]);
}

/**
 * Add a follow-up "re-scan after treatment" task for a diseased scan. Best-effort:
 * a failure here must never fail the scan itself.
 */
export async function addScanFollowup(
  fieldId: string,
  diagnosisLabel: string,
  daysOut = 7,
): Promise<void> {
  try {
    const date = new Date();
    date.setDate(date.getDate() + daysOut);
    await query(
      `INSERT INTO calendar_tasks (field_id, task_date, task_type, title, description, source)
       VALUES ($1, $2, 'scouting', $3, $4, 'scan_derived')`,
      [
        fieldId,
        date.toISOString().slice(0, 10),
        `Re-check crop after treating ${diagnosisLabel}`,
        `About a week ago a scan showed ${diagnosisLabel}. Re-scan the same spot to confirm the treatment is working. If it has spread, escalate to an extension officer.`,
      ],
    );
  } catch (err) {
    logger.warn({ err, fieldId }, 'failed to add scan follow-up task (non-fatal)');
  }
}
