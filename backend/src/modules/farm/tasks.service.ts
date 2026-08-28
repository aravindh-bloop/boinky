import { query } from '../../db/query.js';

export interface AggTask {
  id: string;
  field_id: string;
  field_name: string | null;
  crop: string | null;
  task_date: string;
  task_type: string | null;
  title: string;
  description: string | null;
  source: string;
  is_done: boolean;
}

const SELECT = `
  t.id, t.field_id, coalesce(f.name, f.crop) AS field_name, f.crop,
  to_char(t.task_date,'YYYY-MM-DD') AS task_date,
  t.task_type, t.title, t.description, t.source, t.is_done
`;

/** All calendar tasks across the farmer's fields, split into overdue / today / upcoming. */
export async function getFarmerTasks(farmerId: string, upcomingDays = 14) {
  const rows = await query<AggTask>(
    `SELECT ${SELECT}
       FROM calendar_tasks t
       JOIN fields f ON f.id = t.field_id
      WHERE f.farmer_id = $1
        AND t.task_date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE + $2::int
      ORDER BY t.task_date, t.task_type`,
    [farmerId, upcomingDays],
  );

  const today = new Date().toISOString().slice(0, 10);
  const overdue: AggTask[] = [];
  const todays: AggTask[] = [];
  const upcoming: AggTask[] = [];

  for (const t of rows) {
    if (t.is_done && t.task_date < today) continue; // hide done past tasks
    if (t.task_date < today) overdue.push(t);
    else if (t.task_date === today) todays.push(t);
    else upcoming.push(t);
  }
  return { today: todays, overdue, upcoming, counts: { today: todays.length, overdue: overdue.length, upcoming: upcoming.length } };
}
