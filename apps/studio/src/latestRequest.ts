export type RequestEpochs = Map<string, number>;

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
  request: () => Promise<T>,
  onSuccess: (value: T) => void,
  onFailure: (error: unknown) => void,
): Promise<boolean> {
  const epoch = beginLatestRequest(epochs, key);
  let value: T;
  try {
    value = await request();
  } catch (error) {
    if (!isLatestRequest(epochs, key, epoch)) return false;
    onFailure(error);
    return true;
  }
  if (!isLatestRequest(epochs, key, epoch)) return false;
  onSuccess(value);
  return true;
}
