import { Router } from 'express';
import { asyncHandler, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import * as pesticides from './pesticides.service.js';

export const pesticidesRouter = Router();

pesticidesRouter.use(requireAuth());

pesticidesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, crop } = z
      .object({ q: z.string().trim().min(2).max(80), crop: z.string().trim().min(1).max(80).optional() })
      .parse(req.query);
    const results = await pesticides.searchReference(q, crop);
    res.json({ results });
  }),
);

pesticidesRouter.get(
  '/lookup',
  asyncHandler(async (req, res) => {
    const { name, crop } = z
      .object({ name: z.string().trim().min(2).max(200), crop: z.string().trim().min(1).max(80).optional() })
      .parse(req.query);
    const ref = await pesticides.lookupPHI(name, crop ?? null);
    res.json({ reference: ref });
  }),
);
