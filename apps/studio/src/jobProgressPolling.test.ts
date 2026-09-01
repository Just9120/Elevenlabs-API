import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  JOB_PROGRESS_POLL_INTERVAL_MS,
  JOB_PROGRESS_REQUEST_TIMEOUT_MS,
  JOB_PROGRESS_RETRY_MAX_DELAY_MS,
  jobProgressRetryDelay,
  startJobProgressPolling,
} from "./jobProgressPolling";

async function settlePromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("job progress polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries an initial failure and returns to the normal cadence after recovery", async () => {
    const task = vi.fn()
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValue(undefined);
    const onFailure = vi.fn();

    const stop = startJobProgressPolling(task, onFailure);
    await settlePromises();

    expect(task).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(JOB_PROGRESS_POLL_INTERVAL_MS);
    expect(task).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(JOB_PROGRESS_POLL_INTERVAL_MS);
    expect(task).toHaveBeenCalledTimes(3);
    stop();
  });

  it("uses bounded exponential backoff", () => {
    expect(jobProgressRetryDelay(1)).toBe(JOB_PROGRESS_POLL_INTERVAL_MS);
    expect(jobProgressRetryDelay(2)).toBe(6_000);
    expect(jobProgressRetryDelay(3)).toBe(12_000);
    expect(jobProgressRetryDelay(4)).toBe(24_000);
    expect(jobProgressRetryDelay(5)).toBe(JOB_PROGRESS_RETRY_MAX_DELAY_MS);
    expect(jobProgressRetryDelay(20)).toBe(JOB_PROGRESS_RETRY_MAX_DELAY_MS);
  });

  it("aborts a stalled request and retries after the bounded failure delay", async () => {
    const task = vi.fn(({ signal }: { signal: AbortSignal }) => {
      return new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
    const onFailure = vi.fn();

    const stop = startJobProgressPolling(task, onFailure);
    await vi.advanceTimersByTimeAsync(JOB_PROGRESS_REQUEST_TIMEOUT_MS);

    expect(onFailure).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(JOB_PROGRESS_POLL_INTERVAL_MS);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
  });

  it("keeps polling after a successful refresh reconciles missing jobs", async () => {
    const reconcileMissingJobs = vi.fn();
    const task = vi.fn().mockImplementation(async () => {
      if (task.mock.calls.length === 1) reconcileMissingJobs();
    });

    const stop = startJobProgressPolling(task, vi.fn());
    await settlePromises();
    expect(reconcileMissingJobs).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(JOB_PROGRESS_POLL_INTERVAL_MS);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
  });

  it("clears pending timers when stopped", async () => {
    const stop = startJobProgressPolling(vi.fn().mockResolvedValue(undefined), vi.fn());
    await settlePromises();
    expect(vi.getTimerCount()).toBe(1);

    stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not schedule another refresh when stopped in flight", async () => {
    let resolveTask: (() => void) | undefined;
    const task = vi.fn(() => new Promise<void>((resolve) => {
      resolveTask = resolve;
    }));
    const stop = startJobProgressPolling(task, vi.fn());

    stop();
    resolveTask?.();
    await settlePromises();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts the in-flight request when stopped", () => {
    let requestSignal: AbortSignal | undefined;
    const task = vi.fn(({ signal }: { signal: AbortSignal }) => {
      requestSignal = signal;
      return new Promise<void>(() => undefined);
    });

    const stop = startJobProgressPolling(task, vi.fn());
    expect(requestSignal?.aborted).toBe(false);

    stop();
    expect(requestSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
