import { Router } from 'express';
import { asyncHandler, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import * as schemes from './schemes.service.js';

export const schemesRouter = Router();

schemesRouter.use(requireAuth());

schemesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, forMe } = z
      .object({
        q: z.string().trim().min(2).max(80).optional(),
        forMe: z.coerce.boolean().optional(),
      })
      .parse(req.query);

    const isFarmer = req.user!.role === 'farmer';
    const list = await schemes.listSchemes({
      search: q,
      farmerId: isFarmer ? req.user!.sub : undefined,
      onlyRelevant: isFarmer && forMe === true,
    });
    res.json({ schemes: list });
  }),
);

schemesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    res.json({ scheme: await schemes.getScheme(id) });
  }),
);
