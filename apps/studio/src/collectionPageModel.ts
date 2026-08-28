export function appendUniqueItems<T extends { id: string }>(
  current: readonly T[],
  incoming: readonly T[],
) {
  const existing = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !existing.has(item.id))];
}
