export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function formatBytes(bytes) {
  const safe = Math.max(0, Number(bytes) || 0);
  if (safe < 1024) return `${Math.round(safe)} B`;
  if (safe < 1024 ** 2) return `${trimNumber(safe / 1024)} KB`;
  if (safe < 1024 ** 3) return `${trimNumber(safe / 1024 ** 2)} MB`;
  return `${trimNumber(safe / 1024 ** 3)} GB`;
}

export function formatPercent(value, digits = 1) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${(safe * 100).toFixed(digits)}%`;
}

export function formatInteger(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

export function trimNumber(value, digits = 1) {
  return Number(value.toFixed(digits)).toString();
}
