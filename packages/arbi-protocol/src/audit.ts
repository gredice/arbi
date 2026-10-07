import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { Actor, Counter, Id, Identity, IngestTime, Realm } from "./messages.js";
import type { AuditAction, AuditEvidence, AuditEvent, AuditLinks, AuditMetadata, AuditResource, AuditSource } from "./audit-types.js";
import { fail, MAX_COUNTER, validateMessage, type Result } from "./validate.js";

export const AUDIT_VERSION = "arbi.audit/1.0";
export const MAX_AUDIT_EVENT_BYTES = 8_192;
const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
ajv.addFormat("date-time", {
  type: "string",
  validate: (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value,
});
ajv.addSchema(JSON.parse(readFileSync(new URL("../schema/message.schema.json", import.meta.url), "utf8")));
const check = ajv.compile(JSON.parse(readFileSync(new URL("../schema/audit-event.schema.json", import.meta.url), "utf8")));
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const deviceActions: Partial<Record<AuditAction, AuditSource["module"][]>> = {
  "motion.move": ["edge", "motion"], "motion.home": ["edge", "motion"], "control.stop": ["edge", "motion"],
  "gimbal.move": ["edge", "pod"], "capture.request": ["edge", "pod"],
  "schedule.create": ["edge"], "schedule.update": ["edge"], "schedule.delete": ["edge"],
};

/** Structural/semantic validation is evidence validation, never execution authority. */
export function validateAuditEvent(input: unknown): Result<AuditEvent> {
  if (!object(input)) return fail("INVALID_MESSAGE");
  if (input.auditVersion !== AUDIT_VERSION) return fail("UNSUPPORTED_VERSION", "/auditVersion");
  if (!check(input)) {
    const errors = check.errors ?? [];
    const extra = errors.find((error) => error.keyword === "additionalProperties");
    // Unknown key names can themselves contain secrets; report only the schema-owned parent path.
    if (extra) return fail("UNKNOWN_FIELD", `${extra.instancePath}/[unknown]`);
    const range = errors.find((error) => ["minimum", "maximum"].includes(error.keyword));
    if (range) return fail("INVALID_RANGE", range.instancePath);
    return fail("INVALID_MESSAGE", errors[0]?.instancePath || "/");
  }
  const event = input as AuditEvent;
  if (BigInt(event.sequence) > MAX_COUNTER) return fail("INVALID_RANGE", "/sequence");
  if ((event.sourceTime.utc === null) !== (event.sourceTime.uncertaintyMs === null)) return fail("CLOCK_INVALID", "/sourceTime");
  const links = event.links;
  if (event.evidence === "intent") {
    if (links.intentEventId !== event.eventId || links.causationEventId !== null) return fail("INVALID_MESSAGE", "/links");
  } else {
    if (links.intentEventId === event.eventId || links.causationEventId === event.eventId) return fail("INVALID_MESSAGE", "/links");
    if (links.intentEventId === null && !["identity.login", "authorization.check", "release.publish"].includes(event.action)) return fail("INVALID_MESSAGE", "/links/intentEventId");
  }
  if (event.evidence === "device-outcome") {
    if (!isDeepStrictEqual(links.target, event.source.identity)) return fail("TARGET_MISMATCH", "/links/target");
    if (event.resource.deviceId !== event.source.identity.deviceId) return fail("TARGET_MISMATCH", "/resource/deviceId");
    const allowed = deviceActions[event.action];
    if (allowed && !allowed.includes(event.source.module)) return fail("SOURCE_MISMATCH", "/source/module");
    if (event.outcome === "succeeded" && event.reason !== "completed") return fail("INVALID_MESSAGE", "/reason");
  }
  if (event.resource.kind === "device" && event.resource.id !== event.resource.deviceId) return fail("TARGET_MISMATCH", "/resource");
  if (event.change !== null && !["calibration.change", "configuration.change", "schedule.create", "schedule.update", "schedule.delete", "update.request", "update.install", "update.rollback"].includes(event.action)) return fail("INVALID_MESSAGE", "/change");
  const metadata = event.metadata;
  const observational = ["media-observation", "access-observation", "browser-observation"].includes(event.evidence);
  if (!observational && (metadata.observation !== undefined || metadata.byteCount !== undefined || metadata.observedInterval !== undefined)) return fail("INVALID_MESSAGE", "/metadata");
  if (metadata.byteCount !== undefined && (metadata.observation !== "bytes-delivered" || event.outcome !== "observed")) return fail("INVALID_MESSAGE", "/metadata/byteCount");
  if (metadata.observation === "bytes-delivered" && (metadata.byteCount === undefined || metadata.byteCount === 0 || event.outcome !== "observed")) return fail("INVALID_MESSAGE", "/metadata/byteCount");
  if (["connection-established", "delivery-started"].includes(metadata.observation ?? "") && event.outcome !== "observed") return fail("INVALID_MESSAGE", "/metadata/observation");
  if (metadata.observedInterval !== undefined) {
    const interval = metadata.observedInterval;
    if (interval.startMonotonicMs > interval.endMonotonicMs || interval.endMonotonicMs > event.sourceTime.monotonicMs) return fail("CLOCK_INVALID", "/metadata/observedInterval");
  }
  // No grant/observation for stored recordings exists in this exact audit version.
  if (event.resource.kind === "recording" && (event.evidence !== "authorization" || event.outcome !== "deny" || event.reason !== "disabled")) return fail("UNSUPPORTED_CAPABILITY", "/resource/kind");
  return { ok: true, value: event };
}

export function parseAuditEvent(json: string): Result<AuditEvent> {
  if (Buffer.byteLength(json, "utf8") > MAX_AUDIT_EVENT_BYTES) return fail("MESSAGE_TOO_LARGE");
  let input: unknown;
  try { input = JSON.parse(json); } catch { return fail("INVALID_JSON"); }
  return validateAuditEvent(input);
}

export interface AuditBoundary {
  action: AuditAction;
  evidence: AuditEvidence;
  record: AuditEvent["record"];
  realm: Realm;
  executionMode: AuditEvent["executionMode"];
  siteId: Id;
  authenticatedSource: AuditSource;
  actor: Actor;
  resource: AuditResource;
  links: AuditLinks;
  metadata: AuditMetadata;
  change: AuditEvent["change"];
  ingestTime: Exclude<IngestTime, null>;
}

/** Trusted adapters supply bindings from authorization/enrollment and their clock. */
export function admitAuditEvent(input: unknown, boundary: AuditBoundary): Result<AuditEvent> {
  const parsed = validateAuditEvent(input);
  if (!parsed.ok) return parsed;
  const event = parsed.value;
  if (event.ingestTime !== null) return fail("NOT_AUTHORIZED", "/ingestTime");
  if (!isDeepStrictEqual(event.realm, boundary.realm) || event.executionMode !== boundary.executionMode) return fail("REALM_MISMATCH", "/realm");
  if (event.siteId !== boundary.siteId) return fail("SITE_MISMATCH", "/siteId");
  if (!isDeepStrictEqual(event.source, boundary.authenticatedSource)) return fail("SOURCE_MISMATCH", "/source");
  if (!isDeepStrictEqual(event.actor, boundary.actor)) return fail("NOT_AUTHORIZED", "/actor");
  if (!isDeepStrictEqual(event.resource, boundary.resource)) return fail("TARGET_MISMATCH", "/resource");
  if (!isDeepStrictEqual(event.links, boundary.links)) return fail("INVALID_MESSAGE", "/links");
  if (event.action !== boundary.action || event.evidence !== boundary.evidence || !isDeepStrictEqual(event.record, boundary.record)) return fail("INVALID_MESSAGE", "/evidence");
  if (!isDeepStrictEqual(event.metadata, boundary.metadata) || !isDeepStrictEqual(event.change, boundary.change)) return fail("NOT_AUTHORIZED", "/metadata");
  return validateAuditEvent({ ...structuredClone(event), ingestTime: structuredClone(boundary.ingestTime) });
}

/** A join check for a known intent; it does not prove completeness or persistence. */
export function correlateAuditEvent(intentInput: unknown, eventInput: unknown): Result<AuditEvent> {
  const root = validateAuditEvent(intentInput);
  if (!root.ok) return root;
  const child = validateAuditEvent(eventInput);
  if (!child.ok) return child;
  const intent = root.value, event = child.value;
  if (intent.evidence !== "intent" || event.evidence === "intent" || event.links.intentEventId !== intent.eventId
    || event.links.correlationId !== intent.links.correlationId || event.links.jobId !== intent.links.jobId
    || event.links.sessionId !== intent.links.sessionId) return fail("INVALID_MESSAGE", "/links");
  if (!isDeepStrictEqual(event.actor, intent.actor)) return fail("NOT_AUTHORIZED", "/actor");
  if (!isDeepStrictEqual(event.realm, intent.realm) || event.executionMode !== intent.executionMode) return fail("REALM_MISMATCH", "/realm");
  if (event.siteId !== intent.siteId) return fail("SITE_MISMATCH", "/siteId");
  const related = intent.action === "capture.request" && ["motion.move", "gimbal.move", "capture.request"].includes(event.action);
  const lifecycle = (["live.grant", "live.start"].includes(intent.action) && event.action.startsWith("live."))
    || (intent.action === "control.session.start" && event.action.startsWith("control.session."))
    || (intent.action === "update.request" && ["update.request", "update.install", "update.rollback"].includes(event.action));
  if (event.action !== intent.action && !related && !lifecycle) return fail("INVALID_MESSAGE", "/action");
  if ((event.action === intent.action || lifecycle) && (event.resource.kind !== intent.resource.kind || event.resource.id !== intent.resource.id)) return fail("TARGET_MISMATCH", "/resource");
  return child;
}

export interface AuditOutcomeBinding {
  eventId: Id;
  sequence: Counter;
  action: AuditAction;
  sourceModule: "edge" | "motion" | "pod";
  resource: AuditResource;
  commandId: Id;
  requestSource: Identity;
  target: Identity;
  ingestTime: IngestTime;
}

/** Project a terminal, authenticated protocol record; never turn an acknowledgement into completion. */
export function auditFromProtocolOutcome(intentInput: unknown, outcomeInput: unknown, binding: AuditOutcomeBinding): Result<AuditEvent> {
  const root = validateAuditEvent(intentInput);
  if (!root.ok) return root;
  const parsed = validateMessage(outcomeInput);
  if (!parsed.ok) return parsed;
  const record = parsed.value;
  if (record.kind !== "event" || record.body.type !== "command.outcome") return fail("INVALID_MESSAGE", "/body/type");
  const body = record.body;
  if (!["completed", "failed", "cancelled"].includes(body.outcome)) return fail("INVALID_TRANSITION", "/body/outcome");
  if (body.commandId !== binding.commandId || body.correlationId !== root.value.links.correlationId
    || !isDeepStrictEqual(body.requestSource, binding.requestSource)) return fail("INVALID_MESSAGE", "/body");
  if (!isDeepStrictEqual(record.source, binding.target)) return fail("TARGET_MISMATCH", "/source");
  if (body.resourceId !== null && body.resourceId !== binding.resource.id) return fail("TARGET_MISMATCH", "/body/resourceId");
  const interrupted = body.outcome === "cancelled" || (body.outcome === "failed" && body.error?.code === "INTERRUPTED");
  const event: AuditEvent = {
    auditVersion: AUDIT_VERSION, eventId: binding.eventId, realm: record.realm, executionMode: record.executionMode,
    siteId: record.siteId, actor: structuredClone(root.value.actor), source: { module: binding.sourceModule, identity: structuredClone(record.source) },
    sequence: binding.sequence, sourceTime: structuredClone(record.sourceTime), ingestTime: structuredClone(binding.ingestTime),
    resource: structuredClone(binding.resource), action: binding.action, evidence: "device-outcome",
    outcome: interrupted ? "interrupted" : body.outcome === "completed" ? "succeeded" : "fail",
    effect: "device-reported", reason: interrupted ? (body.outcome === "cancelled" ? "cancelled" : "interrupted") : body.outcome === "completed" ? "completed" : "execution-failed",
    links: { ...structuredClone(root.value.links), intentEventId: root.value.eventId, causationEventId: root.value.eventId,
      commandId: binding.commandId, requestSource: structuredClone(binding.requestSource), target: structuredClone(binding.target) },
    record: { kind: "protocol-event", id: record.messageId }, metadata: {}, change: null,
  };
  return correlateAuditEvent(root.value, event);
}
