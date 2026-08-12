export type RequestEpochs = Map<string, number>;
export type RequestControllers = Map<string, AbortController>;

export const LATEST_REQUEST_CANCEL_REASON = Symbol(
  "latest_request_cancelled",
);

type LatestRequestOptions = {
  controllers: RequestControllers;
  timeoutMs: number;
};

export function beginLatestRequest(epochs: RequestEpochs, key: string): number {
  const epoch = (epochs.get(key) ?? 0) + 1;
  epochs.set(key, epoch);
  return epoch;
}

export function isLatestRequest(
  epochs: RequestEpochs,
  key: string,
  epoch: number,
): boolean {
  return epochs.get(key) === epoch;
}

export async function settleLatestRequest<T>(
  epochs: RequestEpochs,
  key: string,
  request: (signal?: AbortSignal) => Promise<T>,
  onSuccess: (value: T) => void,
  onFailure: (error: unknown) => void,
  options?: LatestRequestOptions,
): Promise<boolean> {
  const epoch = beginLatestRequest(epochs, key);
  const controller = options ? new AbortController() : undefined;
  const previousController = options?.controllers.get(key);
  if (controller && options) options.controllers.set(key, controller);
  previousController?.abort(LATEST_REQUEST_CANCEL_REASON);
  const timeoutId =
    controller && options
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : undefined;
  let value: T;
  try {
    value = await request(controller?.signal);
  } catch (error) {
    if (!isLatestRequest(epochs, key, epoch)) return false;
    onFailure(error);
    return true;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (controller && options?.controllers.get(key) === controller) {
      options.controllers.delete(key);
    }
  }
  if (!isLatestRequest(epochs, key, epoch)) return false;
  onSuccess(value);
  return true;
}

export function cancelLatestRequests(
  epochs: RequestEpochs,
  controllers: RequestControllers,
) {
  for (const [key, controller] of controllers) {
    beginLatestRequest(epochs, key);
    controller.abort(LATEST_REQUEST_CANCEL_REASON);
  }
  controllers.clear();
}
