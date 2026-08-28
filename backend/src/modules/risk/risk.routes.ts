import { Router } from 'express';
import { asyncHandler, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import * as risk from './risk.service.js';

export const riskRouter = Router();

riskRouter.use(requireAuth('farmer'));

const fieldIdParam = z.object({ fieldId: z.string().uuid() });

riskRouter.get(
  '/:fieldId',
  asyncHandler(async (req, res) => {
    const { fieldId } = fieldIdParam.parse(req.params);
    const { refresh } = z.object({ refresh: z.coerce.boolean().optional() }).parse(req.query);
    const result = await risk.getFieldRisk(fieldId, req.user!.sub, { refresh });
    res.json(result);
  }),
);

riskRouter.get(
  '/:fieldId/history',
  asyncHandler(async (req, res) => {
    const { fieldId } = fieldIdParam.parse(req.params);
    const { days } = z
      .object({ days: z.coerce.number().int().min(1).max(120).default(30) })
      .parse(req.query);
    const history = await risk.riskHistory(fieldId, req.user!.sub, days);
    res.json({ history });
  }),
);
