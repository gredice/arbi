import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  admitAuditEvent, auditFromProtocolOutcome, correlateAuditEvent, parseAuditEvent, validateAuditEvent,
  MAX_AUDIT_EVENT_BYTES, validateMessage, type AuditBoundary, type AuditEvent, type AuditOutcomeBinding, type Event, type Result,
} from "./index.js";

interface Fixtures {
  valid: Record<string, AuditEvent>;
  invalid: Array<{ name: string; base: string; changes: Array<{ path: string[]; value: unknown }>; error: string }>;
  trace: { intent: string; modules: string[] };
}
const fixtures = JSON.parse(readFileSync(new URL("../fixtures/audit-events.json", import.meta.url), "utf8")) as Fixtures;
const schema = JSON.parse(readFileSync(new URL("../schema/audit-event.schema.json", import.meta.url), "utf8")) as { $defs: { AuditAction: { enum: string[] } } };
const fixture = (name: string): AuditEvent => structuredClone(fixtures.valid[name]);
function error(result: Result<unknown>, code: string): void {
  assert.equal(result.ok, false, JSON.stringify(result));
  if (!result.ok) assert.equal(result.error.code, code);
}
const boundary = (event: AuditEvent): AuditBoundary => ({
  action: event.action, evidence: event.evidence, record: structuredClone(event.record),
  realm: structuredClone(event.realm), executionMode: event.executionMode, siteId: event.siteId,
  authenticatedSource: structuredClone(event.source), actor: structuredClone(event.actor),
  resource: structuredClone(event.resource), links: structuredClone(event.links),
  metadata: structuredClone(event.metadata), change: structuredClone(event.change),
  ingestTime: { utc: "2026-10-07T00:00:01.000Z", uncertaintyMs: 5, deviceId: "cloud-1" },
});

