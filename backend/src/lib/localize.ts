import { createHash } from 'node:crypto';
import { query } from '../db/query.js';
import { logger } from '../lib/logger.js';
import { translate, toSarvamLang } from '../integrations/sarvam.js';
import { integrations } from '../config/env.js';

/**
 * Translate a batch of English strings into `lang`, reusing anything already in
 * `translation_cache`. English (`en-IN`) is a no-op. Never throws — on failure a
 * string falls back to its English source, and partial results are never cached.
 *
 * Used both by the app UI-string endpoint and by services that return generated
 * English prose (calendar titles, weather advisories, alert reasoning).
 */

const SEP = '\n<<@@>>\n';
const hash = (s: string) => createHash('sha1').update(s).digest('hex');

export async function localizeMany(texts: string[], lang: string): Promise<string[]> {
  const target = toSarvamLang(lang);
  if (target === 'en-IN' || !integrations.sarvam || texts.length === 0) return texts;

  // de-duplicate: translate each distinct non-empty string once
  const distinct = [...new Set(texts.filter((t) => t && t.trim()))];
  if (distinct.length === 0) return texts;

  const result = new Map<string, string>();

  // 1. cache hits
  const hashes = distinct.map(hash);
  const cached = await query<{ source_text: string; translated: string }>(
    `SELECT source_text, translated FROM translation_cache
      WHERE lang = $1 AND source_hash = ANY($2)`,
    [target, hashes],
  ).catch(() => []);
  for (const row of cached) result.set(row.source_text, row.translated);

  // 2. misses -> Sarvam, in small delimiter-joined batches. Each batch is
  //    persisted as soon as it completes, so a request that is abandoned
  //    (client timeout) still leaves progress in the cache for next time.
  const misses = distinct.filter((t) => !result.has(t));
  for (const batch of chunk(misses, 12)) {
    try {
      const joined = await translate(batch.join(SEP), target);
      const parts = joined.split(SEP).map((s) => s.trim());
      const ok = parts.length === batch.length;
      const done: string[] = [];
      for (let i = 0; i < batch.length; i++) {
        const src = batch[i]!;
        const tr = ok && parts[i] ? parts[i]! : await translate(src, target).catch(() => src);
        result.set(src, tr);
        done.push(src);
      }
      await persist(target, result, done);
    } catch (err) {
      logger.warn({ err, lang: target, n: batch.length }, 'localize: batch failed');
      for (const m of batch) if (!result.has(m)) result.set(m, m);
    }
  }

  return texts.map((t) => (t && result.has(t) ? result.get(t)! : t));
}

/** Translate a single string. */
export async function localize(text: string, lang: string): Promise<string> {
  return (await localizeMany([text], lang))[0]!;
}

/**
 * Cache-only lookup — never calls Sarvam. Returns a { source: translated } map of
 * whatever is already cached, plus the list of strings still missing. Used by the
 * app's UI-string endpoint so it can answer instantly and translate the misses in
 * the background.
 */
export async function localizeCached(
  texts: string[],
  lang: string,
): Promise<{ map: Record<string, string>; missing: string[] }> {
  const target = toSarvamLang(lang);
  const distinct = [...new Set(texts.filter((t) => t && t.trim()))];
  const map: Record<string, string> = {};
  if (target === 'en-IN' || distinct.length === 0) {
    for (const t of distinct) map[t] = t;
    return { map, missing: [] };
  }
  const rows = await query<{ source_text: string; translated: string }>(
    `SELECT source_text, translated FROM translation_cache
      WHERE lang = $1 AND source_hash = ANY($2)`,
    [target, distinct.map(hash)],
  ).catch(() => []);
  for (const r of rows) map[r.source_text] = r.translated;
  const missing = distinct.filter((t) => !(t in map));
  return { map, missing };
}

async function persist(target: string, result: Map<string, string>, keys: string[]): Promise<void> {
  const rows = keys
    .filter((k) => result.get(k) && result.get(k) !== k)
    .map((k) => ({ h: hash(k), src: k, tr: result.get(k)! }));
  if (rows.length === 0) return;
  const values: string[] = [];
  const params: unknown[] = [];
  rows.forEach((r, i) => {
    const b = i * 4;
    values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4})`);
    params.push(r.h, target, r.src, r.tr);
  });
  await query(
    `INSERT INTO translation_cache (source_hash, lang, source_text, translated)
     VALUES ${values.join(', ')}
     ON CONFLICT (source_hash, lang) DO NOTHING`,
    params,
  ).catch((err) => logger.warn({ err }, 'localize: cache write failed'));
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
