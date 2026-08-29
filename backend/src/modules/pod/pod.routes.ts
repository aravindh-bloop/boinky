import { Router } from 'express';
import { asyncHandler, validate, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import { AppError } from '../../http/errors.js';
import { logger } from '../../lib/logger.js';
import * as pod from './pod.service.js';

export const podRouter = Router();

// ── device ingest — NO JWT, authenticates with the pod key ────────────────

const reading = z.object({
  key: z.string().trim().min(8).max(80).optional(),
  temperature: z.coerce.number().min(-40).max(90).optional(),
  soilMoisture: z.coerce.number().min(0).max(100).optional(),
  ph: z.coerce.number().min(0).max(14).optional(),
  airHumidity: z.coerce.number().min(0).max(100).optional(),
  battery: z.coerce.number().min(0).max(100).optional(),
  raw: z.unknown().optional(),
});

podRouter.post(
  '/readings',
  validate({ body: reading }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof reading>;
    const key = body.key ?? (req.header('x-pod-key') ?? '');
    if (!key) throw AppError.unauthorized('Missing pod key (X-Pod-Key header or "key" field)');
    const out = await pod.ingestReading({ ...body, key });
    logger.info({ deviceId: out.deviceId, fieldId: out.fieldId }, 'pod reading');
    res.status(201).json({ ok: true, ...out, serverTime: new Date().toISOString() });
  }),
);

// ── everything below needs a farmer JWT ──────────────────────────────────

podRouter.use(requireAuth('farmer'));

const fieldQuery = z.object({ fieldId: z.string().uuid() });

podRouter.get(
  '/latest',
  validate({ query: fieldQuery }),
  asyncHandler(async (req, res) => {
    const { fieldId } = req.query as unknown as z.infer<typeof fieldQuery>;
    res.json(await pod.latestForField(req.user!.sub, fieldId));
  }),
);

podRouter.get(
  '/devices',
  asyncHandler(async (req, res) => {
    res.json({ devices: await pod.listDevices(req.user!.sub) });
  }),
);

podRouter.post(
  '/devices',
  validate({
    body: z.object({
      fieldId: z.string().uuid(),
      label: z.string().trim().max(60).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { fieldId, label } = req.body as { fieldId: string; label?: string };
    const out = await pod.registerDevice(req.user!.sub, fieldId, label ?? '');
    res.status(201).json(out); // { deviceId, key } — key shown once
  }),
);

podRouter.delete(
  '/devices/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await pod.deleteDevice(req.user!.sub, id);
    res.status(204).end();
  }),
);
