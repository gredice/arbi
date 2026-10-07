import { createHash } from "node:crypto";
import { parseAuditEvent } from "@arbi/protocol";
import type { AuditEvent, IngestTime } from "@arbi/protocol";
import { AuditError } from "./errors.js";
export { AuditError } from "./errors.js";
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function digest(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }
export const GENESIS = "0".repeat(64);
export function chainHash(previous: string, ordinal: number, contentHash: string): string {
  return digest({ previous, ordinal, contentHash });
}
export function checked(input: unknown, received = false): AuditEvent {
  let json: string;
  try { json = JSON.stringify(input); } catch { throw new AuditError("INVALID_REQUEST"); }
  const parsed = typeof json === "string" ? parseAuditEvent(json) : null;
  if (!parsed?.ok || parsed.value.sequence === "0" || (!received && parsed.value.ingestTime !== null)) throw new AuditError("INVALID_REQUEST");
  return structuredClone(parsed.value);
}
export function contentHash(event: AuditEvent): string { return digest({ ...event, ingestTime: null }); }
export function streamKey(event: AuditEvent): string {
  return canonical([event.realm, event.executionMode, event.siteId, event.source]);
}
export interface DurableReceipt {
  durable: true; eventId: string; contentHash: string; ingestTime: Exclude<IngestTime, null>;
}
/** Decimal uint64 ranges; no Number conversion or assumed global time ordering. */
export function missingRanges(sequences: string[]): Array<{ from: string; to: string }> {
  const sorted = [...new Set(sequences.map((n) => BigInt(n)))].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const gaps: Array<{ from: string; to: string }> = [];
  let next = 1n;
  for (const n of sorted) { if (n > next) gaps.push({ from: String(next), to: String(n - 1n) }); next = n + 1n; }
  return gaps;
}
