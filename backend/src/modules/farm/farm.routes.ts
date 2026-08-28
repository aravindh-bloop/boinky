import { Router } from 'express';
import { asyncHandler, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import * as act from './activities.service.js';
import * as fin from './finance.service.js';
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
        logExpense: z.boolean().optional(),
        expenseCategory: z.enum(fin.EXPENSE_CATEGORIES).optional(),
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

// ── Expenses ──
export const expensesRouter = Router();
expensesRouter.use(requireAuth('farmer'));

expensesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = z.object(page).parse(req.query);
    res.json({ expenses: await fin.listExpenses({ farmerId: req.user!.sub, ...q }) });
  }),
);
expensesRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(3650).default(180) }).parse(req.query);
    res.json(await fin.financeSummary(req.user!.sub, days));
  }),
);
expensesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        fieldId: z.string().uuid().optional(),
        category: z.enum(fin.EXPENSE_CATEGORIES),
        description: z.string().trim().max(500).optional(),
        amount: z.coerce.number().min(0),
        spentOn: dateStr.optional(),
      })
      .parse(req.body);
    res.status(201).json({ expense: await fin.createExpense(req.user!.sub, body) });
  }),
);
expensesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await fin.deleteExpense(id, req.user!.sub);
    res.status(204).end();
  }),
);

// ── Harvests ──
export const harvestsRouter = Router();
harvestsRouter.use(requireAuth('farmer'));

harvestsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = z.object(page).parse(req.query);
    res.json({ harvests: await fin.listHarvests({ farmerId: req.user!.sub, ...q }) });
  }),
);
harvestsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        fieldId: z.string().uuid().optional(),
        harvestedOn: dateStr.optional(),
        crop: z.string().trim().max(80).optional(),
        quantity: z.coerce.number().min(0),
        unit: z.string().trim().max(20).optional(),
        unitPrice: z.coerce.number().min(0).optional(),
        revenue: z.coerce.number().min(0).optional(),
        buyer: z.string().trim().max(120).optional(),
        note: z.string().trim().max(500).optional(),
      })
      .parse(req.body);
    res.status(201).json({ harvest: await fin.createHarvest(req.user!.sub, body) });
  }),
);
harvestsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await fin.deleteHarvest(id, req.user!.sub);
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
