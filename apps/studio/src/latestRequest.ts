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
