import type { Capability, Command, Event, Identity, Message, Realm, Sample, Telemetry } from "./messages.js";
import { fail, validateMessage, type Result } from "./validate.js";

const equal = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
const sourceKey = (source: Identity): string => `${source.deviceId}/${source.bootId}/${source.sessionId}`;

export interface Boundary {
  realm: Realm;
  executionMode: "simulation" | "hardware";
  siteId: string;
  authenticatedSource: Identity;
}

function checkBoundary(message: Command | Event | Telemetry, context: Boundary): Result<true> {
  if (!equal(message.realm, context.realm)) return fail("REALM_MISMATCH", "/realm");
  if (message.executionMode !== context.executionMode) return fail("REALM_MISMATCH", "/executionMode");
  if (message.siteId !== context.siteId) return fail("SITE_MISMATCH", "/siteId");
  if (!equal(message.source, context.authenticatedSource)) return fail("SOURCE_MISMATCH", "/source");
  return { ok: true, value: true };
}

export interface CommandGate extends Boundary {
  receiver: Identity;
  nowMonotonicMs: number;
  maxDeadlineAheadMs: number;
  authorizedActorId: string;
  allowedTypes: Command["body"]["type"][];
  supportedTypes: Command["body"]["type"][];
  configRevision: string;
  faultInhibited: boolean;
  lease: { id: string; holderId: string; fence: string; receiver: Identity; expiresMonotonicMs: number } | null;
}

export interface CommandLedger {
  receipts: Map<string, { fingerprint: string; commandId: string }>;
  sequenceBySource: Map<string, bigint>;
  maxReceipts: number;
}
export const createCommandLedger = (maxReceipts = 1024): CommandLedger => ({ receipts: new Map(), sequenceBySource: new Map(), maxReceipts });

/** Reference admission only. Persist admission atomically with dispatch intent in real adapters. */
export function admitCommand(input: unknown, context: CommandGate, ledger: CommandLedger): Result<{ decision: "accepted" | "duplicate"; command: Command }> {
  const parsed = validateMessage(input);
  if (!parsed.ok) return parsed;
  const message = parsed.value;
  if (message.kind !== "command") return fail("UNKNOWN_KIND", "/kind");
  const boundary = checkBoundary(message, context);
  if (!boundary.ok) return boundary;
  const c = message.command;
  if (c.target.deviceId !== context.receiver.deviceId) return fail("TARGET_MISMATCH", "/command/target");
  if (c.target.bootId !== context.receiver.bootId) return fail("TARGET_RESTARTED", "/command/target/bootId");
  if (c.target.sessionId !== context.receiver.sessionId) return fail("SESSION_MISMATCH", "/command/target/sessionId");
  if (c.actor.id !== context.authorizedActorId || !context.allowedTypes.includes(message.body.type)) return fail("NOT_AUTHORIZED", "/command/actor");
  if (!context.supportedTypes.includes(message.body.type)) return fail("UNSUPPORTED_CAPABILITY", "/body/type");
  if (!Number.isSafeInteger(context.nowMonotonicMs) || context.nowMonotonicMs < 0 || !Number.isSafeInteger(context.maxDeadlineAheadMs) || context.maxDeadlineAheadMs < 1 || context.maxDeadlineAheadMs > 30000) return fail("CLOCK_INVALID");
  const key = `${sourceKey(message.source)}/${c.idempotencyKey}`;
  const fingerprint = canonical({ protocol: message.protocol, realm: message.realm, executionMode: message.executionMode, siteId: message.siteId, source: message.source, command: c, body: message.body });
  const receipt = ledger.receipts.get(key);
  if (receipt) {
    if (receipt.fingerprint !== fingerprint) return fail("IDEMPOTENCY_CONFLICT", "/command/idempotencyKey");
    // A cached outcome is safe to return after expiry. This never dispatches again.
    return { ok: true, value: { decision: "duplicate", command: message } };
  }
  if ([...ledger.receipts.values()].some((r) => r.commandId === c.commandId)) return fail("IDEMPOTENCY_CONFLICT", "/command/commandId");
  const sequence = BigInt(message.sequence);
  const previous = ledger.sequenceBySource.get(sourceKey(message.source));
  if (previous !== undefined && sequence <= previous) return fail("SEQUENCE_REPLAY", "/sequence");
  if (c.deadline.expiresMonotonicMs <= context.nowMonotonicMs) return fail("DEADLINE_EXPIRED", "/command/deadline");
  if (c.deadline.expiresMonotonicMs - context.nowMonotonicMs > context.maxDeadlineAheadMs) return fail("DEADLINE_TOO_FAR", "/command/deadline");
  if ("maxDurationMs" in message.body && message.body.maxDurationMs > c.deadline.expiresMonotonicMs - context.nowMonotonicMs) return fail("INVALID_RANGE", "/body/maxDurationMs");
  const leaseFree = message.body.type === "control.stop" || message.body.type === "state.resync";
  if (!leaseFree && c.configRevision !== context.configRevision) return fail("CONFIG_MISMATCH", "/command/configRevision");
  if (!leaseFree) {
    if (!c.lease || !context.lease) return fail("LEASE_REQUIRED", "/command/lease");
    if (!equal(context.lease.receiver, context.receiver) || c.lease.id !== context.lease.id || c.lease.holderId !== c.actor.id || c.lease.holderId !== context.lease.holderId || c.lease.fence !== context.lease.fence) return fail("LEASE_STALE", "/command/lease");
    if (!Number.isSafeInteger(context.lease.expiresMonotonicMs) || context.lease.expiresMonotonicMs < 0) return fail("CLOCK_INVALID", "/command/lease");
    if (context.lease.expiresMonotonicMs <= context.nowMonotonicMs || c.deadline.expiresMonotonicMs > context.lease.expiresMonotonicMs) return fail("LEASE_EXPIRED", "/command/lease");
  }
  if (context.faultInhibited && !leaseFree && message.body.type !== "camera.preview.stop" && message.body.type !== "command.cancel") return fail("FAULT_INHIBITED");
  if (ledger.receipts.size >= ledger.maxReceipts) return fail("RESOURCE_LIMIT");
  ledger.receipts.set(key, { fingerprint, commandId: c.commandId });
  ledger.sequenceBySource.set(sourceKey(message.source), sequence);
  return { ok: true, value: { decision: "accepted", command: message } };
}

