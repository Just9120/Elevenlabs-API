import { afterEach, describe, expect, it, vi } from "vitest";
import { emitPwaDiagnostic } from "./pwaDiagnostics";
import { ApiError, api, mutateWithCsrfRetry } from "./apiClient";

vi.mock("./pwaDiagnostics", () => ({ emitPwaDiagnostic: vi.fn() }));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CSRF mutation retry contract", () => {
  it("refreshes once only for the server-classified stale CSRF reason", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({ detail: { reason: "csrf_token_invalid" } }, 403),
      )
      .mockResolvedValueOnce(json({ csrf_token: "csrf-new" }))
      .mockResolvedValueOnce(json({ ok: true }));
    const onCsrf = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      mutateWithCsrfRetry("/projects", "csrf-old", onCsrf, {
        method: "POST",
      }),
    ).resolves.toEqual({ ok: true });
    expect(onCsrf).toHaveBeenCalledWith("csrf-new");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([401, 403, 419])(
    "does not refresh or replay an unclassified HTTP %s",
    async (status) => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        json({ detail: "ordinary authorization failure" }, status),
      );
      const onCsrf = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        mutateWithCsrfRetry("/projects", "csrf-old", onCsrf, {
          method: "POST",
        }),
      ).rejects.toBeInstanceOf(ApiError);
      expect(onCsrf).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("uses the mutation abort signal for CSRF refresh and never replays after abort", async () => {
    const controller = new AbortController();
    const timeoutReason = Symbol("mutation_timeout");
    let refreshSignal: AbortSignal | undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({ detail: { reason: "csrf_token_invalid" } }, 403),
      )
      .mockImplementationOnce((_url: string, init?: RequestInit) => {
        refreshSignal = init?.signal;
        return new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          ),
        );
      });
    const onCsrf = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const pending = mutateWithCsrfRetry("/jobs/job-1/retry", "csrf-old", onCsrf, {
      method: "POST",
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    controller.abort(timeoutReason);

    await expect(pending).rejects.toBe(timeoutReason);
    expect(refreshSignal).toBe(controller.signal);
    expect(onCsrf).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });});
describe("API abort diagnostics", () => {
  it("suppresses only the explicitly ignored abort reason", async () => {
    const ignoredReason = Symbol("expected_abort");
    const controller = new AbortController();
    const abortError = new DOMException("aborted", "AbortError");
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal("fetch", fetchMock);
    controller.abort(ignoredReason);

    await expect(
      api("/projects/p1/jobs/progress", {
        signal: controller.signal,
        ignoredAbortReason: ignoredReason,
      }),
    ).rejects.toBe(abortError);

    expect(emitPwaDiagnostic).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty(
      "ignoredAbortReason",
    );
  });

  it("keeps unexpected and timeout aborts observable", async () => {
    const controller = new AbortController();
    const abortError = new DOMException("timeout", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));
    controller.abort();

    await expect(
      api("/projects/p1/jobs/progress", {
        signal: controller.signal,
        ignoredAbortReason: Symbol("different_abort"),
      }),
    ).rejects.toBe(abortError);

    expect(emitPwaDiagnostic).toHaveBeenCalledWith(
      "PWA_API_REQUEST_FAILED",
      expect.objectContaining({
        boundary: "api_request",
        endpoint_group: "projects",
        retryable: true,
      }),
    );
  });
});