for (const [name, value] of Object.entries(fixtures.valid)) test(`audit fixture round-trip: ${name}`, () => {
  const result = parseAuditEvent(JSON.stringify(value));
  assert.equal(result.ok, true, JSON.stringify(result));
  if (result.ok) assert.deepEqual(result.value, value);
});
for (const invalid of fixtures.invalid) test(`audit rejects: ${invalid.name}`, () => {
  const value = fixture(invalid.base);
  for (const change of invalid.changes) {
    let target: unknown = value;
    for (const segment of change.path.slice(0, -1)) target = (target as Record<string, unknown>)[segment];
    (target as Record<string, unknown>)[change.path.at(-1)!] = change.value;
  }
  error(validateAuditEvent(value), invalid.error);
});
test("audit fixture coverage includes the whole vocabulary, every actor and required uncertainty outcomes", () => {
  const values = Object.values(fixtures.valid);
  assert.deepEqual([...new Set(values.map((event) => event.action))].sort(), [...schema.$defs.AuditAction.enum].sort());
  assert.deepEqual([...new Set(values.map((event) => event.actor.kind))].sort(), ["device", "human", "service"]);
  for (const outcome of ["allow", "deny", "fail", "unknown", "interrupted"]) assert.ok(values.some((event) => event.outcome === outcome));
});
test("bounded JSON, malformed, non-object, missing and non-finite audit inputs", () => {
  error(parseAuditEvent("{"), "INVALID_JSON");
  error(parseAuditEvent(" ".repeat(MAX_AUDIT_EVENT_BYTES + 1)), "MESSAGE_TOO_LARGE");
  error(validateAuditEvent(null), "INVALID_MESSAGE");
  error(validateAuditEvent([]), "INVALID_MESSAGE");
  const input = fixture("media-delivery");
  input.metadata.byteCount = Infinity;
  error(validateAuditEvent(input), "INVALID_MESSAGE");
  const missing = fixture("motion") as Partial<AuditEvent>;
  delete missing.actor;
  error(validateAuditEvent(missing), "INVALID_MESSAGE");
});
test("rejected property names and values are not reflected in audit errors", () => {
  const input = fixture("motion") as AuditEvent & Record<string, unknown>;
  input["synthetic-secret-key"] = "synthetic-secret-value";
  const result = validateAuditEvent(input);
  error(result, "UNKNOWN_FIELD");
  assert.equal(JSON.stringify(result).includes("synthetic-secret"), false);
});
test("canonical JSON schema independently rejects secret fields at every object depth", () => {
  // Format validation belongs to the boundary runtime; this test isolates the language-neutral privacy rules.
  const ajv = new Ajv2020({ strict: true, strictTypes: false, validateFormats: false });
  ajv.addSchema(JSON.parse(readFileSync(new URL("../schema/message.schema.json", import.meta.url), "utf8")));
  const validate = ajv.compile(schema);
  const objects: unknown[] = [];
  const walk = (value: unknown): void => {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    objects.push(value);
    Object.values(value).forEach(walk);
  };
  const value = fixture("change"); walk(value);
  for (const object of objects) {
    const record = object as Record<string, unknown>;
    for (const key of ["token", "password", "privateKey", "rawMedia", "sensitiveConfig"]) {
      record[key] = "synthetic-sensitive-value";
      assert.equal(validate(value), false, key);
      delete record[key];
    }
  }
  assert.equal(validate(value), true);
});
test("trusted admission binds actor, source epoch, realm, resource, correlation and redaction context", () => {
  const input = fixture("motion"), trusted = boundary(input);
  const cases: Array<[AuditBoundary, string]> = [
    [{ ...trusted, actor: { kind: "service", id: input.actor.id } }, "NOT_AUTHORIZED"],
    [{ ...trusted, realm: { ...trusted.realm, environment: "production" } }, "REALM_MISMATCH"],
    [{ ...trusted, executionMode: "hardware" }, "REALM_MISMATCH"],
    [{ ...trusted, siteId: "another-site" }, "SITE_MISMATCH"],
    [{ ...trusted, authenticatedSource: { ...trusted.authenticatedSource, identity: { ...input.source.identity, bootId: "old-boot" } } }, "SOURCE_MISMATCH"],
    [{ ...trusted, resource: { ...input.resource, id: "another-resource" } }, "TARGET_MISMATCH"],
    [{ ...trusted, links: { ...input.links, correlationId: "another-operation" } }, "INVALID_MESSAGE"],
    [{ ...trusted, links: { ...input.links, commandId: "another-command" } }, "INVALID_MESSAGE"],
    [{ ...trusted, action: "motion.home" }, "INVALID_MESSAGE"],
    [{ ...trusted, evidence: "connection-loss" }, "INVALID_MESSAGE"],
    [{ ...trusted, record: { kind: "local-record", id: "other-record" } }, "INVALID_MESSAGE"],
    [{ ...trusted, links: { ...input.links, requestSource: { ...input.links.requestSource!, sessionId: "old-request-session" } } }, "INVALID_MESSAGE"],
  ];
  for (const [binding, code] of cases) error(admitAuditEvent(input, binding), code);
  const secretInApprovedField = fixture("change"), redacted = boundary(secretInApprovedField);
  secretInApprovedField.metadata.configRevision = "synthetic-password";
  error(admitAuditEvent(secretInApprovedField, redacted), "NOT_AUTHORIZED");
  const forgedChange = fixture("change"), expected = boundary(forgedChange);
  forgedChange.change!.after.revisionId = "unapproved-revision";
  error(admitAuditEvent(forgedChange, expected), "NOT_AUTHORIZED");
});
test("receipts are stamped by the receiver; admission retains source time and does not mutate input", () => {
  const input = fixture("motion"), original = structuredClone(input), trusted = boundary(input);
  const result = admitAuditEvent(input, trusted);
  assert.equal(result.ok, true);
  assert.deepEqual(input, original);
  if (result.ok) {
    assert.deepEqual(result.value.sourceTime, input.sourceTime);
    assert.deepEqual(result.value.ingestTime, trusted.ingestTime);
    result.value.actor.id = "changed";
    assert.equal(input.actor.id, original.actor.id);
  }
  error(admitAuditEvent(fixture("received"), boundary(fixture("received"))), "NOT_AUTHORIZED");
  const invalidReceipt = { ...trusted, ingestTime: { ...trusted.ingestTime, utc: "invalid" } };
  error(admitAuditEvent(input, invalidReceipt), "INVALID_MESSAGE");
});
test("a human capture intent joins each independent module outcome without merging their evidence", () => {
  const intent = fixture(fixtures.trace.intent);
  for (const name of fixtures.trace.modules) {
    const event = fixture(name);
    const result = correlateAuditEvent(intent, event);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(event.links.intentEventId, intent.eventId);
    assert.equal(event.links.correlationId, intent.links.correlationId);
    assert.deepEqual(event.actor, intent.actor);
    assert.deepEqual(event.source.identity, event.links.target);
  }
  for (const name of ["failure", "interrupted", "unknown", "lost-interrupted"]) {
    assert.equal(correlateAuditEvent(intent, fixture(name)).ok, true);
  }
});
test("correlation cannot silently rebind the initiator, operation, job, session, resource or environment", () => {
  const intent = fixture("capture-intent");
  const changes: Array<[(event: AuditEvent) => void, string]> = [
    [(event) => { event.actor.id = "other-human"; }, "NOT_AUTHORIZED"],
    [(event) => { event.links.correlationId = "other-chain"; }, "INVALID_MESSAGE"],
    [(event) => { event.links.intentEventId = "other-intent"; }, "INVALID_MESSAGE"],
    [(event) => { event.links.jobId = "other-job"; }, "INVALID_MESSAGE"],
    [(event) => { event.links.sessionId = "other-session"; }, "INVALID_MESSAGE"],
    [(event) => { event.resource.id = "other-capture"; }, "TARGET_MISMATCH"],
    [(event) => { event.siteId = "other-site"; }, "SITE_MISMATCH"],
    [(event) => { event.realm.namespaceId = "other-realm"; }, "REALM_MISMATCH"],
  ];
  for (const [change, code] of changes) { const event = fixture("capture"); change(event); error(correlateAuditEvent(intent, event), code); }
});

