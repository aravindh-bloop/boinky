import { Router } from 'express';
import { asyncHandler, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import { getUserById } from '../auth/auth.service.js';
import * as alerts from './alerts.service.js';
import { buildFarmerAlertFeed } from './alerts.feed.js';

export const alertsRouter = Router();

const idParam = z.object({ id: z.string().uuid() });

const createSchema = z
  .object({
    title: z.string().trim().min(3).max(140),
    message: z.string().trim().min(3).max(2000),
    region: z.string().trim().min(1).max(120).optional(),
    crop: z.string().trim().min(1).max(80).optional(),
    severity: z.enum(['low', 'medium', 'high']).optional(),
    centerLat: z.coerce.number().min(-90).max(90).optional(),
    centerLng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().max(500).optional(),
  })
  .refine((v) => (v.centerLat == null) === (v.centerLng == null), {
    message: 'centerLat and centerLng must be provided together',
  });

alertsRouter.post(
  '/',
  requireAuth('official'),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const alert = await alerts.createAlert(req.user!.sub, body);
    res.status(201).json({ alert });
  }),
);

alertsRouter.get(
  '/',
  requireAuth(),
  asyncHandler(async (req, res) => {
    if (req.user!.role === 'official') {
      const { scope, limit, offset } = z
        .object({
          scope: z.enum(['mine', 'region']).default('mine'),
          limit: z.coerce.number().int().min(1).max(100).default(50),
          offset: z.coerce.number().int().min(0).default(0),
        })
        .parse(req.query);
      const me = await getUserById(req.user!.sub);
      const list = await alerts.listOfficialAlerts({
        officialId: me.id,
        officialRegion: me.region,
        scope,
        limit,
        offset,
      });
      return res.json({ alerts: list });
    }

    const { since } = z
      .object({ since: z.string().datetime().optional() })
      .parse(req.query);
    const list = await buildFarmerAlertFeed(req.user!.sub, { live: true, since });
    res.json({ alerts: list });
  }),
);

alertsRouter.get(
  '/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const alert = await alerts.getAlert(id);
    res.json({ alert });
  }),
);

alertsRouter.delete(
  '/:id',
  requireAuth('official'),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    await alerts.deleteAlert(id, req.user!.sub);
    res.status(204).end();
  }),
);
