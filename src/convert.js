import { stat } from 'node:fs/promises';
import sharp from 'sharp';

/** Hard limit of the WebP format; nothing wider or taller can be encoded. */
export const WEBP_MAX_DIMENSION = 16383;

export const DEFAULTS = Object.freeze({
  maxSize: 3840,
  quality: 100,
  effort: 6,
  lossless: false,
});

export const RANGES = Object.freeze({
  maxSize: [0, WEBP_MAX_DIMENSION],
  quality: [1, 100],
  effort: [0, 6],
});

/** Throws a RangeError naming the first numeric option outside its range. */
export function assertValidOptions(options) {
  for (const [name, [min, max]] of Object.entries(RANGES)) {
    const value = options[name];
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new RangeError(`${name} must be a whole number between ${min} and ${max}, got ${value}`);
    }
  }
}

/**
 * Longest edge the output may have. A maxSize of 0 means "keep the original
 * size", which the WebP limit still caps.
 */
export function targetEdge(maxSize) {
  return maxSize > 0 ? Math.min(maxSize, WEBP_MAX_DIMENSION) : WEBP_MAX_DIMENSION;
}

/**
 * Converts one image to WebP: applies EXIF orientation, downscales so the
 * longest edge fits `maxSize` (never enlarges), converts CMYK/16-bit/ICC
 * sources to 8-bit sRGB, and drops metadata.
 */
export async function convertToWebp(inputPath, outputPath, options = {}) {
  const settings = { ...DEFAULTS, ...options };
  assertValidOptions(settings);
  const { maxSize, quality, effort, lossless } = settings;
  const edge = targetEdge(maxSize);

  // Gigapixel-class scans exceed sharp's default pixel limit. libvips streams
  // them strip by strip, so lifting the limit does not load them whole.
  const image = sharp(inputPath, { limitInputPixels: false });
  const [source, sourceFile] = await Promise.all([image.metadata(), stat(inputPath)]);

  const output = await image
    .autoOrient()
    .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort, lossless, smartSubsample: true })
    .toFile(outputPath);

  return {
    source: { width: source.width, height: source.height, bytes: sourceFile.size },
    output: { width: output.width, height: output.height, bytes: output.size },
  };
}
