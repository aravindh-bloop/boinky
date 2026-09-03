import { Router } from 'express';
import { asyncHandler, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import { AppError } from '../../http/errors.js';
import * as hotspots from './hotspots.service.js';

export const hotspotsRouter = Router();

const numList = (s: string) => s.split(',').map((x) => Number(x.trim()));

const baseQuery = z.object({
  bbox: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const n = numList(v);
      if (n.length !== 4 || n.some(Number.isNaN)) {
        ctx.addIssue({ code: 'custom', message: 'bbox must be "minLng,minLat,maxLng,maxLat"' });
        return z.NEVER;
      }
      return n as [number, number, number, number];
    }),
  centerLat: z.coerce.number().min(-90).max(90).optional(),
  centerLng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(500).optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
  crop: z.string().trim().min(1).max(80).optional(),
  district: z.string().trim().min(1).max(120).optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  category: z.enum(['disease', 'pest', 'deficiency', 'healthy', 'unknown']).optional(),
  includePending: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(500),
});

function parseArea(q: z.infer<typeof baseQuery>): hotspots.HotspotQuery {
  const center =
    q.centerLat != null && q.centerLng != null
      ? { lat: q.centerLat, lng: q.centerLng, radiusKm: q.radiusKm ?? 25 }
      : undefined;
  if (!q.bbox && !center) {
    throw AppError.badRequest('Provide bbox="minLng,minLat,maxLng,maxLat" or centerLat+centerLng');
  }
  return {
    bbox: q.bbox,
    center,
    days: q.days,
    crop: q.crop,
    district: q.district,
    severity: q.severity,
    category: q.category,
    includePending: q.includePending,
    limit: q.limit,
  };
}

hotspotsRouter.get(
  '/',
  requireAuth('official'),
  asyncHandler(async (req, res) => {
    const q = parseArea(baseQuery.parse(req.query));
    const [points, summary] = await Promise.all([
      hotspots.getHotspotPoints(q),
      hotspots.getHotspotSummary(q),
    ]);
    res.json({ points, summary, count: points.length });
  }),
);

hotspotsRouter.get(
  '/summary',
  requireAuth('official'),
  asyncHandler(async (req, res) => {
    const q = parseArea(baseQuery.parse(req.query));
    res.json({ summary: await hotspots.getHotspotSummary(q) });
  }),
);

hotspotsRouter.get(
  '/nearby',
  requireAuth('farmer'),
  asyncHandler(async (req, res) => {
    const { radiusKm, days } = z
      .object({
        radiusKm: z.coerce.number().positive().max(100).default(10),
        days: z.coerce.number().int().min(1).max(90).default(21),
      })
      .parse(req.query);
    const result = await hotspots.getNearbyOutbreaksForFarmer(req.user!.sub, { radiusKm, days });
    res.json(result);
  }),
);
