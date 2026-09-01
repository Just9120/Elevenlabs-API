import { describe, expect, it, vi } from "vitest";
import { isTraceId, newTraceId, traceHeaderRecord, withTraceHeader } from "./traceId";

describe("browser trace context", () => {
  it("creates a bounded opaque trace id without persistence", () => {
    vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint8Array).fill(0xab);
      return array;
    });
    const trace = newTraceId();
    expect(trace).toBe(`trace_${"ab".repeat(16)}`);
    expect(isTraceId(trace)).toBe(true);
    expect(isTraceId("raw-user-content")).toBe(false);
  });

  it("preserves existing header spelling and valid caller trace", () => {
    const trace = "trace_0123456789abcdef";
    const result = withTraceHeader({
      headers: { "Idempotency-Key": "stable-key", "X-Trace-ID": trace },
    });
    expect(result.headers).toEqual({
      "Idempotency-Key": "stable-key",
      "X-Trace-ID": trace,
    });
    expect(traceHeaderRecord(result.headers)).toEqual(result.headers);
  });

  it("replaces malformed trace input without changing other headers", () => {
    const result = withTraceHeader({
      headers: { Authorization: "test", "X-Trace-ID": "invalid" },
    });
    const headers = traceHeaderRecord(result.headers);
    expect(headers.Authorization).toBe("test");
    expect(isTraceId(headers["X-Trace-ID"])).toBe(true);
    expect(headers["x-trace-id"]).toBeUndefined();
  });

  it("replaces a malformed tuple trace without creating a duplicate", () => {
    const result = withTraceHeader({
      headers: [["X-Trace-ID", "invalid"], ["Accept", "application/json"]],
    });
    const headers = result.headers as [string, string][];
    expect(headers.filter(([name]) => name.toLowerCase() === "x-trace-id")).toHaveLength(1);
    expect(isTraceId(headers[0][1])).toBe(true);
  });
});
