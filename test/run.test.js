import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { runJobs } from '../src/run.js';

let dir;

before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'webp-run-'));
});

after(() => rm(dir, { recursive: true, force: true }));

async function imageJob(name) {
  const inputPath = path.join(dir, name);
  await sharp({ create: { width: 300, height: 200, channels: 3, background: '#336699' } }).toFile(inputPath);
  return { inputPath, outputPath: path.join(dir, 'out', `${path.parse(name).name}.webp`) };
}

test('converts each job, reports it and sums the byte counts', async () => {
  const jobs = [await imageJob('one.jpg'), await imageJob('two.jpg')];
  const seen = [];
  const totals = await runJobs(jobs, { conversion: { maxSize: 150 }, onResult: (outcome) => seen.push(outcome) });

  assert.equal(totals.converted, 2);
  assert.equal(totals.failed, 0);
  assert.ok(totals.sourceBytes > 0 && totals.outputBytes > 0);
  assert.deepEqual(
    seen.map((o) => [o.status, o.output.width, o.output.height]),
    [
      ['converted', 150, 100],
      ['converted', 150, 100],
    ],
  );
});

test('skips an existing output unless force is set', async () => {
  const job = await imageJob('existing.jpg');
  await runJobs([job]);

  const skipped = await runJobs([job]);
  assert.deepEqual([skipped.skipped, skipped.converted], [1, 0]);

  const forced = await runJobs([job], { force: true });
  assert.deepEqual([forced.skipped, forced.converted], [0, 1]);
});

test('refuses to overwrite the input and reports unreadable files as failed', async () => {
  const notAnImage = path.join(dir, 'broken.tif');
  await writeFile(notAnImage, 'definitely not a tiff');
  const jobs = [
    { inputPath: notAnImage, outputPath: notAnImage },
    { inputPath: notAnImage, outputPath: path.join(dir, 'broken.webp') },
  ];
  const seen = [];
  const totals = await runJobs(jobs, { onResult: (outcome) => seen.push(outcome) });

  assert.equal(totals.failed, 2);
  assert.equal(seen[0].reason, 'output would overwrite the input');
  assert.ok(seen[1].reason.length > 0);
});

test('stops before the next job once the signal is aborted', async () => {
  const jobs = [await imageJob('a.jpg'), await imageJob('b.jpg'), await imageJob('c.jpg')];
  const controller = new AbortController();
  const totals = await runJobs(jobs, { signal: controller.signal, onResult: () => controller.abort() });

  assert.equal(totals.converted, 1);
  assert.equal(totals.cancelled, true);
});
