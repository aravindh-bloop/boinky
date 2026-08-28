import sharp from 'sharp';

export interface PreparedImage {
  buffer: Buffer;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
}

/**
 * Normalise a phone photo for the vision model: honour EXIF orientation, cap the
 * longest edge, re-encode as JPEG. Smaller payloads noticeably cut Gemini latency
 * and cost without hurting diagnostic accuracy at this resolution.
 */
export async function downscaleForVision(
  input: Buffer,
  maxEdge = 1024,
): Promise<PreparedImage> {
  const pipeline = sharp(input, { failOn: 'none' })
    .rotate()
    .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { buffer: data, mimeType: 'image/jpeg', width: info.width, height: info.height };
}
