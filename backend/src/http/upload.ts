import multer from 'multer';
import { AppError } from './errors.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    cb(AppError.badRequest(`Unsupported image type: ${file.mimetype}`));
  },
});

// expo-audio records m4a/aac on both platforms; the rest are what Sarvam accepts,
// so a recording from anywhere else still goes through.
const ALLOWED_AUDIO = new Set([
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/aac',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/webm',
  'audio/ogg',
  'audio/opus',
  'audio/flac',
]);

/** Voice notes are short (capped client-side); 10MB is far more than 60s of AAC. */
export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_AUDIO.has(file.mimetype.toLowerCase())) return cb(null, true);
    cb(AppError.badRequest(`Unsupported audio type: ${file.mimetype}`));
  },
});
