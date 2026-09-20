import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const SUPPORTED_EXTENSIONS = new Set(['.tif', '.tiff', '.jpg', '.jpeg']);

/** Folder created inside each input folder when no output folder is given. */
export const DEFAULT_OUTPUT_FOLDER = 'webp';

export function isSupported(filePath) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Expands files and folders into `{ inputPath, outputPath, outputRoot }` jobs.
 *
 * Folders are walked recursively and filtered to SUPPORTED_EXTENSIONS; files
 * named explicitly are always included. The folder structure beneath each
 * input root is mirrored under `outDir`, or, when none is given, under a
 * DEFAULT_OUTPUT_FOLDER inside that root (next to a file given directly).
 */
export async function collectJobs(inputs, { outDir } = {}) {
  const jobs = new Map();

  for (const input of inputs) {
    const inputPath = path.resolve(input);
    const info = await stat(inputPath);
    const rootDir = info.isDirectory() ? inputPath : path.dirname(inputPath);
    const outputRoot = outDir ? path.resolve(outDir) : path.join(rootDir, DEFAULT_OUTPUT_FOLDER);
    const add = (filePath) =>
      jobs.set(filePath, { inputPath: filePath, outputPath: outputFor(filePath, rootDir, outputRoot), outputRoot });

    if (info.isDirectory()) {
      for await (const filePath of walk(inputPath)) {
        if (isSupported(filePath)) add(filePath);
      }
    } else {
      add(inputPath);
    }
  }

  return disambiguateOutputs([...jobs.values()]);
}

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(entryPath);
    } else if (entry.isFile()) {
      yield entryPath;
    }
  }
}

function outputFor(filePath, rootDir, outputRoot) {
  const relativeDir = path.relative(rootDir, path.dirname(filePath));
  return path.join(outputRoot, relativeDir, `${path.basename(filePath, path.extname(filePath))}.webp`);
}

/**
 * `photo.tif` and `photo.jpg` in the same folder would both become
 * `photo.webp`; such clashes keep their source extension (`photo.tif.webp`).
 */
function disambiguateOutputs(jobs) {
  const claims = new Map();
  for (const job of jobs) {
    claims.set(job.outputPath, (claims.get(job.outputPath) ?? 0) + 1);
  }

  return jobs.map((job) => {
    if (claims.get(job.outputPath) === 1) return job;
    const ext = path.extname(job.inputPath);
    return { ...job, outputPath: job.outputPath.replace(/\.webp$/, `${ext}.webp`) };
  });
}
