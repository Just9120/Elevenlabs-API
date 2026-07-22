export function formatBytes(value: number | null) {
  if (value == null) return "не указан";
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

export function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString("ru-RU") : "—";
}

export function retentionOptionLabel(seconds: number) {
  const labels: Record<number, string> = {
    3600: "1 час",
    86400: "24 часа",
    259200: "3 дня",
    604800: "7 дней",
    2592000: "30 дней",
  };
  return labels[seconds] ?? `${seconds} сек.`;
}

export function formatUploadLimit(value: number) {
  const mebibytes = value / 1024 / 1024;
  if (mebibytes >= 1)
    return `${Number.isInteger(mebibytes) ? mebibytes : mebibytes.toFixed(1)} МБ`;
  const kibibytes = value / 1024;
  if (kibibytes >= 1)
    return `${Number.isInteger(kibibytes) ? kibibytes : kibibytes.toFixed(1)} КБ`;
  return `${value} байт`;
}
