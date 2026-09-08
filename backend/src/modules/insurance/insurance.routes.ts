import { Router } from 'express';
import { asyncHandler, validate, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import * as ins from './insurance.service.js';
import {
  CLAIM_CAUSES,
  LOSS_TYPES,
  CLAIM_STAGES,
  RUNGS,
  RUNG_INFO,
  STAGE_INFO,
} from './reference.js';

export const insuranceRouter = Router();
insuranceRouter.use(requireAuth('farmer'));

const idParam = z.object({ id: z.string().uuid() });
const money = z.coerce.number().min(0).max(100_000_000);

// ── reference data (so the app never hardcodes the PMFBY model) ──
insuranceRouter.get(
  '/reference',
  asyncHandler(async (_req, res) => {
    res.json({
      causes: CLAIM_CAUSES,
      lossTypes: LOSS_TYPES,
      stages: CLAIM_STAGES.map((s) => STAGE_INFO[s]),
      rungs: RUNGS.map((r) => ({ rung: r, ...RUNG_INFO[r] })),
    });
  }),
);

// ── policy refs ──
insuranceRouter.get(
  '/policies',
  asyncHandler(async (req, res) => {
    res.json({ policies: await ins.listPolicyRefs(req.user!.sub) });
  }),
);

insuranceRouter.post(
  '/policies',
  validate({
    body: z.object({
      fieldId: z.string().uuid().optional(),
      applicationNo: z.string().trim().max(80).optional(),
      season: z.string().trim().min(1).max(40),
      crop: z.string().trim().min(1).max(80),
      insuranceUnit: z.string().trim().max(120).optional(),
      insurerName: z.string().trim().max(120).optional(),
      sumInsured: money.optional(),
      premiumPaid: money.optional(),
      areaAcres: z.coerce.number().min(0).max(100000).optional(),
      district: z.string().trim().max(120).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ policy: await ins.addPolicyRef(req.user!.sub, req.body) });
  }),
);

insuranceRouter.patch(
  '/policies/:id',
  validate({
    body: z.object({
      applicationNo: z.string().trim().max(80).optional(),
      season: z.string().trim().min(1).max(40).optional(),
      crop: z.string().trim().min(1).max(80).optional(),
      insuranceUnit: z.string().trim().max(120).optional(),
      insurerName: z.string().trim().max(120).optional(),
      sumInsured: money.optional(),
      premiumPaid: money.optional(),
      areaAcres: z.coerce.number().min(0).max(100000).optional(),
      district: z.string().trim().max(120).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    await ins.updatePolicyRef(id, req.user!.sub, req.body);
    res.json({ ok: true });
  }),
);

insuranceRouter.delete(
  '/policies/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    await ins.removePolicyRef(id, req.user!.sub);
    res.status(204).end();
  }),
);

// ── claim tracking ──
insuranceRouter.get(
  '/claims',
  asyncHandler(async (req, res) => {
    res.json({ claims: await ins.listClaimTracks(req.user!.sub) });
  }),
);

insuranceRouter.post(
  '/claims',
  validate({
    body: z.object({
      policyRefId: z.string().uuid(),
      cause: z.enum(CLAIM_CAUSES),
      lossType: z.enum(LOSS_TYPES).optional(),
      incidentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      docketId: z.string().trim().max(80).optional(),
      farmerEstimatedLossPct: z.coerce.number().int().min(0).max(100).optional(),
      note: z.string().trim().max(2000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await ins.createClaimTrack(req.user!.sub, req.body));
  }),
);

insuranceRouter.get(
  '/claims/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await ins.getClaimTrack(id, req.user!.sub));
  }),
);

insuranceRouter.patch(
  '/claims/:id',
  validate({
    body: z.object({
      stage: z.enum(CLAIM_STAGES),
      stageSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      outcome: z.enum(['approved', 'rejected', 'partial', 'pending']).nullable().optional(),
      amountExpected: money.nullable().optional(),
      amountPaid: money.nullable().optional(),
      paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      docketId: z.string().trim().max(80).nullable().optional(),
      note: z.string().trim().max(2000).nullable().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await ins.advanceClaimStage(id, req.user!.sub, req.body));
  }),
);

insuranceRouter.post(
  '/claims/:id/notes',
  validate({ body: z.object({ body: z.string().trim().min(1).max(2000) }) }),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    await ins.addClaimNote(id, req.user!.sub, (req.body as { body: string }).body);
    res.status(201).json({ ok: true });
  }),
);

// ── escalation ──
insuranceRouter.get(
  '/claims/:id/escalation',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await ins.escalationOptions(id, req.user!.sub));
  }),
);

insuranceRouter.post(
  '/claims/:id/escalate',
  validate({
    body: z.object({
      rung: z.enum(RUNGS),
      channel: z.enum(['call', 'sms', 'email', 'krph', 'cpgrams', 'in_person']),
      reason: z.string().trim().min(1).max(600),
      directoryId: z.string().uuid().optional(),
      externalRef: z.string().trim().max(120).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.status(201).json({ escalation: await ins.createEscalation(id, req.user!.sub, req.body) });
  }),
);

insuranceRouter.get(
  '/escalations',
  asyncHandler(async (req, res) => {
    res.json({ escalations: await ins.listMyEscalations(req.user!.sub) });
  }),
);

// ── officer directory (read) ──
insuranceRouter.get(
  '/directory',
  asyncHandler(async (req, res) => {
    const { district } = z
      .object({ district: z.string().trim().max(120).optional() })
      .parse(req.query);
    res.json({ contacts: await ins.lookupDirectory(district ?? null) });
  }),
);
