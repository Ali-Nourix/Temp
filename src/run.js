import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { convertToWebp } from './convert.js';

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runJob({ inputPath, outputPath }, { force, conversion }) {
  if (outputPath === inputPath) {
    return { inputPath, outputPath, status: 'failed', reason: 'output would overwrite the input' };
  }
  if (!force && (await exists(outputPath))) {
    return { inputPath, outputPath, status: 'skipped', reason: 'already exists' };
  }

  const started = performance.now();
  try {
    await mkdir(path.dirname(outputPath), { recursive: true });
    const { source, output } = await convertToWebp(inputPath, outputPath, conversion);
    return { inputPath, outputPath, status: 'converted', source, output, durationMs: performance.now() - started };
  } catch (error) {
    return { inputPath, outputPath, status: 'failed', reason: error.message };
  }
}

/**
 * Converts jobs one after another (libvips already spreads each image over
 * every core) and reports each outcome through `onResult`. Aborting `signal`
 * stops before the next job; the one in flight still finishes.
 */
export async function runJobs(jobs, { force = false, conversion = {}, signal, onResult = () => {} } = {}) {
  const totals = { converted: 0, skipped: 0, failed: 0, sourceBytes: 0, outputBytes: 0, cancelled: false };

  for (const job of jobs) {
    if (signal?.aborted) {
      totals.cancelled = true;
      break;
    }

    const outcome = await runJob(job, { force, conversion });
    totals[outcome.status] += 1;
    if (outcome.status === 'converted') {
      totals.sourceBytes += outcome.source.bytes;
      totals.outputBytes += outcome.output.bytes;
    }
    onResult(outcome);
  }

  return totals;
}
