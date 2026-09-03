import { Router, type Request } from 'express';
import { asyncHandler, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import { getUserById } from '../auth/auth.service.js';
import { generateTasks } from '../calendar/task-templates.js';
import { cropProfile, knownCrops } from '../risk/crop-profiles.js';
import { query } from '../../db/query.js';
import * as official from './official.service.js';
import * as apps from '../schemes/applications.service.js';

export const officialRouter = Router();

officialRouter.use(requireAuth('official'));

/** Resolve the caller's region once; `?allRegions=true` opts out of scoping. */
async function scopeRegion(req: Request): Promise<string | null> {
  const allRegions = (req.query as { allRegions?: string }).allRegions === 'true';
  if (allRegions) return null;
  const me = await getUserById(req.user!.sub);
  return me.region;
}

officialRouter.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const region = await scopeRegion(req);
    res.json(await official.getOverview(region));
  }),
);

officialRouter.get(
  '/validation-queue',
  asyncHandler(async (req, res) => {
    const { crop, district, includeResolved, limit, offset } = z
      .object({
        crop: z.string().trim().min(1).max(80).optional(),
        district: z.string().trim().min(1).max(120).optional(),
        includeResolved: z.coerce.boolean().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(req.query);
    const region = await scopeRegion(req);
    const items = await official.getValidationQueue({
      region,
      crop,
      district,
      includeResolved,
      limit,
      offset,
    });
    res.json({ items });
  }),
);

officialRouter.get(
  '/districts',
  asyncHandler(async (req, res) => {
    const { days } = z
      .object({ days: z.coerce.number().int().min(7).max(365).default(30) })
      .parse(req.query);
    const region = await scopeRegion(req);
    res.json({ districts: await official.getDistrictBreakdown(region, days) });
  }),
);

officialRouter.get(
  '/scans/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    res.json({ scan: await official.getScanForOfficer(id) });
  }),
);

officialRouter.post(
  '/scans/:id/validate',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z
      .object({
        action: z.enum(['confirm', 'correct', 'reject']),
        correctedLabel: z.string().trim().min(2).max(120).optional(),
        correctedCategory: z
          .enum(['disease', 'pest', 'deficiency', 'healthy', 'unknown'])
          .optional(),
        correctedSeverity: z.enum(['low', 'medium', 'high']).optional(),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(req.body);
    const result = await official.validateScan(id, req.user!.sub, body);
    res.json({ scan: result });
  }),
);

officialRouter.get(
  '/directory',
  asyncHandler(async (req, res) => {
    const { q, limit, offset } = z
      .object({
        q: z.string().trim().min(1).max(80).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(req.query);
    const region = await scopeRegion(req);
    const farmers = await official.getDirectory({ region, search: q, limit, offset });
    res.json({ farmers });
  }),
);

officialRouter.get(
  '/crops',
  asyncHandler(async (req, res) => {
    const region = await scopeRegion(req);
    const params: unknown[] = [];
    let where = 'f.crop IS NOT NULL';
    if (region) {
      params.push(region);
      where += ` AND u.region = $${params.length}`;
    }
    const rows = await query<{ crop: string }>(
      `SELECT DISTINCT lower(f.crop) AS crop
         FROM fields f JOIN users u ON u.id = f.farmer_id
        WHERE ${where} ORDER BY 1`,
      params,
    );
    res.json({ known: knownCrops, inRegion: rows.map((r) => r.crop) });
  }),
);

officialRouter.get(
  '/calendar-template',
  asyncHandler(async (req, res) => {
    const { crop } = z.object({ crop: z.string().trim().min(2).max(60) }).parse(req.query);
    const p = cropProfile(crop);
    res.json({
      crop,
      durationDays: p.durationDays,
      peakVulnerability: p.peakVulnerability,
      mainThreats: p.mainThreats,
      tasks: generateTasks(crop),
    });
  }),
);

// ── scheme / subsidy management ──────────────────────────────────────────

officialRouter.get(
  '/scheme-summary',
  asyncHandler(async (req, res) => {
    res.json(await apps.schemeSummaryForOfficer(await scopeRegion(req)));
  }),
);

officialRouter.get(
  '/scheme-applications',
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        status: z
          .enum(['submitted', 'under_review', 'approved', 'rejected', 'disbursed'])
          .optional(),
        schemeId: z.string().uuid().optional(),
        q: z.string().trim().min(1).max(80).optional(),
        limit: z.coerce.number().int().min(1).max(200).default(100),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(req.query);
    const items = await apps.listApplicationsForOfficer({
      region: await scopeRegion(req),
      status: q.status,
      schemeId: q.schemeId,
      search: q.q,
      limit: q.limit,
      offset: q.offset,
    });
    res.json({ items });
  }),
);

officialRouter.post(
  '/scheme-applications/:id/decision',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z
      .object({
        status: z.enum(['under_review', 'approved', 'rejected', 'disbursed']),
        note: z.string().trim().max(1000).optional(),
        amount: z.coerce.number().min(0).max(10_000_000).optional(),
      })
      .parse(req.body);
    const application = await apps.decideApplication(id, req.user!.sub, body);
    res.json({ application });
  }),
);

officialRouter.get(
  '/scheme-threads',
  asyncHandler(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(['open', 'answered', 'closed']).optional() })
      .parse(req.query);
    res.json({ threads: await apps.listThreadsForOfficer(await scopeRegion(req), status) });
  }),
);

officialRouter.get(
  '/scheme-threads/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    res.json(await apps.getThread(id, { id: req.user!.sub, role: 'official' }));
  }),
);

officialRouter.post(
  '/scheme-threads/:id/messages',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body);
    await apps.postMessage(id, { id: req.user!.sub, role: 'official' }, body);
    res.status(201).json({ ok: true });
  }),
);

officialRouter.post(
  '/scheme-threads/:id/close',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await apps.setThreadStatus(id, 'closed');
    res.status(204).end();
  }),
);

officialRouter.get(
  '/trends',
  asyncHandler(async (req, res) => {
    const { days } = z
      .object({ days: z.coerce.number().int().min(7).max(365).default(90) })
      .parse(req.query);
    const region = await scopeRegion(req);
    res.json(await official.getTrends(region, days));
  }),
);
