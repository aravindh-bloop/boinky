/**
 * Latency curve for a multi-image ("resource verification") scan diagnosis.
 *
 * We can't judge accuracy without real multi-angle photos of one plant, but we
 * CAN measure how latency scales with the number of images — which is what
 * decides whether the guided capture wizard submits all shots in one call or
 * streams them. Uses the single blight fixture, cropped/rotated into N synthetic
 * "angles".
 *
 *   npx tsx scripts/bench-gemini-set.ts
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const src = readFileSync('scripts/fixtures/potato-late-blight.jpg');
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite';

const schema = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING },
    category: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    imageQuality: { type: Type.STRING },
    coverageGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
    summary: { type: Type.STRING },
  },
  required: ['label', 'confidence', 'imageQuality', 'coverageGaps', 'summary'],
};

/** N synthetic "angles" from one photo: rotate + crop + zoom. */
async function angles(n: number): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const rot = [0, 90, 180, 270, 15, 45][i % 6]!;
    const buf = await sharp(src)
      .rotate(rot)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .extract(
        i % 2
          ? { left: 0, top: 0, width: 512, height: 512 }
          : { left: 0, top: 0, width: 700, height: 700 },
      )
      .resize(1024, 1024, { fit: 'inside' })
      .jpeg({ quality: 82 })
      .toBuffer()
      .catch(() =>
        sharp(src).resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 82 }).toBuffer(),
      );
    out.push(buf.toString('base64'));
  }
  return out;
}

const ANGLE_NAMES = [
  'whole plant',
  'affected leaf close-up',
  'leaf underside',
  'stem / base',
  'fruit / panicle',
  'wider field view',
];

async function run(n: number) {
  const imgs = await angles(n);
  const parts: unknown[] = imgs.map((data, i) => [
    { text: `Photo ${i + 1} — declared angle: ${ANGLE_NAMES[i] ?? 'extra'}` },
    { inlineData: { mimeType: 'image/jpeg', data } },
  ]).flat();
  parts.push({
    text: `You are given ${n} photo(s) of the SAME plant from different angles. Cross-reference them.
Identify the disease/pest. If a declared angle is unusable or a key view is missing, lower
confidence and list it in coverageGaps. Set imageQuality to good|partial|poor.`,
  });

  const runs: number[] = [];
  let last = '';
  for (let i = 0; i < 3; i++) {
    const t = Date.now();
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: parts as never }],
      config: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 },
    });
    runs.push(Date.now() - t);
    last = res.text ?? '';
  }
  const kb = (imgs.reduce((s, b) => s + b.length, 0) / 1024) | 0;
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(last);
  } catch {
    /* */
  }
  console.log(
    `${String(n).padStart(2)} imgs  ~${String(kb).padStart(4)}KB  ` +
      `runs=[${runs.map((r) => (r / 1000).toFixed(1)).join(', ')}]s  ` +
      `q=${parsed.imageQuality} conf=${parsed.confidence} "${parsed.label}"  gaps=${JSON.stringify(parsed.coverageGaps)}`,
  );
}

for (const n of [1, 2, 3, 4, 6]) {
  try {
    await run(n);
  } catch (e) {
    console.log(`${n} imgs FAIL ${(e as Error).message.slice(0, 160)}`);
  }
}
