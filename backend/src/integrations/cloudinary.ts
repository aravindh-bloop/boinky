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
