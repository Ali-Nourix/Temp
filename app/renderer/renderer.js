import { formatBytes, formatSavings } from '../../src/format.js';

const el = Object.fromEntries(
  [
    'inputs',
    'pick-folder',
    'pick-files',
    'clear-inputs',
    'out-dir',
    'pick-output',
    'force',
    'quality',
    'quality-value',
    'lossless',
    'max-size',
    'max-size-custom',
    'start',
    'cancel',
    'open-output',
    'message',
    'progress-card',
    'progress-text',
    'progress',
    'summary',
    'log',
  ].map((id) => [id, document.getElementById(id)]),
);

const defaults = await window.api.defaults();
const run = { total: 0, done: 0, outputFolder: null };

function readInputs() {
  return el.inputs.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function addInputs(paths) {
  el.inputs.value = [...new Set([...readInputs(), ...paths])].join('\n');
}

function baseName(filePath) {
  return filePath.split(/[\\/]/).pop();
}

function selectedMaxSize() {
  return Number(el['max-size'].value === 'custom' ? el['max-size-custom'].value : el['max-size'].value);
}

function applyDefaults() {
  el.quality.value = defaults.quality;
  el['quality-value'].value = defaults.quality;

  const preset = [...el['max-size'].options].find((option) => option.value === String(defaults.maxSize));
  el['max-size'].value = preset ? preset.value : 'custom';
  el['max-size-custom'].value = defaults.maxSize;
  el['max-size-custom'].hidden = Boolean(preset);
}

function showMessage(text) {
  el.message.textContent = text;
  el.message.hidden = false;
}

function hideMessage() {
  el.message.hidden = true;
}

function setRunning(running) {
  for (const control of [el.start, el['pick-folder'], el['pick-files'], el['pick-output'], el.inputs, el['out-dir']]) {
    control.disabled = running;
  }
  el.cancel.hidden = !running;
  el.cancel.disabled = false;
  el.cancel.textContent = 'لغو';
}

function resetProgress() {
  run.total = 0;
  run.done = 0;
  run.outputFolder = null;
  el.progress.value = 0;
  el.progress.max = 1;
  el['progress-text'].textContent = '';
  el.summary.textContent = '';
  el.log.replaceChildren();
  el['progress-card'].hidden = false;
  el['open-output'].hidden = true;
}

function describeOutcome(outcome) {
  switch (outcome.status) {
    case 'converted': {
      const { source, output } = outcome;
      return {
        label: 'تبدیل شد',
        detail:
          `${source.width}x${source.height} ${formatBytes(source.bytes)} -> ` +
          `${output.width}x${output.height} ${formatBytes(output.bytes)} ${formatSavings(source.bytes, output.bytes)}`,
      };
    }
    case 'skipped':
      return { label: 'رد شد', detail: `${baseName(outcome.outputPath)} از قبل وجود دارد` };
    default:
      return { label: 'خطا', detail: outcome.reason };
  }
}

function appendLogEntry(outcome) {
  const { label, detail } = describeOutcome(outcome);
  const item = document.createElement('li');
  item.className = outcome.status;

  const status = document.createElement('span');
  status.className = 'status';
  status.textContent = label;

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = baseName(outcome.inputPath);

  const info = document.createElement('span');
  info.className = 'detail';
  info.textContent = detail;

  item.append(status, name, info);
  el.log.append(item);
  item.scrollIntoView({ block: 'nearest' });
}

function describeError(error) {
  switch (error.code) {
    case 'ENOENT':
      return `این مسیر پیدا نشد: ${error.path}`;
    case 'BUSY':
      return 'یک تبدیل هنوز در حال اجراست.';
    case 'RANGE':
      return `تنظیمات نامعتبر است: ${error.message}`;
    default:
      return error.message;
  }
}

/** Keeps a run of numbers and units readable inside right-to-left text. */
function ltr(text) {
  const span = document.createElement('span');
  span.dir = 'ltr';
  span.textContent = text;
  return span;
}

function showSummary(totals) {
  if (run.total === 0) {
    showMessage('در مسیرهای داده‌شده هیچ فایل tif، tiff، jpg یا jpeg پیدا نشد.');
    return;
  }

  const sentences = [];
  if (totals.converted > 0) {
    const sizes =
      `${formatBytes(totals.sourceBytes)} -> ${formatBytes(totals.outputBytes)} ` +
      formatSavings(totals.sourceBytes, totals.outputBytes);
    sentences.push([`${totals.converted} فایل تبدیل شد: `, ltr(sizes)]);
  }
  if (totals.skipped > 0) sentences.push([`${totals.skipped} فایل از قبل موجود بود و رد شد`]);
  if (totals.failed > 0) sentences.push([`${totals.failed} فایل با خطا مواجه شد`]);
  if (totals.cancelled) sentences.push(['عملیات لغو شد']);

  el.summary.replaceChildren(...sentences.flatMap((parts, index) => (index === 0 ? parts : ['. ', ...parts])), '.');
}

async function startConversion() {
  const inputs = readInputs();
  if (inputs.length === 0) {
    showMessage('حداقل یک فایل یا پوشه انتخاب کنید.');
    return;
  }
  const maxSize = selectedMaxSize();
  if (!Number.isInteger(maxSize) || maxSize < 0 || maxSize > defaults.maxDimension) {
    showMessage(`بزرگ‌ترین ضلع باید عددی بین 1 و ${defaults.maxDimension} باشد.`);
    return;
  }

  hideMessage();
  resetProgress();
  setRunning(true);

  const request = {
    inputs,
    outDir: el['out-dir'].value.trim() || null,
    force: el.force.checked,
    conversion: {
      quality: Number(el.quality.value),
      lossless: el.lossless.checked,
      maxSize,
      effort: defaults.effort,
    },
  };

  try {
    const result = await window.api.convert(request);
    if (!result.ok) {
      showMessage(describeError(result.error));
      return;
    }
    run.outputFolder = result.outputFolder;
    showSummary(result.totals);
    el['open-output'].hidden = !run.outputFolder || (result.totals.converted === 0 && result.totals.skipped === 0);
  } catch (error) {
    showMessage(error.message);
  } finally {
    setRunning(false);
  }
}

el['pick-folder'].addEventListener('click', async () => addInputs(await window.api.pickInputs('folder')));
el['pick-files'].addEventListener('click', async () => addInputs(await window.api.pickInputs('files')));
el['clear-inputs'].addEventListener('click', () => {
  el.inputs.value = '';
});
el['pick-output'].addEventListener('click', async () => {
  const folder = await window.api.pickOutput();
  if (folder) el['out-dir'].value = folder;
});

window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => {
  event.preventDefault();
  if (el.inputs.disabled) return;
  addInputs([...event.dataTransfer.files].map((file) => window.api.pathForFile(file)));
});

el.quality.addEventListener('input', () => {
  el['quality-value'].value = el.quality.value;
});
el.lossless.addEventListener('change', () => {
  el.quality.disabled = el.lossless.checked;
});
el['max-size'].addEventListener('change', () => {
  el['max-size-custom'].hidden = el['max-size'].value !== 'custom';
});

el.start.addEventListener('click', startConversion);
el.cancel.addEventListener('click', () => {
  el.cancel.disabled = true;
  el.cancel.textContent = 'در حال لغو…';
  window.api.cancel();
});
el['open-output'].addEventListener('click', () => window.api.openFolder(run.outputFolder));

window.api.onRunStarted(({ total }) => {
  run.total = total;
  el.progress.max = Math.max(total, 1);
  el['progress-text'].textContent = `0 از ${total}`;
});

window.api.onProgress((outcome) => {
  run.done += 1;
  el.progress.value = run.done;
  el['progress-text'].textContent = `${run.done} از ${run.total}`;
  appendLogEntry(outcome);
});

applyDefaults();
