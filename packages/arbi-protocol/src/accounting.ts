import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { MAX_COUNTER } from "./validate.js";
import type { AccountingRecord, BillingCycle, DataQuantity, MobilePlan, UsageObservation } from "./accounting-types.js";

export const ACCOUNTING_VERSION = "arbi-accounting/1.0";
export const MAX_ACCOUNTING_BYTES = 32_768;
export type AccountingError = "INVALID_JSON" | "RECORD_TOO_LARGE" | "UNSUPPORTED_VERSION" | "INVALID_ACCOUNTING" | "INVALID_RANGE" | "INVALID_TIME" | "INVALID_QUANTITY" | "LAYER_MISMATCH" | "SCOPE_MISMATCH" | "OVERLAPPING_ATTRIBUTION" | "RESOURCE_LIMIT";
export type AccountingResult<T> = { ok: true; value: T } | { ok: false; error: { code: AccountingError; path: string } };
const bad = (code: AccountingError, path = "/"): AccountingResult<never> => ({ ok: false, error: { code, path } });
const good = <T>(value: T): AccountingResult<T> => ({ ok: true, value });
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const utc = (value: unknown): value is string => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
ajv.addFormat("date-time", { type: "string", validate: utc });
ajv.addSchema(JSON.parse(readFileSync(new URL("../schema/message.schema.json", import.meta.url), "utf8")));
const schema = JSON.parse(readFileSync(new URL("../schema/accounting.schema.json", import.meta.url), "utf8"));
ajv.addSchema(schema);
const validator = (name: string) => ajv.compile({ $ref: `${schema.$id}#/$defs/${name}` });
const validators = { usage: validator("UsageObservation"), "mobile-plan": validator("MobilePlan") };
const quantityValidator = validator("DataQuantity");
const cycleValidator = validator("BillingCycle");

/** Exact integer bytes: 1 GB = 10^9 bytes, 1 GiB = 2^30 bytes. */
export function quantityToBytes(input: unknown): AccountingResult<string> {
  if (!quantityValidator(input)) return bad("INVALID_QUANTITY");
  const quantity = input as DataQuantity;
  const [whole, fraction = ""] = quantity.value.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole + fraction) * { bytes: 1n, GB: 1_000_000_000n, GiB: 1_073_741_824n }[quantity.unit];
  if (numerator % denominator !== 0n) return bad("INVALID_QUANTITY");
  const bytes = numerator / denominator;
  return bytes > MAX_COUNTER ? bad("INVALID_RANGE") : good(bytes.toString());
}

export function validateAccounting(input: unknown): AccountingResult<AccountingRecord> {
  if (!record(input)) return bad("INVALID_ACCOUNTING");
  if (input.version !== ACCOUNTING_VERSION) return bad("UNSUPPORTED_VERSION", "/version");
  if (input.kind !== "usage" && input.kind !== "mobile-plan") return bad("INVALID_ACCOUNTING", "/kind");
  const check = validators[input.kind];
  if (!check(input)) return bad("INVALID_ACCOUNTING", check.errors?.[0]?.instancePath || "/");
  const value = input as AccountingRecord;
  if (value.kind === "mobile-plan") {
    const allowance = quantityToBytes(value.allowance);
    if (!allowance.ok) return allowance;
    if (value.rollover.cap !== null) {
      const cap = quantityToBytes(value.rollover.cap);
      if (!cap.ok) return cap;
    }
    try { formatter(value.cycle.timezone); } catch { return bad("INVALID_TIME", "/cycle/timezone"); }
  } else {
    if (value.bytes !== null && BigInt(value.bytes) > MAX_COUNTER) return bad("INVALID_RANGE", "/bytes");
    if (value.interval.start >= value.interval.end) return bad("INVALID_TIME", "/interval");
    if (value.evidence.observedAt !== null && value.evidence.observedAt < value.interval.end) return bad("INVALID_TIME", "/evidence/observedAt");
    if (value.layer === "provider" && value.boundary !== "garden-sim") return bad("SCOPE_MISMATCH", "/boundary");
    if (value.media !== null) {
      if (value.category !== "live-video" && value.category !== "turn") return bad("SCOPE_MISMATCH", "/media");
      // Viewer count describes topology only. Upstream byte deltas already count
      // actual sends; fanout is observed independently at cloud-viewer.
      if (value.boundary !== "cloud-viewer" && value.media.viewerId !== null) return bad("SCOPE_MISMATCH", "/media/viewerId");
      if (value.media.topology !== "shared" && value.media.viewerCount !== 1) return bad("SCOPE_MISMATCH", "/media/viewerCount");
    }
  }
  return good(value);
}

export function parseAccounting(json: string): AccountingResult<AccountingRecord> {
  if (Buffer.byteLength(json, "utf8") > MAX_ACCOUNTING_BYTES) return bad("RECORD_TOO_LARGE");
  try { return validateAccounting(JSON.parse(json)); } catch { return bad("INVALID_JSON"); }
}

