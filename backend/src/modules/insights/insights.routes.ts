import { Router } from 'express';
import { asyncHandler, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import { getDailyBrief } from './insights.service.js';

export const insightsRouter = Router();

insightsRouter.use(requireAuth('farmer'));

/**
 * Today's AI brief. Returns immediately: `ready` with cards, `generating` while the
 * model runs (the client polls), or `unavailable` when there is nothing real to
 * reason about. `?fresh=true` forces a regeneration.
 */
insightsRouter.get(
  '/daily',
  asyncHandler(async (req, res) => {
    const { fresh } = z.object({ fresh: z.coerce.boolean().optional() }).parse(req.query);
    const brief = await getDailyBrief(req.user!.sub, { fresh });
    res.json(brief);
  }),
);
