import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { convertToWebp, targetEdge, WEBP_MAX_DIMENSION } from '../src/convert.js';

let dir;

before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'webp-convert-'));
});

after(() => rm(dir, { recursive: true, force: true }));

function blank(width, height) {
  return sharp({ create: { width, height, channels: 3, background: '#6a8caf' } });
}

async function fixture(name, image) {
  const file = path.join(dir, name);
  await image.toFile(file);
  return file;
}

async function convert(input, options) {
  const output = `${input}.out.webp`;
  const result = await convertToWebp(input, output, options);
  return { result, meta: await sharp(output).metadata() };
}

test('targetEdge caps at the WebP limit and treats 0 as "no downscale"', () => {
  assert.equal(targetEdge(3840), 3840);
  assert.equal(targetEdge(0), WEBP_MAX_DIMENSION);
  assert.equal(targetEdge(WEBP_MAX_DIMENSION + 1), WEBP_MAX_DIMENSION);
});

test('downscales to the longest edge and keeps the aspect ratio', async () => {
  const input = await fixture('large.jpg', blank(6000, 4000));
  const { result, meta } = await convert(input, { maxSize: 1200 });

  assert.equal(meta.format, 'webp');
  assert.deepEqual([meta.width, meta.height], [1200, 800]);
  assert.deepEqual([result.source.width, result.source.height], [6000, 4000]);
  assert.deepEqual([result.output.width, result.output.height], [1200, 800]);
  assert.ok(result.output.bytes < result.source.bytes);
});

test('never enlarges a small image', async () => {
  const input = await fixture('small.jpg', blank(500, 300));
  const { meta } = await convert(input, { maxSize: 3840 });
  assert.deepEqual([meta.width, meta.height], [500, 300]);
});

test('respects the WebP dimension limit when maxSize is 0', async () => {
  const input = await fixture('wide.jpg', blank(17000, 100));
  const { meta } = await convert(input, { maxSize: 0 });
  assert.equal(meta.width, WEBP_MAX_DIMENSION);
  assert.ok(meta.height < 100);
});

test('applies the EXIF orientation to the pixels', async () => {
  const input = await fixture('rotated.jpg', blank(800, 400).withMetadata({ orientation: 6 }));
  const { meta } = await convert(input, { maxSize: 0 });
  assert.deepEqual([meta.width, meta.height], [400, 800]);
  assert.equal(meta.orientation, undefined);
});

test('converts a CMYK TIFF to 8-bit sRGB', async () => {
  const input = await fixture('cmyk.tif', blank(400, 300).toColourspace('cmyk'));
  const { meta } = await convert(input);
  assert.equal(meta.space, 'srgb');
  assert.equal(meta.channels, 3);
  assert.equal(meta.depth, 'uchar');
});

test('converts a 16-bit TIFF to 8-bit', async () => {
  const input = await fixture('deep.tif', blank(400, 300).toColourspace('rgb16'));
  const { meta } = await convert(input);
  assert.equal(meta.depth, 'uchar');
  assert.deepEqual([meta.width, meta.height], [400, 300]);
});

test('lossless output reproduces the source pixels exactly', async () => {
  const noise = sharp({
    create: { width: 64, height: 64, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 40 } },
  });
  const input = await fixture('noise.tif', noise);
  const output = `${input}.out.webp`;
  await convertToWebp(input, output, { lossless: true, maxSize: 0 });

  const [expected, actual] = await Promise.all([sharp(input).raw().toBuffer(), sharp(output).raw().toBuffer()]);
  assert.ok(expected.equals(actual));
});
