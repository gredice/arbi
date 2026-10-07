export function q6(value: number): number {
  const result = Math.floor(value * 1_000_000 + 0.5);
  if (!Number.isSafeInteger(result)) throw new Error("NUMERIC_LIMIT");
  return result === 0 ? 0 : result;
}
/** Digest-only numeric normalization. Model outputs/parameters retain their declared units. */
export function numericTreeQ6(value: unknown): unknown {
  if (typeof value === "number") return q6(value);
  if (Array.isArray(value)) return value.map(numericTreeQ6);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, numericTreeQ6(child)]));
  return value;
}
