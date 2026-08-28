import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { diagnoseCropImage } from '../src/integrations/gemini.js';
import { generateAdvisory, toSarvamLang } from '../src/integrations/sarvam.js';
import { downscaleForVision } from '../src/lib/image.js';

const path = process.argv[2];
const lang = process.argv[3] ?? 'mr';
if (!path) {
  console.error('usage: tsx scripts/try-diagnosis.ts <image> [lang]');
  process.exit(1);
}

const buf = readFileSync(path);
const vision = await downscaleForVision(buf);
console.log(`vision image: ${vision.width}x${vision.height}, ${(vision.buffer.length / 1024) | 0}KB`);
console.time('gemini');
const d = await diagnoseCropImage(vision.buffer.toString('base64'), vision.mimeType, {
  crop: 'Potato',
  variety: 'Kufri Jyoti',
  daysSinceSown: 60,
  region: 'Pune, Maharashtra',
});
console.timeEnd('gemini');
console.log(JSON.stringify(d, null, 2));

console.time('sarvam');
const adv = await generateAdvisory(d, toSarvamLang(lang), { crop: 'Potato' });
console.timeEnd('sarvam');
console.log(`\n--- ADVISORY (${toSarvamLang(lang)}) ---\n${adv}`);
