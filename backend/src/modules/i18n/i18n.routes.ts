import { Router } from 'express';
import { asyncHandler, validate, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import { localizeMany } from '../../lib/localize.js';

export const i18nRouter = Router();

i18nRouter.use(requireAuth());

const body = z.object({
  lang: z.string().trim().min(2).max(10),
  texts: z.array(z.string().min(1).max(2000)).min(1).max(600),
});

/**
 * Translate a batch of UI strings. English is a no-op; other languages are
 * translated once via Sarvam and cached (translation_cache), so repeat calls are
 * a fast DB read. Returns a { [sourceText]: translated } map.
 */
i18nRouter.post(
  '/translate',
  validate({ body }),
  asyncHandler(async (req, res) => {
    const { lang, texts } = req.body as z.infer<typeof body>;
    const translated = await localizeMany(texts, lang);
    const map: Record<string, string> = {};
    texts.forEach((t, i) => {
      map[t] = translated[i] ?? t;
    });
    res.json({ lang, map });
  }),
);
