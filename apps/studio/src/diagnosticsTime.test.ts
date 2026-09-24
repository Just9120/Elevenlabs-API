import { describe, expect, it } from "vitest";
import { formatDiagnosticsTime } from "./diagnosticsTime";

describe("diagnostics timestamps", () => {
  it("treats API timestamps without offsets as UTC across a local date boundary", () => {
    expect(formatDiagnosticsTime("2026-09-23T21:08:00", "Europe/Moscow"))
      .toMatch(/24\.09\.2026.*0:08:00/);
    expect(formatDiagnosticsTime("2026-09-23T20:49:00Z", "Europe/Moscow"))
      .toMatch(/23\.09\.2026.*23:49:00/);
  });
});
