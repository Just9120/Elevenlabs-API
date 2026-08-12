import { describe, expect, it, vi } from "vitest";

import { settleLatestRequest } from "./latestRequest";

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
});
