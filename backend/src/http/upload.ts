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

const AUDIO_EXT = /\.(m4a|mp4|aac|mp3|wav|wave|weba|webm|ogg|oga|opus|flac|amr|3gp|caf)$/i;

/** Voice notes are short (capped client-side); 10MB is far more than 60s of AAC. */
export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    if (ALLOWED_AUDIO.has(mime)) return cb(null, true);

    // React Native's native uploader labels the part application/octet-stream no
    // matter what mimeType the client asks for, so a real recording from the app
    // never matches the list above. Fall back to the filename, which does carry
    // the extension (expo-audio writes recording-<uuid>.m4a). Sarvam sniffs the
    // actual container anyway; this filter only exists to reject obvious junk.
    if ((mime === 'application/octet-stream' || mime === '') && AUDIO_EXT.test(file.originalname || '')) {
      return cb(null, true);
    }

    cb(
      AppError.badRequest(
        `Unsupported audio type: ${file.mimetype || 'unknown'} (${file.originalname || 'no filename'})`,
      ),
    );
  },
});
