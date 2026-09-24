// Diagnostics API stores UTC datetimes without an offset; other ISO values may include one.
export function formatDiagnosticsTime(value: string, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const utcValue = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
  return new Date(utcValue).toLocaleString("ru-RU", { timeZone });
}

export function diagnosticsTimeZoneLabel() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
