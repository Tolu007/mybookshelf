// 2.3 MB, 1.42 GB, 15 GB… (binary units, as Google Drive reports them).
export function formatBytes(bytes: number) {
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  if (unit === 0) return `${Math.max(1, Math.round(value))} KB`;
  return `${value >= 100 ? Math.round(value) : Number(value.toFixed(value >= 10 ? 1 : 2))} ${units[unit]}`;
}
