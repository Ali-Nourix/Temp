import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectJobs, isSupported } from '../src/jobs.js';

let root;
let inDir;

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'webp-jobs-'));
  inDir = path.join(root, 'in');
  await mkdir(path.join(inDir, 'sub'), { recursive: true });
  for (const name of ['a.tif', 'sub/b.JPG', 'sub/c.png', 'd.webp', 'notes.txt', 'twin.jpg', 'twin.tif']) {
    await writeFile(path.join(inDir, name), '');
  }
});

after(() => rm(root, { recursive: true, force: true }));

const relativePairs = (jobs) =>
  jobs.map(({ inputPath, outputPath }) => [path.relative(root, inputPath), path.relative(root, outputPath)]);

test('isSupported matches TIFF and JPEG extensions case-insensitively', () => {
  assert.ok(isSupported('scan.TIFF'));
  assert.ok(isSupported('photo.jpeg'));
  assert.ok(!isSupported('image.png'));
  assert.ok(!isSupported('done.webp'));
});

test('walks folders recursively, filters by extension and writes next to the source', async () => {
  const jobs = await collectJobs([inDir]);
  assert.deepEqual(relativePairs(jobs), [
    ['in/a.tif', 'in/a.webp'],
    ['in/sub/b.JPG', 'in/sub/b.webp'],
    ['in/twin.jpg', 'in/twin.jpg.webp'],
    ['in/twin.tif', 'in/twin.tif.webp'],
  ]);
});

test('mirrors the folder structure under outDir', async () => {
  const jobs = await collectJobs([inDir], { outDir: path.join(root, 'out') });
  assert.deepEqual(relativePairs(jobs), [
    ['in/a.tif', 'out/a.webp'],
    ['in/sub/b.JPG', 'out/sub/b.webp'],
    ['in/twin.jpg', 'out/twin.jpg.webp'],
    ['in/twin.tif', 'out/twin.tif.webp'],
  ]);
});

test('an explicit file lands directly in outDir regardless of its extension', async () => {
  const jobs = await collectJobs([path.join(inDir, 'sub/c.png')], { outDir: path.join(root, 'out') });
  assert.deepEqual(relativePairs(jobs), [['in/sub/c.png', 'out/c.webp']]);
});

test('the same file given twice is converted once', async () => {
  const file = path.join(inDir, 'a.tif');
  const jobs = await collectJobs([file, file, inDir]);
  assert.equal(jobs.filter((job) => job.inputPath === file).length, 1);
});
