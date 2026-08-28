import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Verifies Sarvam's speech endpoints against the live API before we build on them.
 *
 * TTS generates a real Tamil sentence, then STT transcribes that audio back — a
 * round trip proves both directions work and tells us the transcript quality we
 * can expect from a farmer speaking Tamil.
 */

const BASE = 'https://api.sarvam.ai';
const KEY = process.env.SARVAM_API_KEY;
if (!KEY) throw new Error('SARVAM_API_KEY missing');

// A realistic farmer complaint, not a greeting: "For the last four days there are
// yellow spots on the leaves of my tomato plants, and the lower leaves are wilting."
const TAMIL =
  'கடந்த நான்கு நாட்களாக என் தக்காளி செடியின் இலைகளில் மஞ்சள் புள்ளிகள் இருக்கின்றன, கீழே உள்ள இலைகள் வாடிப் போகின்றன.';

async function tts(text: string, speaker: string, model: string): Promise<Buffer> {
  const res = await fetch(`${BASE}/text-to-speech`, {
    method: 'POST',
    headers: { 'api-subscription-key': KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      target_language_code: 'ta-IN',
      language_code: 'ta-IN',
      speaker,
      model,
      speech_sample_rate: 16000,
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`TTS ${res.status}: ${body.slice(0, 300)}`);
  const json = JSON.parse(body) as { audios: string[] };
  return Buffer.from(json.audios[0]!, 'base64');
}

async function stt(audio: Buffer, filename: string, opts: { model?: string; lang?: string } = {}) {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), filename);
  if (opts.model) form.append('model', opts.model);
  form.append('language_code', opts.lang ?? 'ta-IN');

  const started = Date.now();
  const res = await fetch(`${BASE}/speech-to-text`, {
    method: 'POST',
    headers: { 'api-subscription-key': KEY! },
    body: form,
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`STT ${res.status}: ${body.slice(0, 400)}`);
  return { ...(JSON.parse(body) as Record<string, unknown>), ms: Date.now() - started };
}

async function main() {
  console.log('=== 1. TTS: generate real Tamil audio ===');
  let audio: Buffer | null = null;
  for (const [model, speaker] of [
    ['bulbul:v2', 'anushka'],
    ['bulbul:v3', 'ritu'],
  ] as const) {
    try {
      audio = await tts(TAMIL, speaker, model);
      console.log(`  ✔ ${model}/${speaker} → ${audio.length} bytes`);
      break;
    } catch (e) {
      console.log(`  ✘ ${model}/${speaker}: ${(e as Error).message}`);
    }
  }
  if (!audio) throw new Error('TTS failed for every model');

  const wavPath = join(process.cwd(), 'scripts', 'fixtures', 'tamil-complaint.wav');
  writeFileSync(wavPath, audio);
  console.log(`  saved ${wavPath}`);

  console.log('\n=== 2. STT: transcribe it back ===');
  for (const model of ['saaras:v3', 'saaras:v4', undefined]) {
    try {
      const r = await stt(audio, 'tamil-complaint.wav', { model });
      console.log(`  ✔ model=${model ?? '(default)'}  ${r.ms}ms`);
      console.log(`     transcript      : ${r.transcript}`);
      console.log(`     language_code   : ${r.language_code}`);
    } catch (e) {
      console.log(`  ✘ model=${model ?? '(default)'}: ${(e as Error).message}`);
    }
  }

  console.log('\n=== 3. STT with language auto-detection ===');
  try {
    const r = await stt(audio, 'tamil-complaint.wav', { lang: 'unknown' });
    console.log(`  ✔ ${r.ms}ms  detected=${r.language_code}`);
    console.log(`     transcript: ${r.transcript}`);
  } catch (e) {
    console.log(`  ✘ ${(e as Error).message}`);
  }

  console.log(`\nOriginal Tamil:\n  ${TAMIL}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
