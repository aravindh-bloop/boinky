import { Router } from 'express';
import { asyncHandler, validate, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import { getSpeech } from './tts.service.js';

export const ttsRouter = Router();

ttsRouter.use(requireAuth());

const body = z.object({
  text: z.string().trim().min(1).max(1500),
  lang: z.string().trim().min(2).max(10).optional(),
});

ttsRouter.post(
  '/',
  validate({ body }),
  asyncHandler(async (req, res) => {
    const { text, lang } = req.body as z.infer<typeof body>;
    const { audio, cached } = await getSpeech(text, lang ?? 'en-IN');
    res.json({ audio, cached });
  }),
);
