import { Router } from 'express';
import { asyncHandler, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import { getUserById } from '../auth/auth.service.js';
import { toSarvamLang } from '../../integrations/sarvam.js';
import { localizeMany } from '../../lib/localize.js';
import { tutorialSteps, type TutorialTopic } from './content.js';

export const tutorialRouter = Router();

tutorialRouter.use(requireAuth());

const q = z.object({
  topic: z.enum(['app', 'pod']).default('app'),
  lang: z.string().trim().min(2).max(10).optional(),
});

tutorialRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { topic, lang } = q.parse(req.query);
    const target = lang
      ? toSarvamLang(lang)
      : toSarvamLang((await getUserById(req.user!.sub).catch(() => null))?.preferred_language);

    const steps = tutorialSteps(topic as TutorialTopic);

    if (target === 'en-IN') {
      res.json({ topic, lang: target, steps });
      return;
    }

    // Localise every title + body in one cached batch.
    const source = steps.flatMap((s) => [s.title, s.body]);
    const tr = await localizeMany(source, target);
    const localised = steps.map((s, i) => ({
      ...s,
      title: tr[i * 2] || s.title,
      body: tr[i * 2 + 1] || s.body,
    }));
    res.json({ topic, lang: target, steps: localised });
  }),
);
