import 'dotenv/config';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const src = readFileSync(process.argv[2] ?? 'scripts/fixtures/potato-late-blight.jpg');

const schema = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
  },
  required: ['label', 'confidence'],
};

async function variant(model: string, maxDim: number | null) {
  let buf = src;
  if (maxDim) {
    buf = await sharp(src)
      .rotate()
      .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  }
  const runs: number[] = [];
  let label = '';
  for (let i = 0; i < 3; i++) {
    const t = Date.now();
    const res = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: buf.toString('base64') } },
            { text: 'Identify the crop disease/pest. Return label + confidence 0-1.' },
          ],
        },
      ],
      config: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 },
    });
    runs.push(Date.now() - t);
    try {
      label = JSON.parse(res.text ?? '{}').label;
    } catch {
      /* */
    }
  }
  const kb = (buf.length / 1024) | 0;
  console.log(
    `${model.padEnd(26)} dim=${String(maxDim ?? 'orig').padEnd(5)} ${String(kb).padStart(4)}KB  ` +
      `runs=[${runs.map((r) => (r / 1000).toFixed(1)).join(', ')}]s  "${label}"`,
  );
}

for (const model of ['gemini-3.6-flash', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite']) {
  for (const dim of [768, 1024, null]) {
    try {
      await variant(model, dim);
    } catch (e) {
      console.log(`${model} dim=${dim} FAIL ${(e as Error).message.slice(0, 120)}`);
    }
  }
}
