import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { assertValidOptions, DEFAULTS, WEBP_MAX_DIMENSION } from '../src/convert.js';
import { collectJobs, SUPPORTED_EXTENSIONS } from '../src/jobs.js';
import { runJobs } from '../src/run.js';

const appDir = path.dirname(fileURLToPath(import.meta.url));

/** AbortController of the conversion in progress, if any. */
let activeRun = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 780,
    height: 760,
    minWidth: 640,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(appDir, 'preload.cjs') },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('closed', () => activeRun?.abort());
  win.loadFile(path.join(appDir, 'renderer', 'index.html'));
}

function failure(code, message, filePath) {
  return { ok: false, error: { code, message, path: filePath } };
}

function sendTo(webContents, channel, payload) {
  if (!webContents.isDestroyed()) webContents.send(channel, payload);
}

ipcMain.handle('defaults', () => ({ ...DEFAULTS, maxDimension: WEBP_MAX_DIMENSION }));

ipcMain.handle('pick-inputs', async (event, kind) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    properties: kind === 'folder' ? ['openDirectory'] : ['openFile', 'multiSelections'],
    filters:
      kind === 'folder'
        ? []
        : [{ name: 'Images', extensions: [...SUPPORTED_EXTENSIONS].map((ext) => ext.slice(1)) }],
  });
  return canceled ? [] : filePaths;
});

ipcMain.handle('pick-output', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    properties: ['openDirectory', 'createDirectory'],
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('convert', async (event, { inputs, outDir, force, conversion }) => {
  if (activeRun) return failure('BUSY');

  try {
    assertValidOptions({ ...DEFAULTS, ...conversion });
  } catch (error) {
    return failure('RANGE', error.message);
  }

  let jobs;
  try {
    jobs = await collectJobs(inputs, { outDir: outDir || undefined });
  } catch (error) {
    return failure(error.code === 'ENOENT' ? 'ENOENT' : 'UNKNOWN', error.message, error.path);
  }

  sendTo(event.sender, 'run-started', { total: jobs.length });
  activeRun = new AbortController();
  try {
    const totals = await runJobs(jobs, {
      force,
      conversion,
      signal: activeRun.signal,
      onResult: (outcome) => sendTo(event.sender, 'run-progress', outcome),
    });
    const outputFolder = outDir || (jobs.length > 0 ? path.dirname(jobs[0].outputPath) : null);
    return { ok: true, totals, outputFolder };
  } finally {
    activeRun = null;
  }
});

ipcMain.handle('cancel', () => {
  activeRun?.abort();
});

ipcMain.handle('open-folder', (event, folder) => shell.openPath(folder));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