export type UsageFreshness = "fresh" | "stale" | "unavailable";
export function usageFreshness(input: unknown, nowUtc: string): AccountingResult<UsageFreshness> {
  const parsed = validateAccounting(input);
  if (!parsed.ok) return parsed;
  if (parsed.value.kind !== "usage") return bad("SCOPE_MISMATCH");
  if (!utc(nowUtc)) return bad("INVALID_TIME");
  const evidence = parsed.value.evidence;
  if (evidence.observedAt === null) return good("unavailable");
  const age = Date.parse(nowUtc) - Date.parse(evidence.observedAt);
  if (age < 0) return bad("INVALID_TIME", "/evidence/observedAt");
  return good(age <= evidence.maxAgeMs ? "fresh" : "stale");
}

export interface UsageReconciliation {
  totalBytes: string | null;
  attributedBytes: string;
  explicitlyUnknownBytes: string;
  unattributedBytes: string | null;
  status: "complete" | "partial" | "unavailable" | "stale" | "inconsistent";
  quality: UsageObservation["evidence"]["quality"];
  layer: UsageObservation["layer"];
  freshness: UsageFreshness;
}

/** Compare ONE selected layer's total with its exclusive classification partition.
 * Never add the total to its parts or add payload/WAN/provider observations. */
export function reconcileUsage(totalInput: unknown, partInputs: readonly unknown[], nowUtc: string): AccountingResult<UsageReconciliation> {
  if (partInputs.length > 128) return bad("RESOURCE_LIMIT");
  const parsed = validateAccounting(totalInput);
  if (!parsed.ok) return parsed;
  if (parsed.value.kind !== "usage" || parsed.value.scope !== "boundary-total") return bad("SCOPE_MISMATCH");
  const total = parsed.value;
  const fresh = usageFreshness(total, nowUtc);
  if (!fresh.ok) return fresh;
  const keys = new Set<string>();
  const ids = new Set([total.observationId]);
  let sum = 0n, unknown = 0n;
  let complete = total.evidence.coverage === "complete";
  let quality = total.evidence.quality;
  let stale = fresh.value === "stale";
  for (const input of partInputs) {
    const partResult = validateAccounting(input);
    if (!partResult.ok) return partResult;
    if (partResult.value.kind !== "usage") return bad("SCOPE_MISMATCH");
    const part = partResult.value;
    if (part.layer !== total.layer) return bad("LAYER_MISMATCH", "/layer");
    if (part.scope !== "attributed" || part.siteId !== total.siteId || part.boundary !== total.boundary
      || part.linkId !== total.linkId || part.direction !== total.direction
      || part.executionMode !== total.executionMode || part.realm.environment !== total.realm.environment
      || part.realm.namespaceId !== total.realm.namespaceId || part.source.deviceId !== total.source.deviceId
      || part.source.bootId !== total.source.bootId || part.source.sessionId !== total.source.sessionId
      || part.counterEpoch !== total.counterEpoch || part.attributionRevision !== total.attributionRevision
      || part.interval.start !== total.interval.start || part.interval.end !== total.interval.end
      || (part.bytes !== null && [...part.evidence.includes].sort().join() !== [...total.evidence.includes].sort().join())) return bad("SCOPE_MISMATCH");
    const key = JSON.stringify([part.deviceId, part.category]);
    if (keys.has(key) || ids.has(part.observationId)) return bad("OVERLAPPING_ATTRIBUTION");
    keys.add(key); ids.add(part.observationId);
    const partFreshness = usageFreshness(part, nowUtc);
    if (!partFreshness.ok) return partFreshness;
    stale ||= partFreshness.value === "stale";
    complete &&= part.evidence.coverage === "complete" && part.bytes !== null;
    if (part.evidence.quality === "estimated" && quality === "measured") quality = "estimated";
    if (part.bytes !== null) {
      sum += BigInt(part.bytes);
      if (part.category === "unknown") unknown += BigInt(part.bytes);
    }
  }
  const observed = total.bytes === null ? null : BigInt(total.bytes);
  const residual = observed === null || sum > observed || stale ? null : observed - sum;
  const status = observed === null ? "unavailable" : stale ? "stale" : sum > observed ? "inconsistent"
    : complete && residual === 0n && unknown === 0n ? "complete" : "partial";
  return good({ totalBytes: total.bytes, attributedBytes: sum.toString(), explicitlyUnknownBytes: unknown.toString(),
    unattributedBytes: residual?.toString() ?? null, status, quality, layer: total.layer, freshness: stale ? "stale" : fresh.value });
}

