import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __pwaDiagnosticsTest,
  clearPwaDiagnosticsSession,
  configurePwaDiagnosticsDebugState,
  configurePwaDiagnosticsSession,
  emitPwaDiagnostic,
  flushPwaDiagnostics,
  installPwaGlobalErrorHandlers,
  updatePwaDiagnosticsCsrf,
} from "./pwaDiagnostics";

afterEach(() => {
  clearPwaDiagnosticsSession();
  vi.restoreAllMocks();
});

function lastBody(fetchMock: ReturnType<typeof vi.fn>) {
  const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
  return JSON.parse(String(init.body));
}

describe("pwa diagnostics client", () => {
  it("accepts closed events and safe metadata only after CSRF configuration", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    emitPwaDiagnostic("PWA_API_REQUEST_FAILED", { boundary: "api_request", endpoint_group: "jobs", http_status_category: "5xx", duration_ms: 42, retryable: true, error_code: "api_request_failed", token: "synthetic-secret", nested: { unsafe: true } });
    await flushPwaDiagnostics();
    expect(fetchMock).not.toHaveBeenCalled();
    configurePwaDiagnosticsSession({ csrf: "csrf-safe", debugActive: false });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastBody(fetchMock);
    expect(body.events[0]).toEqual({ event_code: "PWA_API_REQUEST_FAILED", metadata: { boundary: "api_request", duration_ms: 42, error_code: "api_request_failed", retryable: true, http_status_category: "5xx", endpoint_group: "jobs" } });
    expect(JSON.stringify(body)).not.toContain("synthetic-secret");
    expect(JSON.stringify(body)).not.toContain("unsafe");
  });

  it("drops unknown codes, Error/Event objects, caps queue at 20 and clears on logout", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    // @ts-expect-error unknown code is intentionally rejected at runtime.
    emitPwaDiagnostic("UNKNOWN", { boundary: "app" });
    emitPwaDiagnostic("PWA_APP_ERROR", new Error("synthetic-message"));
    for (let i = 0; i < 25; i += 1) emitPwaDiagnostic("PWA_APP_ERROR", { boundary: "app", error_code: "app_error", retryable: false }, { dedupe: false });
    configurePwaDiagnosticsSession({ csrf: "csrf-safe", debugActive: false });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastBody(fetchMock);
    expect(body.events).toHaveLength(__pwaDiagnosticsTest.MAX_QUEUE);
    expect(JSON.stringify(body)).not.toContain("synthetic-message");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    clearPwaDiagnosticsSession();
    await flushPwaDiagnostics();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not recursively emit on ingestion failure or log payloads", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ingest failed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);
    configurePwaDiagnosticsSession({ csrf: "csrf-safe", debugActive: false });
    emitPwaDiagnostic("PWA_SERVICE_WORKER_ERROR", { boundary: "service_worker", error_code: "service_worker_error", retryable: true });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("uses DEBUG only for routine events while server-confirmed active and stops after expiry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    configurePwaDiagnosticsSession({ csrf: "csrf-safe", debugActive: true, expiresAt: new Date(Date.now() + 60000).toISOString() });
    emitPwaDiagnostic("PWA_API_REQUEST_FAILED", { boundary: "api_request", error_code: "api_request_failed", retryable: true });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const first = lastBody(fetchMock);
    expect(first.events[0].level).toBe("DEBUG");
    emitPwaDiagnostic("PWA_APP_ERROR", { boundary: "app", error_code: "app_error", retryable: false });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(lastBody(fetchMock).events[0].level).toBeUndefined();
    configurePwaDiagnosticsSession({ csrf: "csrf-safe", debugActive: true, expiresAt: new Date(Date.now() - 1000).toISOString() });
    emitPwaDiagnostic("PWA_API_REQUEST_FAILED", { boundary: "api_request", error_code: "api_request_failed", retryable: true }, { dedupe: false });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(lastBody(fetchMock).events[0].level).toBeUndefined();
  });


  it("rotating CSRF preserves active DEBUG until explicit inactive or expired status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    updatePwaDiagnosticsCsrf("csrf-old");
    configurePwaDiagnosticsDebugState({ active: true, expiresAt: new Date(Date.now() + 60000).toISOString() });
    updatePwaDiagnosticsCsrf("csrf-new");
    emitPwaDiagnostic("PWA_API_REQUEST_FAILED", { boundary: "api_request", error_code: "api_request_failed", retryable: true }, { dedupe: false });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ "x-csrf-token": "csrf-new" });
    expect(lastBody(fetchMock).events[0].level).toBe("DEBUG");

    configurePwaDiagnosticsDebugState({ active: false });
    emitPwaDiagnostic("PWA_API_REQUEST_FAILED", { boundary: "api_request", error_code: "api_request_failed", retryable: true }, { dedupe: false });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(lastBody(fetchMock).events[0].level).toBeUndefined();

    configurePwaDiagnosticsDebugState({ active: true, expiresAt: "not-a-date" });
    emitPwaDiagnostic("PWA_API_REQUEST_FAILED", { boundary: "api_request", error_code: "api_request_failed", retryable: true }, { dedupe: false });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(lastBody(fetchMock).events[0].level).toBeUndefined();
  });

  it("global handlers register once and do not serialize event or rejection reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    configurePwaDiagnosticsSession({ csrf: "csrf-safe", debugActive: false });
    const cleanup = installPwaGlobalErrorHandlers();
    const cleanup2 = installPwaGlobalErrorHandlers();
    window.dispatchEvent(new ErrorEvent("error", { message: "synthetic-raw", filename: "synthetic-file" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const rejection = new Event("unhandledrejection") as Event & { reason: unknown };
    rejection.reason = { raw: "synthetic-reason" };
    window.dispatchEvent(rejection);
    await flushPwaDiagnostics();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("synthetic-raw");
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("synthetic-reason");
    cleanup2();
    cleanup();
  });
});

