import { Router } from 'express';
import { asyncHandler, validate, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import { logger } from '../../lib/logger.js';
import { regenerateFieldCalendar } from '../calendar/calendar.service.js';
import * as fields from './fields.service.js';

export const fieldsRouter = Router();

fieldsRouter.use(requireAuth('farmer'));

const idParam = z.object({ id: z.string().uuid() });

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date');

const lat = z.coerce.number().min(-90).max(90);
const lng = z.coerce.number().min(-180).max(180);

const createSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  crop: z.string().trim().min(1).max(80),
  variety: z.string().trim().min(1).max(80).optional(),
  sownDate: dateStr.optional(),
  lat: lat.optional(),
  lng: lng.optional(),
  areaAcres: z.coerce.number().positive().max(100000).optional(),
});

const updateSchema = createSchema.partial();

fieldsRouter.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const field = await fields.createField(req.user!.sub, req.body);
    // Auto-seed the crop calendar when we have a sowing date. Best-effort.
    if (field.sown_date) {
      try {
        await regenerateFieldCalendar(field.id, req.user!.sub);
      } catch (err) {
        logger.warn({ err, fieldId: field.id }, 'calendar auto-generate failed (non-fatal)');
      }
    }
    res.status(201).json({ field });
  }),
);

fieldsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await fields.listFields(req.user!.sub);
    res.json({ fields: list });
  }),
);

fieldsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const field = await fields.getOwnedField(id, req.user!.sub);
    res.json({ field });
  }),
);

fieldsRouter.patch(
  '/:id',
  validate({ body: updateSchema }),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const field = await fields.updateField(id, req.user!.sub, req.body);
    res.json({ field });
  }),
);

fieldsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    await fields.deleteField(id, req.user!.sub);
    res.status(204).end();
  }),
);
