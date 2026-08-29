import { Router } from 'express';
import { asyncHandler, validate, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import { logger } from '../../lib/logger.js';
import { localizeMany, localizeCached } from '../../lib/localize.js';

export const i18nRouter = Router();

i18nRouter.use(requireAuth());

const body = z.object({
  lang: z.string().trim().min(2).max(10),
  texts: z.array(z.string().min(1).max(2000)).min(1).max(600),
  /** block until everything is translated (scripts / prewarm); default is fast + background */
  wait: z.boolean().optional(),
});

/**
 * Translate a batch of UI strings into `lang`.
 *
 * Default (fast) path: returns whatever is already cached immediately, echoes the
 * English for anything missing, and translates the misses in the background
 * (Sarvam is slow — a cold batch of 80 strings is over a minute). The client
 * re-requests on its next render and picks up the now-cached translations.
 * `pending` lists the strings still being worked on.
 *
 * `wait: true` blocks until the whole batch is done — for the prewarm script.
 */
i18nRouter.post(
  '/translate',
  validate({ body }),
  asyncHandler(async (req, res) => {
    const { lang, texts, wait } = req.body as z.infer<typeof body>;

    if (wait) {
      const out = await localizeMany(texts, lang);
      const map: Record<string, string> = {};
      texts.forEach((t, i) => (map[t] = out[i] ?? t));
      return res.json({ lang, map, pending: [] });
    }

    const { map, missing } = await localizeCached(texts, lang);
    for (const t of missing) map[t] = t; // English for now
    if (missing.length > 0) {
      void localizeMany(missing, lang).catch((err) =>
        logger.warn({ err, n: missing.length }, 'i18n background translate failed'),
      );
    }
    res.json({ lang, map, pending: missing });
  }),
);
