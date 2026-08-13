import { afterEach, describe, expect, it, vi } from "vitest";
import type { TranscriptionJob } from "./jobModel";
import type {
  JobRetryResponse,
  OutputReconciliationResponse,
} from "./jobRecoveryModel";
import {
  cancellationIsConfirmed,
  dismissalIsConfirmed,
  JOB_MUTATION_TIMEOUT_REASON,
  reconciliationCheckIsConfirmed,
  retryIsConfirmed,
  runBoundedRequest,
} from "./jobMutationRequest";

const job = (overrides: Partial<TranscriptionJob> = {}): TranscriptionJob => ({
  id: "job-1",
  project_id: "project-1",
  status: "processing",
  title: null,
  provider: null,
  source_count: 1,
  created_at: "2026-08-13T00:00:00Z",
  updated_at: "2026-08-13T00:00:00Z",
  cancelled_at: null,
  cancel_requested_at: null,
  attempt_count: 1,
  started_at: null,
  finished_at: null,
  error_code: null,
  error_message: null,
  ...overrides,
});

const retry = (overrides: Partial<JobRetryResponse> = {}): JobRetryResponse => ({
  job_id: "job-1",
  job_status: "failed",
  available: true,
  reason: "available",
  attempt_count: 1,
  max_attempts: 3,
  missing_output_count: 1,
  retry_safe_source_count: 1,
  ...overrides,
});

const reconciliation = (
  overrides: Partial<OutputReconciliationResponse> = {},
): OutputReconciliationResponse => ({
  job_id: "job-1",
  job_status: "failed",
  available: true,
  counts: { reconciliation_required: 1 },
  cases: [
    {
      job_source_id: "source-1",
      status: "reconciliation_required",
      resolved: false,
      last_checked_at: null,
    },
  ],
  ...overrides,
});

afterEach(() => vi.useRealTimers());

describe("bounded job mutation requests", () => {
  it("aborts at the deadline and reports an ambiguous timeout", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const pending = runBoundedRequest(
      (currentSignal) => {
        signal = currentSignal;
        return new Promise<string>((_resolve, reject) =>
          currentSignal.addEventListener("abort", () =>
            reject(currentSignal.reason),
          ),
        );
      },
      15_000,
    );

    await vi.advanceTimersByTimeAsync(15_000);

    await expect(pending).resolves.toEqual({ status: "timed_out" });
    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toBe(JOB_MUTATION_TIMEOUT_REASON);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns successful values and propagates non-timeout failures", async () => {
    await expect(
      runBoundedRequest(async () => "ok", 15_000),
    ).resolves.toEqual({ status: "completed", value: "ok" });
    const failure = new Error("network");
    await expect(
      runBoundedRequest(async () => {
        throw failure;
      }, 15_000),
    ).rejects.toBe(failure);
  });
});

describe("authoritative mutation outcome checks", () => {
  it("requires persisted cancellation or dismissal markers", () => {
    expect(cancellationIsConfirmed(job())).toBe(false);
    expect(
      cancellationIsConfirmed(
        job({ cancel_requested_at: "2026-08-13T00:01:00Z" }),
      ),
    ).toBe(true);
    expect(cancellationIsConfirmed(job({ status: "cancelled" }))).toBe(true);
    expect(dismissalIsConfirmed(job({ status: "completed" }))).toBe(false);
    expect(
      dismissalIsConfirmed(
        job({
          status: "completed",
          terminal_dismissed_at: "2026-08-13T00:01:00Z",
        }),
      ),
    ).toBe(true);
  });

  it("recognizes retry queueing and a fast failed follow-up attempt", () => {
    const before = retry();
    expect(retryIsConfirmed(before, retry({ job_status: "queued" }))).toBe(true);
    expect(
      retryIsConfirmed(before, retry({ attempt_count: 2, available: false })),
    ).toBe(true);
    expect(retryIsConfirmed(before, retry())).toBe(false);
    expect(retryIsConfirmed(null, retry())).toBe(false);
  });

  it("requires an observable reconciliation metadata transition", () => {
    const before = reconciliation();
    expect(reconciliationCheckIsConfirmed(before, reconciliation())).toBe(false);
    expect(
      reconciliationCheckIsConfirmed(
        before,
        reconciliation({
          cases: [
            {
              ...before.cases[0],
              last_checked_at: "2026-08-13T00:01:00Z",
            },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      reconciliationCheckIsConfirmed(
        before,
        reconciliation({
          job_status: "completed",
          available: false,
          counts: { resolved: 1 },
          cases: [{ ...before.cases[0], status: "resolved", resolved: true }],
        }),
      ),
    ).toBe(true);
    expect(reconciliationCheckIsConfirmed(null, reconciliation())).toBe(false);
  });
});