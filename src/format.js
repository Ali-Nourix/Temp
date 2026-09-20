export function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

export function formatSavings(before, after) {
  if (before === 0) return '';
  const percent = ((after - before) / before) * 100;
  return `(${percent > 0 ? '+' : ''}${percent.toFixed(1)}%)`;
}

export function formatDuration(ms) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}
