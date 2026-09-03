import { createHash } from 'node:crypto';
import { query, queryMaybe } from '../../db/query.js';
import { logger } from '../../lib/logger.js';
import { integrations } from '../../config/env.js';
import { synthesizeSpeech } from '../../integrations/sarvam.js';
import { toSarvamLang } from '../../integrations/sarvam.js';

const SPEAKER = 'priya';

/**
 * Speak `text` in `lang`. Cached in `tts_cache` by a hash of the exact text +
 * speaker, so replaying a tutorial step or an assistant reply is free after the
 * first time.
 */
export async function getSpeech(
  text: string,
  lang: string,
): Promise<{ audio: string[]; cached: boolean }> {
  const clean = text.trim();
  if (!clean) return { audio: [], cached: false };
  if (!integrations.sarvam) return { audio: [], cached: false };

  const target = toSarvamLang(lang);
  const hash = createHash('sha1').update(`${SPEAKER}::${clean}`).digest('hex');

  const hit = await queryMaybe<{ audio: string[] }>(
    `SELECT audio FROM tts_cache WHERE hash = $1 AND lang = $2`,
    [hash, target],
  );
  if (hit) return { audio: hit.audio, cached: true };

  const started = Date.now();
  const audio = await synthesizeSpeech(clean, target, SPEAKER);
  logger.info({ ms: Date.now() - started, chars: clean.length, chunks: audio.length, lang: target }, 'tts synthesised');

  if (audio.length > 0) {
    await query(
      `INSERT INTO tts_cache (hash, lang, audio, chars) VALUES ($1, $2, $3, $4)
       ON CONFLICT (hash, lang) DO NOTHING`,
      [hash, target, JSON.stringify(audio), clean.length],
    ).catch((err) => logger.warn({ err }, 'tts_cache write failed'));
  }
  return { audio, cached: false };
}
