#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULTS, RANGES, WEBP_MAX_DIMENSION } from './convert.js';
import { formatBytes, formatDuration, formatSavings } from './format.js';
import { collectJobs, SUPPORTED_EXTENSIONS } from './jobs.js';
import { runJobs } from './run.js';

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
      maxSize: integerOption(values['max-size'], '--max-size', RANGES.maxSize),
      quality: integerOption(values.quality, '--quality', RANGES.quality),
      effort: integerOption(values.effort, '--effort', RANGES.effort),
      lossless: values.lossless,
    },
  };
}

function integerOption(raw, flag, [min, max]) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new UsageError(`${flag} must be a whole number between ${min} and ${max}, got "${raw}".`);
  }
  return value;
}

function displayPath(filePath) {
  const relative = path.relative(process.cwd(), filePath);
  return relative.startsWith('..') ? filePath : relative;
}

function printResult(outcome) {
  const label = `${displayPath(outcome.inputPath)} -> ${displayPath(outcome.outputPath)}`;
  switch (outcome.status) {
    case 'converted': {
      const { source, output, durationMs } = outcome;
      console.log(
        `OK    ${label}  ${source.width}x${source.height} ${formatBytes(source.bytes)}` +
          ` -> ${output.width}x${output.height} ${formatBytes(output.bytes)}` +
          ` ${formatSavings(source.bytes, output.bytes)}  ${formatDuration(durationMs)}`,
      );
      break;
    }
    case 'skipped':
      console.log(`SKIP  ${label}: ${outcome.reason} (use --force to overwrite)`);
      break;
    default:
      console.error(`FAIL  ${label}: ${outcome.reason}`);
  }
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
  const totals = await runJobs(jobs, { force: args.force, conversion: args.conversion, onResult: printResult });
  printSummary(totals, performance.now() - started);
  return totals.failed > 0 ? 1 : 0;
}

process.exitCode = await main(process.argv.slice(2));
