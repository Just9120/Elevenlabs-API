import type { TranscriptionJob } from "./jobModel";
import type {
  JobRetryResponse,
  OutputReconciliationResponse,
} from "./jobRecoveryModel";

export const JOB_MUTATION_REQUEST_TIMEOUT_MS = 20_000;
export const JOB_MUTATION_TIMEOUT_REASON = Symbol("job_mutation_timeout");

export type BoundedRequestResult<T> =
  | { status: "completed"; value: T }
  | { status: "timed_out" };

export async function runBoundedRequest<T>(
  request: (signal: AbortSignal) => Promise<T>,
  timeoutMs = JOB_MUTATION_REQUEST_TIMEOUT_MS,
): Promise<BoundedRequestResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(JOB_MUTATION_TIMEOUT_REASON),
    timeoutMs,
  );
  try {
    return { status: "completed", value: await request(controller.signal) };
  } catch (error) {
    if (
      controller.signal.aborted &&
      controller.signal.reason === JOB_MUTATION_TIMEOUT_REASON
    ) {
      return { status: "timed_out" };
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function cancellationIsConfirmed(job: TranscriptionJob) {
  return job.status === "cancelled" || Boolean(job.cancel_requested_at);
}

export function dismissalIsConfirmed(job: TranscriptionJob) {
  return Boolean(job.terminal_dismissed_at);
}

export function retryIsConfirmed(
  before: JobRetryResponse | null,
  after: JobRetryResponse,
) {
  return (
    ["queued", "processing", "completed"].includes(after.job_status) ||
    (before !== null && after.attempt_count > before.attempt_count)
  );
}

function countSignature(counts: Record<string, number>) {
  return Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
}

export function reconciliationCheckIsConfirmed(
  before: OutputReconciliationResponse | null,
  after: OutputReconciliationResponse,
) {
  if (!before || before.job_id !== after.job_id) return false;
  if (
    before.job_status !== after.job_status ||
    before.available !== after.available ||
    countSignature(before.counts) !== countSignature(after.counts)
  ) {
    return true;
  }
  const previousCases = new Map(
    before.cases.map((item) => [item.job_source_id, item]),
  );
  return after.cases.some((item) => {
    const previous = previousCases.get(item.job_source_id);
    return (
      !previous ||
      previous.status !== item.status ||
      previous.resolved !== item.resolved ||
      previous.last_checked_at !== item.last_checked_at
    );
  });
}