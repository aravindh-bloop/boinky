import { Router } from 'express';
import { asyncHandler, validate, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import { imageUpload } from '../../http/upload.js';
import { AppError } from '../../http/errors.js';
import { getUserById } from '../auth/auth.service.js';
import { checkScanSafety } from '../pesticides/pesticides.service.js';
import * as scans from './scans.service.js';

export const scansRouter = Router();

scansRouter.use(requireAuth('farmer'));

const idParam = z.object({ id: z.string().uuid() });

const createBody = z.object({
  fieldId: z.string().uuid().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

const listQuery = z.object({
  fieldId: z.string().uuid().optional(),
  status: z
    .enum(['pending', 'auto_confirmed', 'needs_validation', 'validated', 'corrected', 'rejected'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

scansRouter.post(
  '/',
  imageUpload.single('image'),
  validate({ body: createBody }),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('An image file is required (field name: "image")');
    const me = await getUserById(req.user!.sub);
    const scan = await scans.createScan({
      farmerId: me.id,
      farmerLanguage: me.preferred_language,
      farmerRegion: me.region,
      image: { buffer: req.file.buffer, mimetype: req.file.mimetype },
      fieldId: req.body.fieldId,
      lat: req.body.lat,
      lng: req.body.lng,
    });
    res.status(201).json({ scan });
  }),
);

scansRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    const list = await scans.listScans({ farmerId: req.user!.sub, ...q });
    res.json({ scans: list });
  }),
);

scansRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const scan = await scans.getScan(id, req.user!.sub);
    res.json({ scan });
  }),
);

scansRouter.post(
  '/:id/advisory/retry',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const scan = await scans.retryAdvisory(id, req.user!.sub);
    res.json({ scan });
  }),
);

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

scansRouter.get(
  '/:id/safety',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { harvestDate } = z.object({ harvestDate: dateStr.optional() }).parse(req.query);
    const report = await checkScanSafety(id, req.user!.sub, harvestDate);
    res.json(report);
  }),
);
