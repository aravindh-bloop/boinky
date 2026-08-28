import { GoogleGenAI, Type } from '@google/genai';
import { env } from '../config/env.js';
import { AppError } from '../http/errors.js';
import { logger } from '../lib/logger.js';

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!env.GEMINI_API_KEY) {
    throw AppError.upstream('Gemini is not configured (GEMINI_API_KEY missing)');
  }
  client ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return client;
}

export type DiagnosisCategory = 'disease' | 'pest' | 'deficiency' | 'healthy' | 'unknown';
export type Severity = 'low' | 'medium' | 'high';

export interface CropContext {
  crop?: string | null;
  variety?: string | null;
  daysSinceSown?: number | null;
  region?: string | null;
}

export interface DiagnosisResult {
  label: string;
  category: DiagnosisCategory;
  affectedPart: string | null;
  severity: Severity | null;
  confidence: number; // 0..1
  isPlant: boolean;
  summary: string; // concise English explanation of what was observed
  recommendedActions: string[]; // IPM-oriented steps, English
  recommendedInputs: string[]; // e.g. "Copper oxychloride 50% WP"
  preventiveTips: string[];
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING, description: 'Common name of the disease/pest, or "Healthy"' },
    category: { type: Type.STRING, enum: ['disease', 'pest', 'deficiency', 'healthy', 'unknown'] },
    affectedPart: { type: Type.STRING, description: 'leaf/stem/fruit/root/whole plant, or empty' },
    severity: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
    confidence: { type: Type.NUMBER, description: '0 to 1 confidence in the diagnosis' },
    isPlant: { type: Type.BOOLEAN, description: 'false if the image is not a crop/plant' },
    summary: { type: Type.STRING },
    recommendedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
    recommendedInputs: { type: Type.ARRAY, items: { type: Type.STRING } },
    preventiveTips: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'label',
    'category',
    'confidence',
    'isPlant',
    'summary',
    'recommendedActions',
    'recommendedInputs',
    'preventiveTips',
  ],
} as const;

function buildPrompt(ctx: CropContext): string {
  const facts: string[] = [];
  if (ctx.crop) facts.push(`Crop: ${ctx.crop}`);
  if (ctx.variety) facts.push(`Variety: ${ctx.variety}`);
  if (ctx.daysSinceSown != null) facts.push(`Days since sowing: ${ctx.daysSinceSown}`);
  if (ctx.region) facts.push(`Region: ${ctx.region}`);
  const context = facts.length ? `\n\nField context:\n${facts.join('\n')}` : '';

  return `You are an agronomist specialising in Indian smallholder farming and integrated
pest and disease management (IPM). Examine this photograph of a crop plant and identify
the most likely disease, pest infestation, or nutrient deficiency.${context}

Rules:
- If the image is not a plant/crop, set isPlant=false, category="unknown", confidence=0.
- The field context above is what the farmer *claims* to have planted. Diagnose what you
  actually see. If the plant in the photo is clearly a different crop than stated, still
  give the correct diagnosis for the plant shown and note the mismatch in "summary".
- Prefer a specific named diagnosis; use category="unknown" only when genuinely unclear.
- "confidence" must honestly reflect image quality and diagnostic certainty.
- recommendedActions: 3-6 practical IPM steps, least-toxic first, in plain English.
- recommendedInputs: specific pesticide/fungicide/nutrient names ONLY if warranted,
  with formulation strength where relevant; empty array if cultural control suffices.
- preventiveTips: 2-4 short points to avoid recurrence.
- Keep every string concise and free of markdown.`;
}

export async function diagnoseCropImage(
  imageBase64: string,
  mimeType: string,
  ctx: CropContext,
): Promise<DiagnosisResult> {
  const started = Date.now();
  let raw: string;
  try {
    const res = await ai().models.generateContent({
      model: env.GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: buildPrompt(ctx) },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema as unknown as Record<string, unknown>,
        temperature: 0.2,
      },
    });
    raw = res.text ?? '';
  } catch (err) {
    logger.error({ err }, 'gemini generateContent failed');
    throw AppError.upstream('Image diagnosis service failed', {
      reason: (err as Error).message,
    });
  }

  let parsed: DiagnosisResult;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    parsed = normalise(obj);
  } catch (err) {
    logger.error({ err, raw: raw.slice(0, 500) }, 'gemini returned unparseable JSON');
    throw AppError.upstream('Image diagnosis returned an invalid response');
  }

  logger.debug(
    { ms: Date.now() - started, label: parsed.label, confidence: parsed.confidence },
    'gemini diagnosis complete',
  );
  return parsed;
}

// ── Management guidance for a known diagnosis (used after an expert correction) ──

export interface ManagementGuidance {
  summary: string;
  recommendedActions: string[];
  recommendedInputs: string[];
  preventiveTips: string[];
}

const guidanceSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    recommendedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
    recommendedInputs: { type: Type.ARRAY, items: { type: Type.STRING } },
    preventiveTips: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['summary', 'recommendedActions', 'recommendedInputs', 'preventiveTips'],
} as const;

export async function getManagementGuidance(
  label: string,
  category: string,
  crop: string | null,
): Promise<ManagementGuidance> {
  const prompt = `An agriculture extension officer has confirmed the diagnosis as "${label}"
(${category})${crop ? ` on ${crop}` : ''} for a smallholder farm in India. Give integrated
pest/disease management guidance: a one-line summary, 3-6 practical action steps (least-toxic
first), specific recommended chemical inputs with formulation strength ONLY if warranted
(else empty), and 2-4 prevention tips. Concise, no markdown.`;
  let raw: string;
  try {
    const res = await ai().models.generateContent({
      model: env.GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: guidanceSchema as unknown as Record<string, unknown>,
        temperature: 0.2,
      },
    });
    raw = res.text ?? '';
  } catch (err) {
    throw AppError.upstream('Guidance service failed', { reason: (err as Error).message });
  }
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const arr = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
    return {
      summary: String(o.summary ?? '').trim(),
      recommendedActions: arr(o.recommendedActions),
      recommendedInputs: arr(o.recommendedInputs),
      preventiveTips: arr(o.preventiveTips),
    };
  } catch {
    throw AppError.upstream('Guidance service returned an invalid response');
  }
}

// ── Pesticide PHI estimate (fallback when not in the reference table) ──

export interface PhiEstimate {
  activeIngredient: string | null;
  preHarvestIntervalDays: number | null;
  safeDosage: string | null;
  precautions: string | null;
  targetPestOrDisease: string | null;
}

const phiSchema = {
  type: Type.OBJECT,
  properties: {
    activeIngredient: { type: Type.STRING },
    preHarvestIntervalDays: {
      type: Type.NUMBER,
      description: 'Days between last spray and safe harvest per Indian CIB&RC label norms',
    },
    safeDosage: { type: Type.STRING, description: 'e.g. "2 g/litre of water"' },
    precautions: { type: Type.STRING },
    targetPestOrDisease: { type: Type.STRING },
  },
  required: ['preHarvestIntervalDays'],
} as const;

export async function estimatePHI(pesticide: string, crop: string | null): Promise<PhiEstimate> {
  const prompt = `For the agrochemical "${pesticide}"${crop ? ` used on ${crop}` : ''} in India,
give the pre-harvest interval (PHI / waiting period) in days as commonly stated on
CIB&RC-approved product labels. If the exact value varies, give a safe (longer) typical
value. Also give the active ingredient, a typical safe dose per litre of water, the main
target pest/disease, and one line of safety precautions. If "${pesticide}" is a bio-pesticide
(neem, Bt, Beauveria etc.) the PHI is usually 0-1 days.`;

  let raw: string;
  try {
    const res = await ai().models.generateContent({
      model: env.GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: phiSchema as unknown as Record<string, unknown>,
        temperature: 0.1,
      },
    });
    raw = res.text ?? '';
  } catch (err) {
    throw AppError.upstream('PHI estimation service failed', { reason: (err as Error).message });
  }

  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const phi = Number(o.preHarvestIntervalDays);
    return {
      activeIngredient: o.activeIngredient ? String(o.activeIngredient) : null,
      preHarvestIntervalDays: Number.isFinite(phi) ? Math.max(0, Math.round(phi)) : null,
      safeDosage: o.safeDosage ? String(o.safeDosage) : null,
      precautions: o.precautions ? String(o.precautions) : null,
      targetPestOrDisease: o.targetPestOrDisease ? String(o.targetPestOrDisease) : null,
    };
  } catch {
    throw AppError.upstream('PHI estimation returned an invalid response');
  }
}

function normalise(o: Record<string, unknown>): DiagnosisResult {
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  const num = (v: unknown): number => {
    const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
  };
  const category = (
    ['disease', 'pest', 'deficiency', 'healthy', 'unknown'] as const
  ).includes(o.category as DiagnosisCategory)
    ? (o.category as DiagnosisCategory)
    : 'unknown';
  const severity = (['low', 'medium', 'high'] as const).includes(o.severity as Severity)
    ? (o.severity as Severity)
    : null;

  return {
    label: String(o.label ?? 'Unknown').trim() || 'Unknown',
    category,
    affectedPart: o.affectedPart ? String(o.affectedPart).trim() || null : null,
    severity: category === 'healthy' ? null : severity,
    confidence: num(o.confidence),
    isPlant: o.isPlant !== false,
    summary: String(o.summary ?? '').trim(),
    recommendedActions: arr(o.recommendedActions),
    recommendedInputs: arr(o.recommendedInputs),
    preventiveTips: arr(o.preventiveTips),
  };
}
