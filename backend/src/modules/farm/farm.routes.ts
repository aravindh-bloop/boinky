import { Router } from 'express';
import { asyncHandler, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import * as act from './activities.service.js';
import { getFarmerTasks } from './tasks.service.js';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const page = {
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
  fieldId: z.string().uuid().optional(),
};

// ── Activities ──
export const activitiesRouter = Router();
activitiesRouter.use(requireAuth('farmer'));

activitiesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = z.object(page).parse(req.query);
    res.json({ activities: await act.listActivities({ farmerId: req.user!.sub, ...q }) });
  }),
);
activitiesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        fieldId: z.string().uuid().optional(),
        kind: z.enum(act.ACTIVITY_KINDS),
        title: z.string().trim().min(2).max(160),
        note: z.string().trim().max(1000).optional(),
        inputName: z.string().trim().max(160).optional(),
        quantity: z.coerce.number().min(0).optional(),
        unit: z.string().trim().max(20).optional(),
        cost: z.coerce.number().min(0).optional(),
        activityDate: dateStr.optional(),
        sourceTaskId: z.string().uuid().optional(),
      })
      .parse(req.body);
    res.status(201).json({ activity: await act.createActivity(req.user!.sub, body) });
  }),
);
activitiesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await act.deleteActivity(id, req.user!.sub);
    res.status(204).end();
  }),
);

// ── Tasks (cross-field) ──
export const tasksRouter = Router();
tasksRouter.use(requireAuth('farmer'));

tasksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(60).default(14) }).parse(req.query);
    res.json(await getFarmerTasks(req.user!.sub, days));
  }),
);
