import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const SUPPORTED_EXTENSIONS = new Set(['.tif', '.tiff', '.jpg', '.jpeg']);

export function isSupported(filePath) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Expands files and folders into `{ inputPath, outputPath }` jobs.
 *
 * Folders are walked recursively and filtered to SUPPORTED_EXTENSIONS; files
 * named explicitly are always included. Outputs land next to their source
 * unless `outDir` is given, in which case the folder structure beneath each
 * input root is mirrored under `outDir`.
 */
export async function collectJobs(inputs, { outDir } = {}) {
  const jobs = new Map();

  for (const input of inputs) {
    const inputPath = path.resolve(input);
    const info = await stat(inputPath);

    if (info.isDirectory()) {
      for await (const filePath of walk(inputPath)) {
        if (isSupported(filePath)) {
          jobs.set(filePath, { inputPath: filePath, outputPath: outputFor(filePath, inputPath, outDir) });
        }
      }
    } else {
      jobs.set(inputPath, { inputPath, outputPath: outputFor(inputPath, path.dirname(inputPath), outDir) });
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

function outputFor(filePath, rootDir, outDir) {
  const sourceDir = path.dirname(filePath);
  const targetDir = outDir ? path.join(path.resolve(outDir), path.relative(rootDir, sourceDir)) : sourceDir;
  return path.join(targetDir, `${path.basename(filePath, path.extname(filePath))}.webp`);
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
