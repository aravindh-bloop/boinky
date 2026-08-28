import { Router } from 'express';
import { asyncHandler } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import { getHome } from './home.service.js';

export const homeRouter = Router();

// short-lived per-farmer cache — the dashboard is read-heavy and mildly expensive
const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 30_000;

homeRouter.get(
  '/',
  requireAuth('farmer'),
  asyncHandler(async (req, res) => {
    const id = req.user!.sub;
    const fresh = req.query.fresh === 'true';
    const hit = cache.get(id);
    if (!fresh && hit && Date.now() - hit.at < TTL_MS) {
      res.json(hit.data);
      return;
    }
    const data = await getHome(id);
    cache.set(id, { at: Date.now(), data });
    res.json(data);
  }),
);