function formatter(timezone: string): Intl.DateTimeFormat {
  if (/^[+-]/.test(timezone)) throw new Error("Billing timezone must be an IANA zone or UTC");
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, calendar: "iso8601", numberingSystem: "latn",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
}
function localParts(format: Intl.DateTimeFormat, time: number): number[] {
  const parts = Object.fromEntries(format.formatToParts(time).map((p) => [p.type, p.value]));
  return ["year", "month", "day", "hour", "minute", "second"].map((key) => Number(parts[key]));
}
function asUtc(parts: number[]): number {
  const date = new Date(0);
  date.setUTCFullYear(parts[0], parts[1] - 1, parts[2]);
  date.setUTCHours(parts[3], parts[4], parts[5], 0);
  return date.getTime();
}
function cycleStart(cycle: BillingCycle, year: number, month: number): AccountingResult<number> {
  const monthDate = new Date(asUtc([year, month + 1, 1, 0, 0, 0]));
  monthDate.setUTCDate(0);
  const day = Math.min(cycle.anchorDay, monthDate.getUTCDate());
  const desired = [year, month, day, cycle.anchorHour, cycle.anchorMinute, 0];
  const guessed = asUtc(desired);
  const format = formatter(cycle.timezone);
  const offsets = new Set<number>();
  // Sample both sides of any civil offset transition. Candidate instants must
  // round-trip exactly; missing/ambiguous anchors never silently shift.
  for (let hours = -48; hours <= 48; hours += 6) {
    const instant = guessed + hours * 3_600_000;
    offsets.add(asUtc(localParts(format, instant)) - instant);
  }
  const candidates = [...offsets].map((offset) => guessed - offset)
    .filter((instant) => localParts(format, instant).every((value, index) => value === desired[index])).sort((a, b) => a - b);
  if (candidates.length === 0 || (candidates.length > 1 && cycle.dstFold === "reject")) return bad("INVALID_TIME", "/cycle/anchor");
  return good(cycle.dstFold === "later" ? candidates.at(-1)! : candidates[0]);
}

/** Half-open [start,end) monthly cycle in the explicitly configured timezone. */
export function billingPeriod(input: unknown, atUtc: string): AccountingResult<{ start: string; end: string }> {
  if (!cycleValidator(input) || !utc(atUtc)) return bad("INVALID_TIME");
  const cycle = input as BillingCycle;
  try {
    const [year, month] = localParts(formatter(cycle.timezone), Date.parse(atUtc));
    const current = cycleStart(cycle, year, month);
    if (!current.ok) return current;
    const shift = (delta: number) => {
      const date = new Date(asUtc([year, month + delta, 1, 0, 0, 0]));
      return cycleStart(cycle, date.getUTCFullYear(), date.getUTCMonth() + 1);
    };
    const before = Date.parse(atUtc) < current.value;
    const start = before ? shift(-1) : current;
    const end = before ? current : shift(1);
    if (!start.ok) return start;
    if (!end.ok) return end;
    const period = { start: new Date(start.value).toISOString(), end: new Date(end.value).toISOString() };
    if (!utc(period.start) || !utc(period.end)) return bad("INVALID_TIME", "/cycle/anchor");
    return good(period);
  } catch { return bad("INVALID_TIME", "/cycle/timezone"); }
}

/** Only previous cycle's unused BASE allowance may roll once; no automatic carry. */
export function cycleAllowance(planInput: unknown, previousUnusedBaseBytes: string | null): AccountingResult<string | null> {
  const parsed = validateAccounting(planInput);
  if (!parsed.ok) return parsed;
  if (parsed.value.kind !== "mobile-plan") return bad("SCOPE_MISMATCH");
  const plan: MobilePlan = parsed.value;
  const base = quantityToBytes(plan.allowance);
  if (!base.ok) return base;
  if (plan.rollover.policy === "none") return good(base.value);
  if (previousUnusedBaseBytes === null) return good(null);
  if (!/^(0|[1-9][0-9]{0,19})$/.test(previousUnusedBaseBytes) || BigInt(previousUnusedBaseBytes) > BigInt(base.value)) return bad("INVALID_RANGE");
  const cap = quantityToBytes(plan.rollover.cap);
  if (!cap.ok) return cap;
  const carry = BigInt(previousUnusedBaseBytes) < BigInt(cap.value) ? BigInt(previousUnusedBaseBytes) : BigInt(cap.value);
  const allowance = BigInt(base.value) + carry;
  return allowance > MAX_COUNTER ? bad("INVALID_RANGE") : good(allowance.toString());
}

export function directionIsCharged(planInput: unknown, direction: unknown): AccountingResult<boolean> {
  const parsed = validateAccounting(planInput);
  if (!parsed.ok) return parsed;
  if (parsed.value.kind !== "mobile-plan" || (direction !== "upload" && direction !== "download")) return bad("SCOPE_MISMATCH");
  return good(parsed.value.chargedDirections === "both" || parsed.value.chargedDirections === direction);
}
