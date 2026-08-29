import { query, queryMaybe, queryOne, withTransaction } from '../../db/query.js';
import { AppError } from '../../http/errors.js';

export type AppStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'disbursed';
export type ThreadStatus = 'open' | 'answered' | 'closed';

const TERMINAL: AppStatus[] = ['rejected', 'disbursed'];

// ── farmer side ───────────────────────────────────────────────────────────

/** Apply for a scheme. Re-applying after a rejection resets the row to 'submitted'. */
export async function applyForScheme(farmerId: string, schemeId: string, note: string | null) {
  const scheme = await queryMaybe<{ id: string }>(`SELECT id FROM schemes WHERE id = $1`, [schemeId]);
  if (!scheme) throw AppError.notFound('Scheme not found');

  return queryOne(
    `INSERT INTO scheme_applications (scheme_id, farmer_id, farmer_note)
     VALUES ($1, $2, $3)
     ON CONFLICT (scheme_id, farmer_id) DO UPDATE SET
       status = CASE WHEN scheme_applications.status = 'rejected' THEN 'submitted'
                     ELSE scheme_applications.status END,
       farmer_note = COALESCE(EXCLUDED.farmer_note, scheme_applications.farmer_note),
       updated_at = now()
     RETURNING *`,
    [schemeId, farmerId, note],
  );
}

export async function listMyApplications(farmerId: string) {
  return query(
    `SELECT a.id, a.scheme_id, s.title AS scheme_title, a.status, a.farmer_note,
            a.officer_note, a.amount, a.reviewed_at, a.created_at, a.updated_at
       FROM scheme_applications a
       JOIN schemes s ON s.id = a.scheme_id
      WHERE a.farmer_id = $1
      ORDER BY a.updated_at DESC`,
    [farmerId],
  );
}

export async function withdrawApplication(farmerId: string, id: string) {
  const row = await queryMaybe<{ status: AppStatus }>(
    `SELECT status FROM scheme_applications WHERE id = $1 AND farmer_id = $2`,
    [id, farmerId],
  );
  if (!row) throw AppError.notFound('Application not found');
  if (TERMINAL.includes(row.status) || row.status === 'approved') {
    throw AppError.badRequest(`Cannot withdraw an application that is already ${row.status}`);
  }
  await query(`DELETE FROM scheme_applications WHERE id = $1 AND farmer_id = $2`, [id, farmerId]);
}

// ── threads (both sides) ──────────────────────────────────────────────────

