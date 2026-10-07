import { randomUUID } from "node:crypto";
import { AUDIT_VERSION, parseAuditEvent } from "@arbi/protocol";
import type { AuditEvent, AuditSource } from "@arbi/protocol";
import type { AuthorizationObservation } from "@arbi/gredice";
import { EnrollmentError } from "./contracts";
import type { Registry, TransitionObservation } from "./contracts";

function event(state: Registry, source: AuditSource, monotonicMs: number, sequence: string): AuditEvent {
  const eventId = randomUUID();
  return { auditVersion: AUDIT_VERSION, eventId, realm: state.realm, executionMode: "simulation", siteId: state.siteId,
    actor: { kind: "service", id: "enrollment-service" }, source, sequence,
    // No measured UTC uncertainty is configured in this isolated source slice.
    sourceTime: { utc: null, uncertaintyMs: null, monotonicMs }, ingestTime: null,
    resource: { kind: "site", id: state.siteId, deviceId: null }, action: "authorization.check", evidence: "authorization",
    outcome: "allow", reason: "authorized", effect: "none",
    links: { correlationId: eventId, intentEventId: null, causationEventId: null, jobId: null, sessionId: null,
      commandId: null, requestSource: null, target: null }, record: null, metadata: {}, change: null };
}
function checked(value: AuditEvent): AuditEvent {
  const parsed = parseAuditEvent(JSON.stringify(value));
  if (!parsed.ok) throw new EnrollmentError("UNAVAILABLE");
  return parsed.value;
}
export function authorizationAudit(state: Registry, source: AuditSource, monotonicMs: number,
  record: AuthorizationObservation, nextSequence: () => string): AuditEvent {
  const result = event(state, source, monotonicMs, nextSequence());
  result.actor = record.actor ?? { kind: "service", id: `attempt-${randomUUID()}` };
  result.links.correlationId = record.correlationId;
  result.links.sessionId = record.sessionId;
  result.outcome = record.decision === "authorized" ? "allow" : "deny";
  result.reason = record.decision === "authorized" ? "authorized" : "not-authorized";
  result.metadata.permission = record.capability === "diagnostics.read" ? "view" : "configure";
  return checked(result);
}
/** A registry policy result is a cloud service result; it cannot establish a device/physical effect. */
export function lifecycleAudit(state: Registry, source: AuditSource, monotonicMs: number,
  record: TransitionObservation, nextSequence: () => string): AuditEvent[] {
  const result = event(state, source, monotonicMs, nextSequence());
  result.eventId = record.id;
  result.actor = record.actor;
  result.resource.deviceId = record.deviceId;
  result.links.correlationId = record.id;
  result.metadata.configRevision = state.configRevision;
  result.metadata.permission = record.kind === "connected" ? "login" :
    ["commands-admitted", "state-admitted"].includes(record.kind) ? "view" : "configure";
  if (["commands-admitted", "state-admitted"].includes(record.kind)) return [checked(result)];
  result.action = record.kind === "connected" ? "identity.login" : "authorization.check";
  const intent = { ...structuredClone(result), evidence: "intent" as const, outcome: "requested" as const,
    reason: "requested" as const, eventId: randomUUID() };
  intent.links.intentEventId = intent.eventId;
  result.sequence = nextSequence();
  result.links.intentEventId = intent.eventId;
  result.links.causationEventId = intent.eventId;
  result.evidence = "service-outcome";
  result.outcome = "succeeded";
  result.reason = "completed";
  return [checked(intent), checked(result)];
}