function protocolRecord(name: string, outcome: "completed" | "rejected" | "failed" | "cancelled" | "accepted" = "completed"): Event {
  const event = fixture(name);
  return {
    protocol: "arbi/1.0", messageId: event.record!.id, realm: event.realm, siteId: event.siteId,
    executionMode: event.executionMode, source: event.source.identity, sequence: event.sequence,
    sourceTime: event.sourceTime, ingestTime: null, kind: "event",
    body: { type: "command.outcome", commandId: event.links.commandId!, correlationId: event.links.correlationId,
      requestSource: event.links.requestSource!, outcome, resourceId: outcome === "completed" && event.action === "capture.request" ? event.resource.id : null,
      error: outcome === "rejected" ? { code: "FAULT_INHIBITED", retryable: false } : outcome === "failed" ? { code: "EXECUTION_FAILED", retryable: false } : outcome === "cancelled" ? { code: "CANCELLED", retryable: false } : null },
  };
}
const outcomeBinding = (name: string): AuditOutcomeBinding => {
  const event = fixture(name);
  return {
    eventId: event.eventId, sequence: event.sequence, action: event.action,
    sourceModule: event.source.module as AuditOutcomeBinding["sourceModule"], resource: event.resource,
    commandId: event.links.commandId!, requestSource: event.links.requestSource!, target: event.links.target!, ingestTime: null,
  };
};
test("each module's protocol 1.0 terminal record projects to the same human intent with safe references", () => {
  for (const name of fixtures.trace.modules) {
    const record = protocolRecord(name);
    assert.equal(validateMessage(record).ok, true);
    const result = auditFromProtocolOutcome(fixture("capture-intent"), record, outcomeBinding(name));
    assert.equal(result.ok, true, JSON.stringify(result));
    if (result.ok) assert.deepEqual(result.value, fixture(name));
  }
});
test("acknowledgements, forged outcome bindings and old source epochs never become audit success", () => {
  const intent = fixture("capture-intent"), binding = outcomeBinding("motion");
  error(auditFromProtocolOutcome(intent, protocolRecord("motion", "accepted"), binding), "INVALID_TRANSITION");
  const changes: Array<[(record: Event) => void, string]> = [
    [(record) => { record.source.bootId = "old-boot"; }, "TARGET_MISMATCH"],
    [(record) => { record.source.sessionId = "old-session"; }, "TARGET_MISMATCH"],
    [(record) => { if (record.body.type === "command.outcome") record.body.commandId = "other-command"; }, "INVALID_MESSAGE"],
    [(record) => { if (record.body.type === "command.outcome") record.body.correlationId = "other-chain"; }, "INVALID_MESSAGE"],
    [(record) => { if (record.body.type === "command.outcome") record.body.requestSource.sessionId = "old-request-session"; }, "INVALID_MESSAGE"],
    [(record) => { record.siteId = "other-site"; }, "SITE_MISMATCH"],
  ];
  for (const [change, code] of changes) { const record = protocolRecord("motion"); change(record); error(auditFromProtocolOutcome(intent, record, binding), code); }
  const mismatch = protocolRecord("capture");
  if (mismatch.body.type === "command.outcome") mismatch.body.resourceId = "other-capture";
  error(auditFromProtocolOutcome(intent, mismatch, outcomeBinding("capture")), "TARGET_MISMATCH");
});
test("failed and interrupted reports remain distinct; a later report supplements an unknown effect", () => {
  const intent = fixture("capture-intent");
  const failed = auditFromProtocolOutcome(intent, protocolRecord("failure", "failed"), outcomeBinding("failure"));
  assert.equal(failed.ok && failed.value.outcome, "fail");
  const interrupted = auditFromProtocolOutcome(intent, protocolRecord("interrupted", "cancelled"), outcomeBinding("interrupted"));
  assert.equal(interrupted.ok && interrupted.value.outcome, "interrupted");
  assert.equal(interrupted.ok && interrupted.value.reason, "cancelled");
  const interruptionReport = protocolRecord("motion", "failed");
  if (interruptionReport.body.type === "command.outcome") interruptionReport.body.error = { code: "INTERRUPTED", retryable: false };
  const sourceInterrupted = auditFromProtocolOutcome(intent, interruptionReport, outcomeBinding("motion"));
  assert.equal(sourceInterrupted.ok && sourceInterrupted.value.outcome, "interrupted");
  assert.equal(sourceInterrupted.ok && sourceInterrupted.value.reason, "interrupted");
  assert.equal(sourceInterrupted.ok && sourceInterrupted.value.metadata.protocolErrorCode, "INTERRUPTED");
  const unknown = fixture("unknown"), copy = structuredClone(unknown);
  assert.equal(unknown.effect, "unknown");
  assert.equal(auditFromProtocolOutcome(intent, protocolRecord("motion"), outcomeBinding("motion")).ok, true);
  assert.deepEqual(unknown, copy);
});
test("server allow and a device-local rejection remain separately attributable in the same trace", () => {
  const intent = fixture("capture-intent");
  const allow = fixture("append-fail");
  allow.links = { ...structuredClone(intent.links), causationEventId: intent.eventId };
  allow.outcome = "allow"; allow.reason = "authorized";
  assert.equal(correlateAuditEvent(intent, allow).ok, true);
  const denied = auditFromProtocolOutcome(intent, protocolRecord("device-rejected", "rejected"), outcomeBinding("device-rejected"));
  assert.equal(denied.ok, true, JSON.stringify(denied));
  if (denied.ok) assert.deepEqual(denied.value, fixture("device-rejected"));
  assert.equal(allow.effect, "none");
});
test("viewer grant, establishment, delivery, heartbeat and revocation share context while preserving evidence kinds", () => {
  const intent = fixture("grant");
  intent.eventId = "intent-live"; intent.evidence = "intent"; intent.outcome = "requested"; intent.reason = "requested";
  intent.links.intentEventId = intent.eventId; intent.links.causationEventId = null;
  const children = ["grant", "media-established", "media-delivery", "media-lost",
    Object.keys(fixtures.valid).find((name) => fixtures.valid[name].action === "live.heartbeat")!].map(fixture);
  const revoked = fixture("grant");
  revoked.eventId = "event-revoked"; revoked.action = "live.revoke"; revoked.evidence = "service-outcome";
  revoked.outcome = "succeeded"; revoked.reason = "revoked";
  children.push(revoked);
  for (const child of children) {
    child.links = { ...structuredClone(intent.links), causationEventId: intent.eventId };
    assert.equal(correlateAuditEvent(intent, child).ok, true);
    assert.equal(child.effect, "none");
  }
  const rebound = structuredClone(children[1]);
  rebound.links.sessionId = "other-viewer";
  error(correlateAuditEvent(intent, rebound), "INVALID_MESSAGE");
  rebound.links.sessionId = intent.links.sessionId; rebound.resource.id = "other-stream";
  error(correlateAuditEvent(intent, rebound), "TARGET_MISMATCH");
});
test("release publication and per-target installation/rollback keep separate authorized intent", () => {
  const intent = fixture("update-installed");
  intent.eventId = "intent-update"; intent.action = "update.request"; intent.evidence = "intent";
  intent.outcome = "requested"; intent.reason = "requested"; intent.effect = "none"; intent.record = null;
  intent.source = fixture("grant").source; intent.resource.deviceId = null;
  intent.links = { ...intent.links, intentEventId: intent.eventId, causationEventId: null, commandId: null, requestSource: null, target: null };
  for (const name of ["update-installed", "update-rollback"]) {
    const event = fixture(name);
    event.links = { ...event.links, intentEventId: intent.eventId, causationEventId: intent.eventId };
    assert.equal(correlateAuditEvent(intent, event).ok, true);
    assert.equal(event.record!.kind, "local-record");
    assert.equal(event.effect, "device-reported");
  }
  assert.equal(fixture("release").effect, "none");
  const serviceInsteadOfInstall = fixture("update-installed");
  serviceInsteadOfInstall.evidence = "service-outcome"; serviceInsteadOfInstall.source.module = "cloud";
  serviceInsteadOfInstall.record = null; serviceInsteadOfInstall.effect = "none";
  error(validateAuditEvent(serviceInsteadOfInstall), "INVALID_MESSAGE");
});
