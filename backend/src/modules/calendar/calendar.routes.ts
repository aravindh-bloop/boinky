import { Router } from 'express';
import { asyncHandler, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import * as calendar from './calendar.service.js';

export const calendarRouter = Router();

calendarRouter.use(requireAuth('farmer'));

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const fieldIdParam = z.object({ fieldId: z.string().uuid() });
const taskIdParam = z.object({ taskId: z.string().uuid() });

const taskType = z.enum([
  'irrigation',
  'spraying',
  'fertilizing',
  'scouting',
  'harvest',
  'other',
]);

calendarRouter.get(
  '/:fieldId',
  asyncHandler(async (req, res) => {
    const { fieldId } = fieldIdParam.parse(req.params);
    const { from, to } = z
      .object({ from: dateStr.optional(), to: dateStr.optional() })
      .parse(req.query);
    const tasks = await calendar.listTasks(fieldId, req.user!.sub, { from, to });
    res.json({ tasks });
  }),
);

calendarRouter.post(
  '/:fieldId/generate',
  asyncHandler(async (req, res) => {
    const { fieldId } = fieldIdParam.parse(req.params);
    const result = await calendar.regenerateFieldCalendar(fieldId, req.user!.sub);
    const tasks = await calendar.listTasks(fieldId, req.user!.sub, {});
    res.json({ ...result, tasks });
  }),
);

calendarRouter.post(
  '/:fieldId/tasks',
  asyncHandler(async (req, res) => {
    const { fieldId } = fieldIdParam.parse(req.params);
    const body = z
      .object({
        taskDate: dateStr,
        title: z.string().trim().min(2).max(160),
        taskType: taskType.optional(),
        description: z.string().trim().max(1000).optional(),
      })
      .parse(req.body);
    const task = await calendar.addTask(fieldId, req.user!.sub, body);
    res.status(201).json({ task });
  }),
);

calendarRouter.patch(
  '/tasks/:taskId',
  asyncHandler(async (req, res) => {
    const { taskId } = taskIdParam.parse(req.params);
    const body = z
      .object({
        isDone: z.boolean().optional(),
        title: z.string().trim().min(2).max(160).optional(),
        description: z.string().trim().max(1000).optional(),
        taskDate: dateStr.optional(),
      })
      .parse(req.body);
    const task = await calendar.updateTask(taskId, req.user!.sub, body);
    res.json({ task });
  }),
);

calendarRouter.delete(
  '/tasks/:taskId',
  asyncHandler(async (req, res) => {
    const { taskId } = taskIdParam.parse(req.params);
    await calendar.deleteTask(taskId, req.user!.sub);
    res.status(204).end();
  }),
);
