import { env } from '../config/env.js';
import { AppError } from '../http/errors.js';
import { logger } from '../lib/logger.js';
import type { DiagnosisResult } from './gemini.js';

const BASE = 'https://api.sarvam.ai';

/** Sarvam language codes we support in the farmer app. */
export const SUPPORTED_LANGUAGES: Record<string, string> = {
  'en-IN': 'English',
  'hi-IN': 'Hindi',
  'mr-IN': 'Marathi',
  'bn-IN': 'Bengali',
  'ta-IN': 'Tamil',
  'te-IN': 'Telugu',
  'kn-IN': 'Kannada',
  'ml-IN': 'Malayalam',
  'gu-IN': 'Gujarati',
  'pa-IN': 'Punjabi',
  'od-IN': 'Odia',
};

/** Normalise a short code ("mr", "mr-IN", "MR-in", "marathi") to a Sarvam code ("mr-IN"). */
export function toSarvamLang(input: string | null | undefined): string {
  if (!input) return 'en-IN';
  const v = input.trim().toLowerCase();
  const codes = Object.keys(SUPPORTED_LANGUAGES);
  // exact code, case-insensitive ("mr-in" -> "mr-IN")
  const exact = codes.find((k) => k.toLowerCase() === v);
  if (exact) return exact;
  // bare language subtag ("mr" -> "mr-IN")
  const byPrefix = codes.find((k) => k.toLowerCase().startsWith(`${v}-`) || k.toLowerCase() === `${v}-in`);
  if (byPrefix) return byPrefix;
  // language name ("marathi" -> "mr-IN")
  const byName = Object.entries(SUPPORTED_LANGUAGES).find(([, name]) => name.toLowerCase() === v);
  return byName?.[0] ?? 'en-IN';
}

function key(): string {
  if (!env.SARVAM_API_KEY) {
    throw AppError.upstream('Sarvam is not configured (SARVAM_API_KEY missing)');
  }
  return env.SARVAM_API_KEY;
}

async function call<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'api-subscription-key': key(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw AppError.upstream('Sarvam request failed', { reason: (err as Error).message });
  }
  const text = await res.text();
  if (!res.ok) {
    logger.error({ status: res.status, body: text.slice(0, 400), path }, 'sarvam error');
    throw AppError.upstream(`Sarvam ${path} failed (${res.status})`);
  }
  return JSON.parse(text) as T;
}

/** Detect the language of a piece of text. Returns a Sarvam code or null. */
export async function detectLanguage(input: string): Promise<string | null> {
  const r = await call<{ language_code: string | null }>('/text-lid', { input });
  return r.language_code ?? null;
}

/**
 * Translate text into an Indian language for a farmer audience. Uses the chat model
 * rather than the MT endpoint — the MT `/translate` output stays heavily code-mixed
 * with English ("potato crop-ला late blight"), while the chat model produces natural
 * spoken language and still keeps chemical names in Latin script.
 */
export async function translate(input: string, targetLang: string): Promise<string> {
  if (targetLang === 'en-IN') return input;
  const langName = SUPPORTED_LANGUAGES[targetLang] ?? 'the local language';
  const r = await call<{ choices: { message: { content: string | null } }[] }>(
    '/v1/chat/completions',
    {
      model: 'sarvam-105b-conversations',
      messages: [
        {
          role: 'system',
          content: `Translate the user's message into natural, spoken ${langName} that a
farmer with limited literacy can follow when read aloud. Keep chemical names, product
names and numbers in English/Latin script. Do not add notes or headings. Output only the
translation.`,
        },
        { role: 'user', content: input },
      ],
      temperature: 0.2,
      max_tokens: 900,
    },
  );
  return r.choices?.[0]?.message?.content?.trim() || input;
}

/**
 * Generate a farmer-friendly advisory in the target language from Gemini's findings.
 * Uses the chat model (rephrasing, not literal translation).
 */
export async function generateAdvisory(
  diagnosis: DiagnosisResult,
  targetLang: string,
  ctx: { crop?: string | null; daysToHarvest?: number | null },
): Promise<string> {
  // Two-step for reliability: draft a clean farmer-friendly advisory in English with
  // the chat model (good at phrasing), then translate with Sarvam's dedicated
  // translator (the chat model does not reliably honour "reply only in <language>").
  const englishAdvisory = await draftEnglishAdvisory(diagnosis, ctx);
  if (targetLang === 'en-IN') return englishAdvisory;

  try {
    const translated = await translate(englishAdvisory, targetLang);
    return translated.trim() || englishAdvisory;
  } catch (err) {
    logger.warn({ err, targetLang }, 'advisory translation failed — returning English');
    return englishAdvisory;
  }
}

async function draftEnglishAdvisory(
  diagnosis: DiagnosisResult,
  ctx: { crop?: string | null; daysToHarvest?: number | null },
): Promise<string> {
  const findings = {
    diagnosis: diagnosis.label,
    category: diagnosis.category,
    affectedPart: diagnosis.affectedPart,
    severity: diagnosis.severity,
    confidence: Math.round(diagnosis.confidence * 100),
    summary: diagnosis.summary,
    recommendedActions: diagnosis.recommendedActions,
    recommendedInputs: diagnosis.recommendedInputs,
    preventiveTips: diagnosis.preventiveTips,
    crop: ctx.crop ?? undefined,
  };

  const system = `You are an agriculture extension advisor helping a smallholder farmer in India.
Write the advisory in simple, respectful, spoken-style English that a farmer with limited
literacy can follow when read aloud (it will be translated into their language afterwards).
Do NOT use markdown or headings. Keep chemical names in English.
Structure the message as short plain sentences in this order:
1) What the problem is and how serious it looks.
2) What to do first (cultural / non-chemical steps).
3) If a pesticide/fungicide is needed, name it and say to follow the label dose and the
   pre-harvest waiting period, and to wear gloves and a mask.
4) One or two lines on preventing it next time.
Keep it under 130 words.`;

  const r = await call<{
    choices: { message: { content: string | null }; finish_reason: string }[];
  }>('/v1/chat/completions', {
    // 'sarvam-105b-conversations' is the non-reasoning chat variant. The base
    // 'sarvam-105b' spends its whole completion budget on hidden reasoning and
    // returns empty content (finish_reason "length") for prompts this size.
    model: 'sarvam-105b-conversations',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(findings) },
    ],
    temperature: 0.3,
    max_tokens: 800,
  });
  const choice = r.choices?.[0];
  const content = choice?.message?.content?.trim();
  if (!content) {
    logger.error({ finish: choice?.finish_reason }, 'sarvam returned empty advisory content');
    throw AppError.upstream('Advisory generation returned an empty response');
  }
  return content;
}
