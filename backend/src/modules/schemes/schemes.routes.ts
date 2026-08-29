import { Router } from 'express';
import { asyncHandler, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import * as schemes from './schemes.service.js';
import * as apps from './applications.service.js';

export const schemesRouter = Router();

schemesRouter.use(requireAuth());

// ── farmer: applications + query threads (mounted before /:id) ────────────

schemesRouter.get(
  '/applications',
  requireAuth('farmer'),
  asyncHandler(async (req, res) => {
    res.json({ applications: await apps.listMyApplications(req.user!.sub) });
  }),
);

schemesRouter.delete(
  '/applications/:id',
  requireAuth('farmer'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await apps.withdrawApplication(req.user!.sub, id);
    res.status(204).end();
  }),
);

schemesRouter.get(
  '/threads',
  asyncHandler(async (req, res) => {
    if (req.user!.role !== 'farmer') return res.json({ threads: [] });
    res.json({ threads: await apps.listMyThreads(req.user!.sub) });
  }),
);

schemesRouter.post(
  '/threads',
  requireAuth('farmer'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        schemeId: z.string().uuid().optional(),
        applicationId: z.string().uuid().optional(),
        subject: z.string().trim().min(3).max(160),
        body: z.string().trim().min(1).max(2000),
      })
      .parse(req.body);
    const id = await apps.createThread(req.user!.sub, body);
    res.status(201).json({ id });
  }),
);

schemesRouter.get(
  '/threads/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    res.json(await apps.getThread(id, { id: req.user!.sub, role: req.user!.role }));
  }),
);

schemesRouter.post(
  '/threads/:id/messages',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body);
    await apps.postMessage(id, { id: req.user!.sub, role: req.user!.role }, body);
    res.status(201).json({ ok: true });
  }),
);

schemesRouter.post(
  '/:id/apply',
  requireAuth('farmer'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { note } = z.object({ note: z.string().trim().max(1000).optional() }).parse(req.body ?? {});
    const application = await apps.applyForScheme(req.user!.sub, id, note ?? null);
    res.status(201).json({ application });
  }),
);

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
