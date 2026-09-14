import { Router } from 'express';
import { asyncHandler, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import { AppError } from '../../http/errors.js';
import { buildOutbreakProjection } from './outbreak-projection.service.js';

export const outbreakProjectionRouter = Router();

const bodySchema = z.object({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  center: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), radiusKm: z.number().positive().max(500) })
    .optional(),
  days: z.number().int().min(1).max(365).default(30),
  crop: z.string().trim().min(1).max(80).optional(),
  district: z.string().trim().min(1).max(120).optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  category: z.enum(['disease', 'pest', 'deficiency', 'healthy', 'unknown']).optional(),
  horizonDays: z.number().int().min(1).max(30).default(21),
});

// POST, not GET: the body mirrors /api/hotspots's filter shape and this is an
// explicit, on-demand officer action (DB queries + one weather fetch + one
// Gemini call — same latency ballpark as this app's existing diagnosis calls),
// not a cacheable resource fetch.
outbreakProjectionRouter.post(
  '/',
  requireAuth('official'),
  asyncHandler(async (req, res) => {
    const body = bodySchema.parse(req.body);
    if (!body.bbox && !body.center) {
      throw AppError.badRequest('Provide bbox or center+radiusKm');
    }
    const result = await buildOutbreakProjection(body);
    res.json(result);
  }),
);
