import { query, queryMaybe, withTransaction } from '../../db/query.js';
import { AppError } from '../../http/errors.js';
import { logger } from '../../lib/logger.js';
import { getUserById } from '../auth/auth.service.js';
import { toSarvamLang, translate } from '../../integrations/sarvam.js';
import { askAssistant, type AssistantTurn } from '../../integrations/gemini.js';
import { buildFarmContext, contextForModel } from '../insights/context.js';
import { getFarmerProfile, recordEvent } from '../insights/profile.service.js';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  helpful: boolean | null;
  created_at: string;
}

export interface ThreadSummary {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string;
  last_message: string | null;
}

export async function listThreads(farmerId: string): Promise<ThreadSummary[]> {
  return query<ThreadSummary>(
    `SELECT t.id, t.title, t.last_message_at, t.created_at,
            (SELECT body FROM assistant_messages m WHERE m.thread_id = t.id
              ORDER BY created_at DESC LIMIT 1) AS last_message
       FROM assistant_threads t
      WHERE t.farmer_id = $1
      ORDER BY t.last_message_at DESC
      LIMIT 50`,
    [farmerId],
  );
}

export async function getThread(
  threadId: string,
  farmerId: string,
): Promise<{ id: string; title: string; messages: AssistantMessage[] }> {
  const thread = await queryMaybe<{ id: string; title: string; farmer_id: string }>(
    `SELECT id, title, farmer_id FROM assistant_threads WHERE id = $1`,
    [threadId],
  );
  if (!thread) throw AppError.notFound('Conversation not found');
  if (thread.farmer_id !== farmerId) throw AppError.forbidden('Not your conversation');
  const messages = await query<AssistantMessage>(
    `SELECT id, role, body, helpful, created_at FROM assistant_messages
      WHERE thread_id = $1 ORDER BY created_at`,
    [threadId],
  );
  return { id: thread.id, title: thread.title, messages };
}

/**
 * Ask a question. Creates the thread on the first message. The answer is
 * grounded in the farmer's real FarmContext + their profile, drafted in English
 * by Gemini, then translated to their language.
 */
export async function ask(
  farmerId: string,
  text: string,
  threadId?: string,
): Promise<{ threadId: string; message: AssistantMessage }> {
  const question = text.trim();
  if (!question) throw AppError.badRequest('Ask a question');

  const me = await getUserById(farmerId);
  const lang = toSarvamLang(me.preferred_language);

  // Resolve / create the thread.
  let tid = threadId;
  let history: AssistantTurn[] = [];
  if (tid) {
    const existing = await getThread(tid, farmerId);
    history = existing.messages.map((m) => ({ role: m.role, content: m.body }));
  } else {
    const [row] = await query<{ id: string }>(
      `INSERT INTO assistant_threads (farmer_id, title) VALUES ($1, $2) RETURNING id`,
      [farmerId, question.slice(0, 60)],
    );
    tid = row!.id;
  }

  // Build grounding.
  const [ctx, profile] = await Promise.all([
    buildFarmContext(farmerId, { liveWeather: false }),
    getFarmerProfile(farmerId).catch(() => null),
  ]);

  const englishAnswer = await askAssistant(
    JSON.stringify(contextForModel(ctx)),
    profile?.summary ?? '',
    history,
    question,
  );

  let localised = englishAnswer;
  if (lang !== 'en-IN') {
    localised = await translate(englishAnswer, lang).catch(() => englishAnswer);
  }

  const saved = await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO assistant_messages (thread_id, role, body) VALUES ($1, 'user', $2)`,
      [tid, question],
    );
    const { rows } = await client.query<AssistantMessage>(
      `INSERT INTO assistant_messages (thread_id, role, body, body_en) VALUES ($1, 'assistant', $2, $3)
       RETURNING id, role, body, helpful, created_at`,
      [tid, localised, englishAnswer],
    );
    await client.query(
      `UPDATE assistant_threads SET last_message_at = now() WHERE id = $1`,
      [tid],
    );
    return rows[0]!;
  });

  void recordEvent(farmerId, 'chat', `Asked the assistant: "${question.slice(0, 140)}"`, tid);

  logger.info({ farmerId, threadId: tid }, 'assistant answered');
  return { threadId: tid, message: saved };
}

export async function rateMessage(
  messageId: string,
  farmerId: string,
  helpful: boolean,
): Promise<void> {
  const row = await queryMaybe<{ body_en: string | null; thread_id: string }>(
    `SELECT m.body_en, m.thread_id
       FROM assistant_messages m
       JOIN assistant_threads t ON t.id = m.thread_id
      WHERE m.id = $1 AND t.farmer_id = $2 AND m.role = 'assistant'`,
    [messageId, farmerId],
  );
  if (!row) throw AppError.notFound('Message not found');
  await query(`UPDATE assistant_messages SET helpful = $2 WHERE id = $1`, [messageId, helpful]);
  if (!helpful && row.body_en) {
    await recordEvent(
      farmerId,
      'advisory_feedback',
      `Said an assistant answer was not helpful: "${row.body_en.slice(0, 140)}"`,
      row.thread_id,
    );
  }
}
