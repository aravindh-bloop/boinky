import { Router } from 'express';
import { asyncHandler, validate, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import { scanMediaUpload, isScanMedia } from '../../http/upload.js';
import { AppError } from '../../http/errors.js';
import { CLAIM_CAUSES } from './insurance.service.js';
import * as ins from './insurance.service.js';

export const insuranceRouter = Router();

insuranceRouter.use(requireAuth('farmer'));

const idParam = z.object({ id: z.string().uuid() });

// ── policies ──
insuranceRouter.get(
  '/schemes',
  asyncHandler(async (_req, res) => {
    res.json({ schemes: await ins.listInsuranceSchemes() });
  }),
);

insuranceRouter.get(
  '/policies',
  asyncHandler(async (req, res) => {
    res.json({ policies: await ins.listPolicies(req.user!.sub) });
  }),
);

insuranceRouter.post(
  '/policies',
  validate({
    body: z.object({
      fieldId: z.string().uuid().optional(),
      schemeId: z.string().uuid().optional(),
      crop: z.string().trim().min(1).max(80),
      season: z.string().trim().min(1).max(40),
      sumInsured: z.coerce.number().min(0).max(100_000_000).optional(),
      premiumPaid: z.coerce.number().min(0).max(10_000_000).optional(),
      areaAcres: z.coerce.number().min(0).max(100000).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ policy: await ins.enrollPolicy(req.user!.sub, req.body) });
  }),
);

// ── claims ──
insuranceRouter.get(
  '/claims',
  asyncHandler(async (req, res) => {
    res.json({ claims: await ins.listMyClaims(req.user!.sub) });
  }),
);

insuranceRouter.post(
  '/claims',
  validate({
    body: z.object({
      policyId: z.string().uuid(),
      cause: z.enum(CLAIM_CAUSES),
      description: z.string().trim().max(2000).optional(),
      incidentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      scanId: z.string().uuid().optional(),
      estimatedLossPct: z.coerce.number().int().min(0).max(100).optional(),
      lat: z.coerce.number().min(-90).max(90).optional(),
      lng: z.coerce.number().min(-180).max(180).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await ins.createClaim(req.user!.sub, req.body));
  }),
);

insuranceRouter.get(
  '/claims/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await ins.getClaim(id, { id: req.user!.sub, role: 'farmer' }));
  }),
);

insuranceRouter.post(
  '/claims/:id/media',
  scanMediaUpload.single('media'),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    if (!req.file) throw AppError.badRequest('A file is required (field name: "media")');
    const { caption, lat, lng } = z
      .object({
        caption: z.string().trim().max(200).optional(),
        lat: z.coerce.number().min(-90).max(90).optional(),
        lng: z.coerce.number().min(-180).max(180).optional(),
      })
      .parse(req.body);
    const resource = isScanMedia(req.file.mimetype, req.file.originalname);
    if (!resource) throw AppError.badRequest('Unsupported media type');
    const media = await ins.addClaimMedia(id, req.user!.sub, {
      kind: resource === 'video' ? 'video' : 'photo',
      file: { buffer: req.file.buffer, mimetype: req.file.mimetype, originalname: req.file.originalname },
      caption,
      lat,
      lng,
    });
    res.status(201).json({ media });
  }),
);

insuranceRouter.delete(
  '/claims/:id/media/:mediaId',
  asyncHandler(async (req, res) => {
    const { id, mediaId } = z
      .object({ id: z.string().uuid(), mediaId: z.string().uuid() })
      .parse(req.params);
    await ins.removeClaimMedia(id, mediaId, req.user!.sub);
    res.status(204).end();
  }),
);

insuranceRouter.post(
  '/claims/:id/submit',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.status(201).json(await ins.submitClaim(id, req.user!.sub));
  }),
);

insuranceRouter.post(
  '/claims/:id/messages',
  validate({ body: z.object({ body: z.string().trim().min(1).max(2000) }) }),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    await ins.postClaimMessage(id, { id: req.user!.sub, role: 'farmer' }, (req.body as { body: string }).body);
    res.status(201).json({ ok: true });
  }),
);
