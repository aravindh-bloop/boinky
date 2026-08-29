import { queryMaybe } from '../db/query.js';
import { toSarvamLang } from '../integrations/sarvam.js';

/**
 * The farmer's content language as a Sarvam code (`en-IN`, `ta-IN`, …). Cached
 * briefly so a request that localizes several things doesn't re-query. Services
 * call this so localization stays driven by the stored `preferred_language`,
 * never a hardcoded language or a request parameter.
 */
const cache = new Map<string, { at: number; lang: string }>();
const TTL_MS = 60_000;

export async function farmerLang(farmerId: string): Promise<string> {
  const hit = cache.get(farmerId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.lang;
  const row = await queryMaybe<{ preferred_language: string | null }>(
    `SELECT preferred_language FROM users WHERE id = $1`,
    [farmerId],
  );
  const lang = toSarvamLang(row?.preferred_language);
  cache.set(farmerId, { at: Date.now(), lang });
  return lang;
}