export async function createThread(
  farmerId: string,
  input: { schemeId?: string; applicationId?: string; subject: string; body: string },
) {
  return withTransaction(async (c) => {
    const t = await c.query<{ id: string }>(
      `INSERT INTO scheme_threads (scheme_id, application_id, farmer_id, subject)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [input.schemeId ?? null, input.applicationId ?? null, farmerId, input.subject.trim()],
    );
    const threadId = t.rows[0]!.id;
    await c.query(
      `INSERT INTO scheme_messages (thread_id, sender_id, sender_role, body)
       VALUES ($1, $2, 'farmer', $3)`,
      [threadId, farmerId, input.body.trim()],
    );
    return threadId;
  });
}

export async function getThread(threadId: string, actor: { id: string; role: string }) {
  const thread = await queryMaybe<{
    id: string;
    farmer_id: string;
    scheme_id: string | null;
    scheme_title: string | null;
    subject: string;
    status: ThreadStatus;
    created_at: string;
    farmer_name: string;
  }>(
    `SELECT th.id, th.farmer_id, th.scheme_id, s.title AS scheme_title, th.subject,
            th.status, th.created_at, u.name AS farmer_name
       FROM scheme_threads th
       JOIN users u ON u.id = th.farmer_id
       LEFT JOIN schemes s ON s.id = th.scheme_id
      WHERE th.id = $1`,
    [threadId],
  );
  if (!thread) throw AppError.notFound('Conversation not found');
  if (actor.role === 'farmer' && thread.farmer_id !== actor.id) {
    throw AppError.forbidden('This conversation belongs to another farmer');
  }
  const messages = await query(
    `SELECT id, sender_role, body, created_at FROM scheme_messages
      WHERE thread_id = $1 ORDER BY created_at`,
    [threadId],
  );
  return { thread, messages };
}

export async function postMessage(
  threadId: string,
  actor: { id: string; role: string },
  body: string,
) {
  const thread = await queryMaybe<{ farmer_id: string; status: ThreadStatus }>(
    `SELECT farmer_id, status FROM scheme_threads WHERE id = $1`,
    [threadId],
  );
  if (!thread) throw AppError.notFound('Conversation not found');
  if (actor.role === 'farmer' && thread.farmer_id !== actor.id) {
    throw AppError.forbidden('Not your conversation');
  }
  const role = actor.role === 'official' ? 'official' : 'farmer';
  await withTransaction(async (c) => {
    await c.query(
      `INSERT INTO scheme_messages (thread_id, sender_id, sender_role, body)
       VALUES ($1, $2, $3, $4)`,
      [threadId, actor.id, role, body.trim()],
    );
    // a farmer message reopens; an officer message marks answered
    await c.query(
      `UPDATE scheme_threads
          SET last_message_at = now(),
              status = CASE WHEN $2 = 'official' THEN 'answered'
                            WHEN status = 'closed' THEN 'closed'
                            ELSE 'open' END
        WHERE id = $1`,
      [threadId, role],
    );
  });
}

export async function listMyThreads(farmerId: string) {
  return query(
    `SELECT th.id, th.subject, th.status, th.scheme_id, s.title AS scheme_title,
            th.last_message_at, th.created_at,
            (SELECT body FROM scheme_messages m WHERE m.thread_id = th.id
              ORDER BY m.created_at DESC LIMIT 1) AS last_message
       FROM scheme_threads th
       LEFT JOIN schemes s ON s.id = th.scheme_id
      WHERE th.farmer_id = $1
      ORDER BY th.last_message_at DESC`,
    [farmerId],
  );
}

export async function setThreadStatus(threadId: string, status: ThreadStatus) {
  await query(`UPDATE scheme_threads SET status = $2 WHERE id = $1`, [threadId, status]);
}

// ── officer side ─────────────────────────────────────────────────────────

export interface OfficerAppFilter {
  region: string | null;
  status?: AppStatus;
  schemeId?: string;
  search?: string;
  limit: number;
  offset: number;
}

export async function listApplicationsForOfficer(f: OfficerAppFilter) {
  const params: unknown[] = [];
  const where: string[] = ['TRUE'];
  if (f.region) {
    params.push(f.region);
    where.push(`u.region = $${params.length}`);
  }
  if (f.status) {
    params.push(f.status);
    where.push(`a.status = $${params.length}`);
  }
  if (f.schemeId) {
    params.push(f.schemeId);
    where.push(`a.scheme_id = $${params.length}`);
  }
  if (f.search) {
    params.push(`%${f.search.toLowerCase()}%`);
    where.push(`(lower(u.name) LIKE $${params.length} OR u.phone LIKE $${params.length})`);
  }
  params.push(f.limit, f.offset);
  return query(
    `SELECT a.id, a.status, a.farmer_note, a.officer_note, a.amount,
            a.created_at, a.updated_at, a.reviewed_at,
            s.id AS scheme_id, s.title AS scheme_title, s.benefit_amount,
            u.id AS farmer_id, u.name AS farmer_name, u.phone AS farmer_phone, u.region
       FROM scheme_applications a
       JOIN schemes s ON s.id = a.scheme_id
       JOIN users u ON u.id = a.farmer_id
      WHERE ${where.join(' AND ')}
      ORDER BY a.updated_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
}

export async function decideApplication(
  id: string,
  officerId: string,
  input: { status: AppStatus; note?: string | null; amount?: number | null },
) {
  const exists = await queryMaybe<{ id: string }>(
    `SELECT id FROM scheme_applications WHERE id = $1`,
    [id],
  );
  if (!exists) throw AppError.notFound('Application not found');
  if (input.status === 'disbursed' && (input.amount == null || input.amount < 0)) {
    throw AppError.badRequest('An amount is required to mark an application disbursed');
  }
  return queryOne(
    `UPDATE scheme_applications
        SET status = $2,
            officer_note = COALESCE($3, officer_note),
            amount = CASE WHEN $2 = 'disbursed' THEN $4 ELSE amount END,
            reviewed_by = $5,
            reviewed_at = now(),
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [id, input.status, input.note ?? null, input.amount ?? null, officerId],
  );
}

export async function listThreadsForOfficer(region: string | null, status?: ThreadStatus) {
  const params: unknown[] = [];
  const where: string[] = ['TRUE'];
  if (region) {
    params.push(region);
    where.push(`u.region = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`th.status = $${params.length}`);
  }
  return query(
    `SELECT th.id, th.subject, th.status, th.scheme_id, s.title AS scheme_title,
            th.last_message_at, th.created_at,
            u.name AS farmer_name, u.phone AS farmer_phone,
            (SELECT body FROM scheme_messages m WHERE m.thread_id = th.id
              ORDER BY m.created_at DESC LIMIT 1) AS last_message,
            (SELECT sender_role FROM scheme_messages m WHERE m.thread_id = th.id
              ORDER BY m.created_at DESC LIMIT 1) AS last_sender
       FROM scheme_threads th
       JOIN users u ON u.id = th.farmer_id
       LEFT JOIN schemes s ON s.id = th.scheme_id
      WHERE ${where.join(' AND ')}
      ORDER BY th.last_message_at DESC
      LIMIT 100`,
    params,
  );
}

export async function schemeSummaryForOfficer(region: string | null) {
  const params: unknown[] = [];
  const rf = region ? (params.push(region), `AND u.region = $1`) : '';
  const byStatus = await query<{ status: AppStatus; n: number; total: number }>(
    `SELECT a.status, count(*)::int AS n, coalesce(sum(a.amount),0)::float AS total
       FROM scheme_applications a JOIN users u ON u.id = a.farmer_id
      WHERE TRUE ${rf}
      GROUP BY a.status`,
    params,
  );
  const byScheme = await query<{
    scheme_id: string;
    title: string;
    applications: number;
    disbursed: number;
    amount: number;
  }>(
    `SELECT s.id AS scheme_id, s.title,
            count(a.id)::int AS applications,
            count(a.id) FILTER (WHERE a.status = 'disbursed')::int AS disbursed,
            coalesce(sum(a.amount) FILTER (WHERE a.status = 'disbursed'),0)::float AS amount
       FROM scheme_applications a
       JOIN schemes s ON s.id = a.scheme_id
       JOIN users u ON u.id = a.farmer_id
      WHERE TRUE ${rf}
      GROUP BY s.id, s.title
      ORDER BY applications DESC`,
    params,
  );
  const q = await queryOne<{ open: number }>(
    `SELECT count(*)::int AS open
       FROM scheme_threads th JOIN users u ON u.id = th.farmer_id
      WHERE th.status = 'open' ${rf}`,
    params,
  );

  const statusMap = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));
  const totalDisbursed = byStatus.find((r) => r.status === 'disbursed')?.total ?? 0;
  return {
    byStatus: statusMap,
    totalDisbursed,
    pendingReview: (statusMap['submitted'] ?? 0) + (statusMap['under_review'] ?? 0),
    approvedNotDisbursed: statusMap['approved'] ?? 0,
    openQueries: q.open,
    byScheme,
  };
}
