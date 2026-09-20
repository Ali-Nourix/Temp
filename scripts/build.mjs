#!/usr/bin/env node
import { execFileSync, execSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZipArchive } from 'archiver';

/**
 * Platforms that get a native libvips binary in the release. Anything else
 * (e.g. Windows on ARM) runs on the WebAssembly build that sharp installs
 * unconditionally.
 */
const TARGETS = [
  { os: 'win32', cpu: 'x64' },
  { os: 'darwin', cpu: 'arm64' },
  { os: 'darwin', cpu: 'x64' },
  { os: 'linux', cpu: 'x64' },
];

const NPM_FLAGS = ['--omit=dev', '--no-package-lock', '--no-fund', '--no-audit', '--loglevel=error'];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const distDir = path.join(root, 'dist');
const stageDir = path.join(distDir, pkg.name);
const zipPath = path.join(distDir, `${pkg.name}-${pkg.version}.zip`);

function npm(args, cwd) {
  // Under `npm run` reuse the running npm; it avoids PATH and .cmd lookup issues on Windows.
  const npmCli = process.env.npm_execpath;
  if (npmCli) {
    execFileSync(process.execPath, [npmCli, ...args], { cwd, stdio: 'inherit' });
  } else {
    execSync(`npm ${args.join(' ')}`, { cwd, stdio: 'inherit' });
  }
}

async function stageSources() {
  await cp(path.join(root, 'src'), path.join(stageDir, 'src'), { recursive: true });
  for (const file of ['README.md', 'LICENSE']) {
    await cp(path.join(root, file), path.join(stageDir, file));
  }

  const { scripts, devDependencies, ...releasePackage } = pkg;
  await writeFile(path.join(stageDir, 'package.json'), `${JSON.stringify(releasePackage, null, 2)}\n`);

  await writeFile(path.join(stageDir, `${pkg.name}.cmd`), '@echo off\r\nnode "%~dp0src\\cli.js" %*\r\n');
  await writeFile(path.join(stageDir, pkg.name), '#!/bin/sh\nexec node "$(dirname "$0")/src/cli.js" "$@"\n', {
    mode: 0o755,
  });
}

function installDependencies() {
  npm(['install', ...NPM_FLAGS], stageDir);
  for (const { os, cpu } of TARGETS) {
    console.log(`Adding sharp binaries for ${os}-${cpu}`);
    npm(['install', ...NPM_FLAGS, `--os=${os}`, `--cpu=${cpu}`, 'sharp'], stageDir);
  }
}

function zipDirectory(sourceDir, destination, folderName) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(destination);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', () => resolve(archive.pointer()));
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, folderName);
    archive.finalize();
  });
}

await rm(distDir, { recursive: true, force: true });
await mkdir(stageDir, { recursive: true });

console.log(`Staging ${pkg.name} ${pkg.version} in ${path.relative(root, stageDir)}`);
await stageSources();
installDependencies();

const bytes = await zipDirectory(stageDir, zipPath, pkg.name);
console.log(`Wrote ${path.relative(root, zipPath)} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
