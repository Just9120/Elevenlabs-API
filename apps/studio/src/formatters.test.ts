import {
  formatBytes,
  formatTime,
  formatUploadLimit,
  retentionOptionLabel,
} from "./formatters";

describe("Studio formatters", () => {
  it.each([
    [null, "не указан"],
    [0, "0.00 MB"],
    [1024 * 1024, "1.00 MB"],
    [1536 * 1024, "1.50 MB"],
  ] as const)("formats byte count %s", (value, expected) => {
    expect(formatBytes(value)).toBe(expected);
  });

  it("formats timestamps with the Russian locale and keeps absent values explicit", () => {
    const value = "2026-07-22T10:00:00Z";

    expect(formatTime(null)).toBe("—");
    expect(formatTime(value)).toBe(new Date(value).toLocaleString("ru-RU"));
  });

  it.each([
    [3600, "1 час"],
    [86400, "24 часа"],
    [259200, "3 дня"],
    [604800, "7 дней"],
    [2592000, "30 дней"],
    [42, "42 сек."],
  ] as const)("labels retention option %s", (seconds, expected) => {
    expect(retentionOptionLabel(seconds)).toBe(expected);
  });

  it.each([
    [512, "512 байт"],
    [1024, "1 КБ"],
    [1536, "1.5 КБ"],
    [1024 * 1024, "1 МБ"],
    [1.5 * 1024 * 1024, "1.5 МБ"],
  ] as const)("formats upload limit %s", (value, expected) => {
    expect(formatUploadLimit(value)).toBe(expected);
  });
});
