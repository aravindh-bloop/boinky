import { v2 as cloudinary } from 'cloudinary';
import { env, integrations } from '../config/env.js';
import { AppError } from '../http/errors.js';
import { logger } from '../lib/logger.js';

let configured = false;
function ensure() {
  if (!integrations.cloudinary) {
    throw AppError.upstream(
      'Cloudinary is not configured (need CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)',
    );
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
}

export interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}

export async function uploadImage(
  buffer: Buffer,
  opts: { folder?: string; publicId?: string } = {},
): Promise<UploadedImage> {
  ensure();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: opts.folder ?? 'agripod/scans',
        public_id: opts.publicId,
        resource_type: 'image',
        // Downscale huge phone photos; keeps free-tier storage/bandwidth sane.
        transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto:good' }],
      },
      (error, result) => {
        if (error || !result) {
          logger.error({ error }, 'cloudinary upload failed');
          return reject(AppError.upstream('Image upload failed'));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          format: result.format,
        });
      },
    );
    stream.end(buffer);
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  ensure();
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    logger.warn({ err, publicId }, 'cloudinary delete failed (non-fatal)');
  }
}

export interface UploadedVideo {
  url: string;
  publicId: string;
  durationS: number | null;
  bytes: number;
  format: string;
}

/**
 * Upload a short crop-scan video (the farmer pans around the plant). Capped hard
 * at 15 s / 480p on Cloudinary's side so a free-tier account stays sane, and so
 * the frames we pull for the vision model are cheap.
 */
export async function uploadVideo(
  buffer: Buffer,
  opts: { folder?: string } = {},
): Promise<UploadedVideo> {
  ensure();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: opts.folder ?? 'agripod/scans',
        resource_type: 'video',
        transformation: [{ duration: 15, width: 854, height: 854, crop: 'limit', quality: 'auto' }],
      },
      (error, result) => {
        if (error || !result) {
          logger.error({ error }, 'cloudinary video upload failed');
          return reject(AppError.upstream('Video upload failed'));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          durationS: typeof result.duration === 'number' ? result.duration : null,
          bytes: result.bytes,
          format: result.format,
        });
      },
    );
    stream.end(buffer);
  });
}

export async function deleteVideo(publicId: string): Promise<void> {
  ensure();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
  } catch (err) {
    logger.warn({ err, publicId }, 'cloudinary video delete failed (non-fatal)');
  }
}

/**
 * Still-frame URLs from an uploaded video at the given offsets (seconds), as
 * downscaled JPEGs. Cloudinary renders these from the URL — no ffmpeg on the
 * dyno. Used to feed a scan video to the vision model as a few images.
 */
export function videoFrameUrls(publicId: string, offsetsS: number[] = [0.5, 2, 4]): string[] {
  ensure();
  return offsetsS.map((so) =>
    cloudinary.url(publicId, {
      resource_type: 'video',
      format: 'jpg',
      transformation: [{ start_offset: so, width: 1024, height: 1024, crop: 'limit', quality: 82 }],
    }),
  );
}

/** A downscaled JPEG URL for an uploaded image, for feeding the vision model. */
export function imageDerivedUrl(publicId: string, maxEdge = 1024): string {
  ensure();
  return cloudinary.url(publicId, {
    resource_type: 'image',
    format: 'jpg',
    transformation: [{ width: maxEdge, height: maxEdge, crop: 'limit', quality: 82 }],
  });
}

/** Fetch a remote image (e.g. a Cloudinary frame URL) as base64 for the vision model. */
export async function fetchImageAsBase64(
  url: string,
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return { data: buf.toString('base64'), mimeType: res.headers.get('content-type') || 'image/jpeg' };
  } catch (err) {
    logger.warn({ err, url }, 'frame fetch failed');
    return null;
  }
}
