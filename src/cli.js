#!/usr/bin/env node
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { convertToWebp, DEFAULTS, WEBP_MAX_DIMENSION } from './convert.js';
import { collectJobs, SUPPORTED_EXTENSIONS } from './jobs.js';

const USAGE = `Usage: webp-convert [options] <file or folder>...

Converts large TIFF/JPEG images into high-quality WebP files for the web.
Folders are searched recursively for ${[...SUPPORTED_EXTENSIONS].join(' ')} files;
files named explicitly are converted whatever their extension.

Options:
  -o, --out <dir>       Write outputs under <dir>, mirroring the input folder
                        structure. Default: next to each source file.
  -s, --max-size <px>   Longest edge of the output in pixels (default ${DEFAULTS.maxSize}).
                        Images are never enlarged. 0 keeps the original size,
                        capped at the WebP limit of ${WEBP_MAX_DIMENSION} px.
  -q, --quality <n>     WebP quality 1-100 (default ${DEFAULTS.quality}).
  -e, --effort <n>      Compression effort 0-6 (default ${DEFAULTS.effort}; 6 gives the
                        smallest files and is the slowest).
      --lossless        Lossless WebP. Files get much larger; meant for
                        graphics and line art, not photos.
  -f, --force           Overwrite existing .webp files instead of skipping them.
  -h, --help            Show this help.
`;

class UsageError extends Error {}

function parseCommandLine(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      'max-size': { type: 'string', short: 's', default: String(DEFAULTS.maxSize) },
      quality: { type: 'string', short: 'q', default: String(DEFAULTS.quality) },
      effort: { type: 'string', short: 'e', default: String(DEFAULTS.effort) },
      lossless: { type: 'boolean', default: DEFAULTS.lossless },
      force: { type: 'boolean', short: 'f', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) return { help: true };
  if (positionals.length === 0) throw new UsageError('No input files or folders given.');

  return {
    help: false,
    inputs: positionals,
    outDir: values.out,
    force: values.force,
    conversion: {
      maxSize: integerOption(values['max-size'], '--max-size', 0, WEBP_MAX_DIMENSION),
      quality: integerOption(values.quality, '--quality', 1, 100),
      effort: integerOption(values.effort, '--effort', 0, 6),
      lossless: values.lossless,
    },
  };
}

function integerOption(raw, name, min, max) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new UsageError(`${name} must be a whole number between ${min} and ${max}, got "${raw}".`);
  }
  return value;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function displayPath(filePath) {
  const relative = path.relative(process.cwd(), filePath);
  return relative.startsWith('..') ? filePath : relative;
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

function formatSavings(before, after) {
  if (before === 0) return '';
  const percent = ((after - before) / before) * 100;
  return `(${percent > 0 ? '+' : ''}${percent.toFixed(1)}%)`;
}

function formatDuration(ms) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

async function runJobs(jobs, { force, conversion }) {
  const totals = { converted: 0, skipped: 0, failed: 0, sourceBytes: 0, outputBytes: 0 };

  for (const { inputPath, outputPath } of jobs) {
    const label = `${displayPath(inputPath)} -> ${displayPath(outputPath)}`;

    if (outputPath === inputPath) {
      totals.failed += 1;
      console.error(`FAIL  ${label}: output would overwrite the input`);
      continue;
    }
    if (!force && (await exists(outputPath))) {
      totals.skipped += 1;
      console.log(`SKIP  ${label}: already exists (use --force to overwrite)`);
      continue;
    }

    const started = performance.now();
    try {
      await mkdir(path.dirname(outputPath), { recursive: true });
      const { source, output } = await convertToWebp(inputPath, outputPath, conversion);
      totals.converted += 1;
      totals.sourceBytes += source.bytes;
      totals.outputBytes += output.bytes;
      console.log(
        `OK    ${label}  ${source.width}x${source.height} ${formatBytes(source.bytes)}` +
          ` -> ${output.width}x${output.height} ${formatBytes(output.bytes)}` +
          ` ${formatSavings(source.bytes, output.bytes)}  ${formatDuration(performance.now() - started)}`,
      );
    } catch (error) {
      totals.failed += 1;
      console.error(`FAIL  ${label}: ${error.message}`);
    }
  }

  return totals;
}

function printSummary(totals, elapsedMs) {
  const parts = [`Converted ${totals.converted}`];
  if (totals.converted > 0) {
    parts.push(
      `${formatBytes(totals.sourceBytes)} -> ${formatBytes(totals.outputBytes)}` +
        ` ${formatSavings(totals.sourceBytes, totals.outputBytes)}`,
    );
  }
  if (totals.skipped > 0) parts.push(`skipped ${totals.skipped}`);
  if (totals.failed > 0) parts.push(`failed ${totals.failed}`);
  console.log(`\n${parts.join(', ')} in ${formatDuration(elapsedMs)}`);
}

async function main(argv) {
  let args;
  try {
    args = parseCommandLine(argv);
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    return 2;
  }
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  let jobs;
  try {
    jobs = await collectJobs(args.inputs, { outDir: args.outDir });
  } catch (error) {
    console.error(error.code === 'ENOENT' ? `No such file or folder: ${error.path}` : error.message);
    return 2;
  }
  if (jobs.length === 0) {
    console.log(`No ${[...SUPPORTED_EXTENSIONS].join('/')} files found.`);
    return 0;
  }

  const started = performance.now();
  const totals = await runJobs(jobs, args);
  printSummary(totals, performance.now() - started);
  return totals.failed > 0 ? 1 : 0;
}

process.exitCode = await main(process.argv.slice(2));
