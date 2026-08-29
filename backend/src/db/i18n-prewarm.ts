/**
 * Pre-translate the app's core UI strings into Tamil so the first language
 * switch on a device is mostly instant instead of waiting on Sarvam.
 *
 * Reads the string list straight from the app's catalog file and fills
 * `translation_cache`. Idempotent — cached strings are skipped. Slow the first
 * time (Sarvam), a no-op afterwards.
 *
 *   npm run i18n:prewarm
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pool } from './pool.js';
import { logger } from '../lib/logger.js';
import { localizeMany } from '../lib/localize.js';

const here = dirname(fileURLToPath(import.meta.url));
const CATALOG_FILE = resolve(here, '../../../farmer-expo/src/i18n/catalog.ts');
const LANGS = ['ta-IN'];

function readCatalog(): string[] {
  const src = readFileSync(CATALOG_FILE, 'utf8');
  const body = src.slice(src.indexOf('['), src.lastIndexOf(']') + 1);
  // pull every single- or double-quoted literal, unescape \' and \n
  const out: string[] = [];
  const re = /(['"])((?:\\.|(?!\1).)*)\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const s = m[2]!.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n');
    if (s.trim()) out.push(s);
  }
  return [...new Set(out)];
}

async function main() {
  const strings = readCatalog();
  logger.info({ n: strings.length, file: CATALOG_FILE }, 'prewarming UI strings');
  for (const lang of LANGS) {
    const started = Date.now();
    // localizeMany persists each 12-string sub-batch as it goes
    await localizeMany(strings, lang);
    logger.info({ lang, ms: Date.now() - started }, 'prewarm done');
  }
  await pool.end();
}

main().catch((e) => {
  logger.fatal({ err: e }, 'prewarm failed');
  process.exit(1);
});