describe("pwa diagnostics flush draining", () => {
  it("drains events queued during an in-flight request without retrying a failed batch", async () => {
    vi.useFakeTimers();
    let rejectFirst: (() => void) | null = null;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFirst = () => reject(new Error("synthetic-ingest-fail"));
          }),
      )
      .mockResolvedValue(new Response("{}", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    configurePwaDiagnosticsSession({ csrf: "csrf-safe", debugActive: false });
    emitPwaDiagnostic("PWA_APP_ERROR", { boundary: "app", error_code: "app_error", retryable: false }, { dedupe: false });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    emitPwaDiagnostic("PWA_SERVICE_WORKER_ERROR", { boundary: "service_worker", error_code: "service_worker_error", retryable: true }, { dedupe: false });
    rejectFirst?.();
    await vi.runAllTimersAsync();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const first = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    const second = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(first.events[0].event_code).toBe("PWA_APP_ERROR");
    expect(second.events[0].event_code).toBe("PWA_SERVICE_WORKER_ERROR");
    vi.useRealTimers();
  });

  it("clears previous DEBUG authority when expiry is missing, invalid, or expired", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    configurePwaDiagnosticsSession({ csrf: "csrf-safe", debugActive: true, expiresAt: new Date(Date.now() + 60000).toISOString() });
    emitPwaDiagnostic("PWA_API_REQUEST_FAILED", { boundary: "api_request", error_code: "api_request_failed", retryable: true }, { dedupe: false });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lastBody(fetchMock).events[0].level).toBe("DEBUG");

    fetchMock.mockClear();
    for (const expiresAt of [undefined, "not-a-date", new Date(Date.now() - 1000).toISOString()]) {
      configurePwaDiagnosticsSession({ csrf: "csrf-safe", debugActive: true, expiresAt });
      emitPwaDiagnostic("PWA_API_REQUEST_FAILED", { boundary: "api_request", error_code: "api_request_failed", retryable: true }, { dedupe: false });
      await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(0));
      expect(lastBody(fetchMock).events[0].level).toBeUndefined();
      fetchMock.mockClear();
    }
  });
});
