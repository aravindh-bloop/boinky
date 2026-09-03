import { Router } from 'express';
import { asyncHandler, validate, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import { audioUpload, imageUpload, scanMediaUpload, isScanMedia } from '../../http/upload.js';
import { transcribeAudio } from '../../integrations/sarvam.js';
import { AppError } from '../../http/errors.js';
import { logger } from '../../lib/logger.js';
import { getUserById } from '../auth/auth.service.js';
import { checkScanSafety } from '../pesticides/pesticides.service.js';
import { localizeMany } from '../../lib/localize.js';
import { toSarvamLang } from '../../integrations/sarvam.js';
import * as scans from './scans.service.js';

/**
 * The advisory is stored in the language it was generated in. If the farmer has
 * since switched languages, translate it on read (cached after the first time).
 * Disease labels stay in English by design.
 */
async function localizeAdvisories<T extends { advisory_text: string | null; advisory_language: string | null }>(
  rows: T[],
  farmerId: string,
): Promise<T[]> {
  const me = await getUserById(farmerId).catch(() => null);
  const want = toSarvamLang(me?.preferred_language);
  if (want === 'en-IN') return rows;
  const need = rows.filter(
    (r) => r.advisory_text && toSarvamLang(r.advisory_language) !== want,
  );
  if (need.length === 0) return rows;
  const translated = await localizeMany(need.map((r) => r.advisory_text as string), want);
  need.forEach((r, i) => {
    r.advisory_text = translated[i] ?? r.advisory_text;
    r.advisory_language = want;
  });
  return rows;
}

export const scansRouter = Router();

scansRouter.use(requireAuth('farmer'));

const idParam = z.object({ id: z.string().uuid() });

const createBody = z.object({
  fieldId: z.string().uuid().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  accuracyM: z.coerce.number().min(0).max(100000).optional(),
  /** The farmer's spoken (transcribed) or typed description of the problem. */
  note: z.string().trim().max(2000).optional(),
  noteLanguage: z.string().trim().max(10).optional(),
});

const listQuery = z.object({
  fieldId: z.string().uuid().optional(),
  status: z
    .enum(['pending', 'auto_confirmed', 'needs_validation', 'validated', 'corrected', 'rejected'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const ANGLE_KINDS = [
  'whole_plant',
  'affected_closeup',
  'leaf_underside',
  'stem_base',
  'fruit_panicle',
  'field_wide',
  'video',
  'extra',
] as const;

const draftBody = z.object({
  fieldId: z.string().uuid().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  accuracyM: z.coerce.number().min(0).max(100000).optional(),
});

const submitBody = z.object({
  note: z.string().trim().max(2000).optional(),
  noteLanguage: z.string().trim().max(10).optional(),
  force: z.coerce.boolean().optional(),
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
      locationAccuracyM: req.body.accuracyM,
      farmerNote: req.body.note,
      farmerNoteLanguage: req.body.noteLanguage,
    });
    res.status(201).json({ scan });
  }),
);

// ── Multi-angle "resource verification" scan (Module 1) ──

scansRouter.post(
  '/draft',
  validate({ body: draftBody }),
  asyncHandler(async (req, res) => {
    const draft = await scans.createScanDraft({
      farmerId: req.user!.sub,
      fieldId: req.body.fieldId,
      lat: req.body.lat,
      lng: req.body.lng,
      locationAccuracyM: req.body.accuracyM,
    });
    res.status(201).json(draft);
  }),
);

scansRouter.post(
  '/:id/media',
  scanMediaUpload.single('media'),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    if (!req.file) throw AppError.badRequest('A file is required (field name: "media")');
    const { kind, position } = z
      .object({
        kind: z.enum(ANGLE_KINDS),
        position: z.coerce.number().int().min(0).max(20).optional(),
      })
      .parse(req.body);

    const resource = isScanMedia(req.file.mimetype, req.file.originalname);
    if (!resource) throw AppError.badRequest('Unsupported media type');
    if (kind === 'video' && resource !== 'video') {
      throw AppError.badRequest('kind "video" needs a video file');
    }

    const media = await scans.addScanMedia(id, req.user!.sub, {
      kind,
      resource: kind === 'video' ? 'video' : resource,
      file: {
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
      },
      position,
    });
    res.status(201).json({ media });
  }),
);

scansRouter.delete(
  '/:id/media/:mediaId',
  asyncHandler(async (req, res) => {
    const { id, mediaId } = z
      .object({ id: z.string().uuid(), mediaId: z.string().uuid() })
      .parse(req.params);
    await scans.removeScanMedia(id, mediaId, req.user!.sub);
    res.status(204).end();
  }),
);

scansRouter.post(
  '/:id/submit',
  validate({ body: submitBody }),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const me = await getUserById(req.user!.sub);
    const scan = await scans.submitScanDraft(id, {
      farmerId: me.id,
      farmerLanguage: me.preferred_language,
      farmerRegion: me.region,
      farmerNote: req.body.note,
      farmerNoteLanguage: req.body.noteLanguage,
      force: req.body.force,
    });
    res.status(201).json({ scan });
  }),
);

/**
 * Transcribe a spoken voice note. Separate from POST /api/scans on purpose: the
 * farmer sees the text and can correct it before it is sent for diagnosis.
 */
scansRouter.post(
  '/transcribe',
  audioUpload.single('audio'),
  asyncHandler(async (req, res) => {
    // Log what actually arrived before validating any of it. Every 400 from this
    // route so far has been guesswork about what the device sends; this puts the
    // answer in the server log instead.
    logger.info(
      {
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length'],
        hasFile: Boolean(req.file),
        fieldname: req.file?.fieldname,
        originalname: req.file?.originalname,
        mimetype: req.file?.mimetype,
        size: req.file?.size,
        bodyKeys: Object.keys(req.body ?? {}),
      },
      'transcribe request received',
    );

    if (!req.file) {
      throw AppError.badRequest(
        `No audio file in the upload. Expected multipart field "audio"; got content-type ` +
          `${req.headers['content-type'] ?? 'none'} and fields ` +
          `[${Object.keys(req.body ?? {}).join(', ') || 'none'}].`,
      );
    }
    if (req.file.size === 0) {
      throw AppError.badRequest('The recording was empty (0 bytes). Record again and hold the mic closer.');
    }

    const { language } = z
      .object({ language: z.string().trim().max(10).optional() })
      .parse(req.body ?? {});
    const result = await transcribeAudio(
      req.file.buffer,
      req.file.originalname || 'note.m4a',
      req.file.mimetype,
      // Default to auto-detection: a farmer may well speak a different language
      // than the one set on their profile.
      language || 'unknown',
    );
    res.json({ transcript: result.text, language: result.language });
  }),
);

scansRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    const list = await scans.listScans({ farmerId: req.user!.sub, ...q });
    res.json({ scans: await localizeAdvisories(list, req.user!.sub) });
  }),
);

scansRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const scan = await scans.getScan(id, req.user!.sub);
    const [localized] = await localizeAdvisories([scan], req.user!.sub);
    res.json({ scan: localized });
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

scansRouter.post(
  '/:id/feedback',
  validate({ body: z.object({ helpful: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    await scans.rateAdvisory(id, req.user!.sub, (req.body as { helpful: boolean }).helpful);
    res.status(204).end();
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