type Outcome = Extract<Event["body"], { type: "command.outcome" }>["outcome"];
const transitions: Record<Outcome, Outcome[]> = {
  requested: ["accepted", "rejected", "cancelled", "failed"],
  accepted: ["running", "failed", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  rejected: [], completed: [], failed: [], cancelled: [],
};
export function advanceOutcome(current: Outcome | null, next: Outcome): Result<Outcome> {
  if (current === next || (current === null && next === "requested") || (current !== null && transitions[current].includes(next))) return { ok: true, value: next };
  return fail("INVALID_TRANSITION", "/body/outcome");
}

/** Called after authentication with the negotiated active source; never auto-adopts a boot/session. */
export function advanceCursor(activeSource: Identity, stream: "event" | "telemetry", previous: string | null, source: Identity, sequence: string): Result<{ sequence: string; gap: boolean }> {
  if (!equal(activeSource, source)) return fail("RESYNC_REQUIRED", "/source");
  const counterValid = (counter: string): boolean => /^(0|[1-9][0-9]{0,19})$/.test(counter) && BigInt(counter) <= 18446744073709551615n;
  if (!counterValid(sequence)) return fail("INVALID_RANGE", "/sequence");
  if (previous !== null && !counterValid(previous)) return fail("INVALID_RANGE", "/cursor/sequence");
  const next = BigInt(sequence);
  if (previous !== null && next <= BigInt(previous)) return fail("SEQUENCE_REPLAY", "/sequence");
  const gap = previous !== null && next > BigInt(previous) + 1n;
  if (gap && stream === "event") return fail("RESYNC_REQUIRED", "/sequence");
  return { ok: true, value: { sequence, gap } };
}

export interface TelemetryContext extends Boundary {
  activeSource: Identity;
  capabilitiesRevision: string;
  capabilities: Capability[];
}
export interface TelemetryState {
  sequence: string | null;
  sourceMonotonicMs: number | null;
  samples: Map<Sample["metric"], Sample>;
}
export const createTelemetryState = (): TelemetryState => ({ sequence: null, sourceMonotonicMs: null, samples: new Map() });

/** Trusted ingest time and bounded UTC uncertainty provide a conservative delay bound. */
export function transportAgeUpperBound(message: Message): Result<number | null> {
  if (message.sourceTime.utc === null || message.sourceTime.uncertaintyMs === null || message.ingestTime === null) return { ok: true, value: null };
  const upper = Date.parse(message.ingestTime.utc) - Date.parse(message.sourceTime.utc) + message.ingestTime.uncertaintyMs + message.sourceTime.uncertaintyMs;
  if (!Number.isSafeInteger(upper) || upper < 0) return fail("CLOCK_INVALID", "/sourceTime/utc");
  return { ok: true, value: upper };
}

export function applyTelemetry(input: unknown, context: TelemetryContext, state: TelemetryState): Result<{ gap: boolean }> {
  const parsed = validateMessage(input);
  if (!parsed.ok) return parsed;
  const message = parsed.value;
  if (message.kind !== "telemetry") return fail("UNKNOWN_KIND", "/kind");
  const boundary = checkBoundary(message, context);
  if (!boundary.ok) return boundary;
  const cursor = advanceCursor(context.activeSource, "telemetry", state.sequence, message.source, message.sequence);
  if (!cursor.ok) return cursor;
  if (message.body.capabilitiesRevision !== context.capabilitiesRevision) return fail("RESYNC_REQUIRED", "/body/capabilitiesRevision");
  if (state.sourceMonotonicMs !== null && message.sourceTime.monotonicMs < state.sourceMonotonicMs) return fail("CLOCK_INVALID", "/sourceTime/monotonicMs");
  for (const sample of message.body.samples) {
    const capability = context.capabilities.find((c) => c.metric === sample.metric);
    const quality = sample.quality === "stale" ? sample.originQuality : sample.quality;
    if (sample.quality !== "unavailable" && (!capability || !capability.qualities.includes(quality as "measured" | "commanded" | "estimated"))) return fail("QUALITY_UNSUPPORTED", "/body/samples");
    const previous = state.samples.get(sample.metric);
    if (sample.sampleMonotonicMs !== null && previous?.sampleMonotonicMs !== undefined && previous.sampleMonotonicMs !== null && sample.sampleMonotonicMs < previous.sampleMonotonicMs) return fail("SEQUENCE_REPLAY", "/body/samples");
  }
  for (const sample of message.body.samples) state.samples.set(sample.metric, structuredClone(sample));
  state.sequence = message.sequence;
  state.sourceMonotonicMs = message.sourceTime.monotonicMs;
  return { ok: true, value: { gap: cursor.value.gap } };
}

/** elapsedSinceReceiptMs is receiver-monotonic; never subtract unrelated device clocks. */
export function ageSample(sample: Sample, elapsedSinceReceiptMs: number, transportAgeUpperBoundMs: number | null, maxAgeMs: number): Sample {
  if (sample.quality === "unavailable") return structuredClone(sample);
  if (!Number.isSafeInteger(elapsedSinceReceiptMs) || elapsedSinceReceiptMs < 0 || transportAgeUpperBoundMs === null || !Number.isSafeInteger(transportAgeUpperBoundMs) || transportAgeUpperBoundMs < 0 || !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 0) return { ...sample, quality: "stale", originQuality: sample.originQuality ?? sample.quality as "measured" | "commanded" | "estimated", reason: "expired" };
  const ageMs = (sample.ageMs ?? 0) + elapsedSinceReceiptMs + transportAgeUpperBoundMs;
  if (!Number.isSafeInteger(ageMs) || ageMs > maxAgeMs || sample.quality === "stale") return { ...sample, quality: "stale", originQuality: sample.originQuality ?? sample.quality as "measured" | "commanded" | "estimated", reason: "expired" };
  return structuredClone(sample);
}
