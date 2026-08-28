import { Router } from 'express';
import { asyncHandler, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import { getWeather } from './weather.service.js';

export const weatherRouter = Router();

weatherRouter.get(
  '/',
  requireAuth('farmer'),
  asyncHandler(async (req, res) => {
    const { fieldId, lat, lng } = z
      .object({
        fieldId: z.string().uuid().optional(),
        lat: z.coerce.number().min(-90).max(90).optional(),
        lng: z.coerce.number().min(-180).max(180).optional(),
      })
      .parse(req.query);
    const result = await getWeather({ farmerId: req.user!.sub, fieldId, lat, lng });
    if (!result) {
      res.status(404).json({ error: { code: 'no_location', message: 'No location for weather' } });
      return;
    }
    res.json(result);
  }),
);
