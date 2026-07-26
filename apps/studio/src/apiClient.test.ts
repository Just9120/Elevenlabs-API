import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, mutateWithCsrfRetry } from "./apiClient";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
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
});
