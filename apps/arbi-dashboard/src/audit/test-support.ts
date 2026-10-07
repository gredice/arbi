import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AuditEvent } from "@arbi/protocol";
import type { Registry } from "../enrollment/contracts";
import { VERSION } from "../enrollment/contracts";
import { proofBytes } from "../enrollment/crypto";
import type { TrustedBinding } from "./store";

const fixtures = JSON.parse(readFileSync(new URL("../../../../packages/arbi-protocol/fixtures/audit-events.json",import.meta.url),"utf8"));
export const now = Date.parse("2026-10-07T12:00:00.000Z");
export function intent(id = "intent-capture", sequence = "1"): AuditEvent {
  const event: AuditEvent = structuredClone(fixtures.valid["capture-intent"]);
  event.eventId = id;event.links.intentEventId = id;event.sequence = sequence;return event;
}
export function authorization(root: AuditEvent): AuditEvent {
  return { ...structuredClone(root),eventId: `${root.eventId}-allow`,sequence: String(BigInt(root.sequence)+1n),
    evidence: "authorization",outcome: "allow",reason: "authorized",links: { ...root.links,causationEventId: root.eventId } };
}
export function deviceEvent(id = "event-edge",sequence = "1"): AuditEvent {
  return { ...structuredClone(fixtures.valid.edge),eventId: id,sequence };
}
export function binding(event: AuditEvent): TrustedBinding {
  return { realm: event.realm,siteId: event.siteId,executionMode: event.executionMode,authenticatedSource: event.source,
    actor: event.actor,resource: event.resource,links: event.links,action: event.action,evidence: event.evidence,
    record: event.record,metadata: event.metadata,change: event.change };
}
export function inventory() {
  const keys = generateKeyPairSync("ed25519"), e = deviceEvent();
  const registry: Registry = { version: VERSION,realm: e.realm,siteId: e.siteId,accountId: "synthetic-account",configRevision: "config-1",
    hardwareDigest: "synthetic-digest",components: [],signals: [],challenges: [],devices: [{
      id: e.source.identity.deviceId,componentId: "edge-component",role: "edge",status: "active",parentDeviceId: null,replacesDeviceId: null,
      enrolledAtMs: now-1000,revokedAtMs: null,current: e.source.identity,retiredIdentities: [],lastSeenAtMs: now,
      softwareRevision: "synthetic-software",appliedConfigRevision: "config-1",capabilities: [],credentials: [{
        id: "credential-1",publicKey: keys.publicKey.export({ format: "der",type: "spki" }).toString("base64url"),
        createdAtMs: now-1000,expiresAtMs: now+900_000,revokedAtMs: null,lastSequence: 0,
      }],
    }] };
  return { registry,upload(event: AuditEvent) {
    const unsigned = { version: "arbi.audit-upload/1.0",realm: e.realm,siteId: e.siteId,deviceId: "edge-1",credentialId: "credential-1",
      identity: registry.devices[0].current,issuedAtMs: now,expiresAtMs: now+60_000,event };
    return { ...unsigned,signature: sign(null,proofBytes(unsigned),keys.privateKey).toString("base64url") };
  } };
}
