import { describe, expect, it, vi } from "vitest";

import {
  cancelLatestRequests,
  LATEST_REQUEST_CANCEL_REASON,
  settleLatestRequest,
} from "./latestRequest";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("latest request ordering", () => {
  it("ignores an older success that settles after a newer request", async () => {
    const epochs = new Map<string, number>();
    const older = deferred<string>();
    const newer = deferred<string>();
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    const olderRun = settleLatestRequest(
      epochs,
      "jobs:project-1",
      () => older.promise,
      onSuccess,
      onFailure,
    );
    const newerRun = settleLatestRequest(
      epochs,
      "jobs:project-1",
      () => newer.promise,
      onSuccess,
      onFailure,
    );

    newer.resolve("fresh");
    await expect(newerRun).resolves.toBe(true);
    older.resolve("stale");
    await expect(olderRun).resolves.toBe(false);

    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledWith("fresh");
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("ignores a stale failure but surfaces the latest failure", async () => {
    const epochs = new Map<string, number>();
    const older = deferred<string>();
    const newer = deferred<string>();
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    const olderRun = settleLatestRequest(
      epochs,
      "sources:project-1",
      () => older.promise,
      onSuccess,
      onFailure,
    );
    const newerRun = settleLatestRequest(
      epochs,
      "sources:project-1",
      () => newer.promise,
      onSuccess,
      onFailure,
    );

    older.reject(new Error("stale failure"));
    await expect(olderRun).resolves.toBe(false);
    expect(onFailure).not.toHaveBeenCalled();

    const latestError = new Error("latest failure");
    newer.reject(latestError);
    await expect(newerRun).resolves.toBe(true);
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledWith(latestError);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("tracks independent request keys separately", async () => {
    const epochs = new Map<string, number>();
    const onSuccess = vi.fn();

    await Promise.all([
      settleLatestRequest(
        epochs,
        "jobs:project-1",
        async () => "jobs",
        onSuccess,
        vi.fn(),
      ),
      settleLatestRequest(
        epochs,
        "sources:project-1",
        async () => "sources",
        onSuccess,
        vi.fn(),
      ),
    ]);

    expect(onSuccess).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledWith("jobs");
    expect(onSuccess).toHaveBeenCalledWith("sources");
  });

  it("aborts a superseded request and keeps only the newer result", async () => {
    const epochs = new Map<string, number>();
    const controllers = new Map<string, AbortController>();
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    let olderSignal: AbortSignal | undefined;

    const olderRun = settleLatestRequest(
      epochs,
      "detail:job-1",
      (signal) => {
        olderSignal = signal;
        return new Promise<string>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason));
        });
      },
      onSuccess,
      onFailure,
      { controllers, timeoutMs: 15_000 },
    );
    const newerRun = settleLatestRequest(
      epochs,
      "detail:job-1",
      async () => "fresh",
      onSuccess,
      onFailure,
      { controllers, timeoutMs: 15_000 },
    );

    expect(olderSignal?.aborted).toBe(true);
    expect(olderSignal?.reason).toBe(LATEST_REQUEST_CANCEL_REASON);
    await expect(olderRun).resolves.toBe(false);
    await expect(newerRun).resolves.toBe(true);
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledWith("fresh");
    expect(onFailure).not.toHaveBeenCalled();
    expect(controllers.size).toBe(0);
  });

  it("surfaces a latest request timeout and releases its controller", async () => {
    vi.useFakeTimers();
    try {
      const epochs = new Map<string, number>();
      const controllers = new Map<string, AbortController>();
      const onFailure = vi.fn();
      const run = settleLatestRequest(
        epochs,
        "outputs:job-1",
        (signal) =>
          new Promise<string>((_resolve, reject) => {
            signal?.addEventListener("abort", () => reject(signal.reason));
          }),
        vi.fn(),
        onFailure,
        { controllers, timeoutMs: 15_000 },
      );

      await vi.advanceTimersByTimeAsync(15_000);
      await expect(run).resolves.toBe(true);
      expect(onFailure).toHaveBeenCalledOnce();
      expect(controllers.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("invalidates and aborts active requests during teardown", async () => {
    const epochs = new Map<string, number>();
    const controllers = new Map<string, AbortController>();
    const onFailure = vi.fn();
    let signal: AbortSignal | undefined;
    const run = settleLatestRequest(
      epochs,
      "retry:job-1",
      (requestSignal) => {
        signal = requestSignal;
        return new Promise<string>((_resolve, reject) => {
          requestSignal?.addEventListener("abort", () =>
            reject(requestSignal.reason),
          );
        });
      },
      vi.fn(),
      onFailure,
      { controllers, timeoutMs: 15_000 },
    );

    cancelLatestRequests(epochs, controllers);

    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toBe(LATEST_REQUEST_CANCEL_REASON);
    await expect(run).resolves.toBe(false);
    expect(onFailure).not.toHaveBeenCalled();
    expect(controllers.size).toBe(0);
  });
});
