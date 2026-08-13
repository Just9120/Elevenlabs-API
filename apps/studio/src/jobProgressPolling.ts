export const JOB_PROGRESS_POLL_INTERVAL_MS = 5_000;
export const JOB_PROGRESS_RETRY_MAX_DELAY_MS = 30_000;
export const JOB_PROGRESS_REQUEST_TIMEOUT_MS = 15_000;
export const JOB_PROGRESS_POLLING_STOP_REASON = Symbol(
  "job_progress_polling_stopped",
);

type PollingContext = {
  isStopped: () => boolean;
  signal: AbortSignal;
};

type TimerDependencies = {
  setTimeout: (callback: () => void, delayMs: number) => number;
  clearTimeout: (timerId: number) => void;
};

export function jobProgressRetryDelay(
  consecutiveFailures: number,
  pollIntervalMs = JOB_PROGRESS_POLL_INTERVAL_MS,
  maxRetryDelayMs = JOB_PROGRESS_RETRY_MAX_DELAY_MS,
): number {
  const failureIndex = Math.max(0, Math.floor(consecutiveFailures) - 1);
  const multiplier = 2 ** Math.min(failureIndex, 30);
  return Math.min(pollIntervalMs * multiplier, maxRetryDelayMs);
}

export function startJobProgressPolling(
  task: (context: PollingContext) => Promise<void>,
  onFailure: () => void,
  timerDependencies: TimerDependencies = {
    setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimeout: (timerId) => window.clearTimeout(timerId),
  },
): () => void {
  let stopped = false;
  let timerId: number | undefined;
  let requestTimeoutId: number | undefined;
  let requestController: AbortController | undefined;
  let consecutiveFailures = 0;

  const schedule = (delayMs: number) => {
    if (stopped) return;
    timerId = timerDependencies.setTimeout(() => {
      timerId = undefined;
      void refresh();
    }, delayMs);
  };

  const refresh = async () => {
    const controller = new AbortController();
    requestController = controller;
    requestTimeoutId = timerDependencies.setTimeout(
      () => controller.abort(),
      JOB_PROGRESS_REQUEST_TIMEOUT_MS,
    );
    try {
      await task({ isStopped: () => stopped, signal: controller.signal });
      if (stopped) return;
      consecutiveFailures = 0;
      schedule(JOB_PROGRESS_POLL_INTERVAL_MS);
    } catch {
      if (stopped) return;
      consecutiveFailures += 1;
      onFailure();
      schedule(jobProgressRetryDelay(consecutiveFailures));
    } finally {
      if (requestTimeoutId !== undefined) {
        timerDependencies.clearTimeout(requestTimeoutId);
        requestTimeoutId = undefined;
      }
      if (requestController === controller) requestController = undefined;
    }
  };

  void refresh();

  return () => {
    stopped = true;
    if (timerId !== undefined) timerDependencies.clearTimeout(timerId);
    if (requestTimeoutId !== undefined) {
      timerDependencies.clearTimeout(requestTimeoutId);
      requestTimeoutId = undefined;
    }
    requestController?.abort(JOB_PROGRESS_POLLING_STOP_REASON);
    requestController = undefined;
  };
}
