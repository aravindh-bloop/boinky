import 'dotenv/config';
import { z } from 'zod';

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? def : v === 'true' || v === '1'));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  CORS_ORIGINS: z.string().default('*'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('30d'),

  DATABASE_URL: z.string().url(),

  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),

  SARVAM_API_KEY: z.string().min(1).optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  OPEN_METEO_BASE_URL: z.string().url().default('https://api.open-meteo.com/v1'),

  CONFIDENCE_ESCALATION_THRESHOLD: z.coerce.number().min(0).max(1).default(0.65),

  DB_SSL: bool(true),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    '\n❌ Invalid environment configuration:\n' +
      parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n') +
      '\n',
  );
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

/** Convenience flags for optional integrations. */
export const integrations = {
  gemini: Boolean(env.GEMINI_API_KEY),
  sarvam: Boolean(env.SARVAM_API_KEY),
  cloudinary: Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
  ),
};

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
