import { Router } from 'express';
import { asyncHandler, validate, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import * as assistant from './assistant.service.js';

export const assistantRouter = Router();

assistantRouter.use(requireAuth('farmer'));

assistantRouter.get(
  '/threads',
  asyncHandler(async (req, res) => {
    res.json({ threads: await assistant.listThreads(req.user!.sub) });
  }),
);

assistantRouter.get(
  '/threads/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    res.json(await assistant.getThread(id, req.user!.sub));
  }),
);

assistantRouter.post(
  '/messages',
  validate({
    body: z.object({
      threadId: z.string().uuid().optional(),
      text: z.string().trim().min(1).max(1000),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { threadId, text } = req.body as { threadId?: string; text: string };
    const out = await assistant.ask(req.user!.sub, text, threadId);
    res.status(201).json(out);
  }),
);

assistantRouter.post(
  '/messages/:id/rating',
  validate({ body: z.object({ helpful: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await assistant.rateMessage(id, req.user!.sub, (req.body as { helpful: boolean }).helpful);
    res.status(204).end();
  }),
);
