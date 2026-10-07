import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { createIsolatedIdentityProvider } from "@arbi/gredice/testing";
import type { AuthorizedContext } from "@arbi/gredice";
import type { Command, Event, Realm } from "@arbi/protocol";
import { VERSION } from "../enrollment/contracts";
import type { Registry } from "../enrollment/contracts";
import { proofBytes } from "../enrollment/crypto";
import type { CurrentAuthority } from "./contracts";

export const realm: Realm = { environment: "test",namespaceId: "synthetic-jobs" };
export async function fixture(siteId = randomUUID()) {
  const identity = createIsolatedIdentityProvider(realm), keys = generateKeyPairSync("ed25519"), now = Date.now();
  const target = { deviceId: "edge-1",bootId: "boot-1",sessionId: "link-1" };
  const registry: Registry = { version: VERSION,realm,siteId,accountId: "account-1",configRevision: "config-1",hardwareDigest: "synthetic-digest",
    components: [],signals: [],challenges: [],devices: [{ id: target.deviceId,componentId: "edge-component",role: "edge",status: "active",parentDeviceId: null,
      replacesDeviceId: null,enrolledAtMs: now-1000,revokedAtMs: null,current: target,retiredIdentities: [],lastSeenAtMs: now,softwareRevision: "synthetic",
      appliedConfigRevision: "config-1",capabilities: [],credentials: [{ id: "credential-1",publicKey: keys.publicKey.export({ format: "der",type: "spki" }).toString("base64url"),createdAtMs: now-1000,
        expiresAtMs: now+900_000,revokedAtMs: null,lastSequence: 0 }] }] };
  identity.putSite(siteId,registry.accountId);
  const tokens = new Map<string,string>();
  async function human(actorId: string, capability: AuthorizedContext["capability"] = "manipulation.request") {
    identity.putPrincipal({ actor: { kind: "human",id: actorId },accountId: registry.accountId,member: true,
      sites: { [siteId]: { roles: ["operator","engineer"],serviceScopes: [],active: true,revision: "membership-1" } } });
    const issued = await identity.issue({ kind: "human",id: actorId });tokens.set(issued.sessionId,issued.token);
    const context = await identity.adapter.authorize(issued.token,capability,{ realm,siteId,accountId: registry.accountId,resource: { kind: "site",id: siteId },executionMode: "simulation" });
    return { ...issued,context };
  }
  const currentAuthority: CurrentAuthority = async (previous) => {
    try { return await identity.adapter.authorize(tokens.get(previous.sessionId) ?? "",previous.capability,
      { realm,siteId,accountId: registry.accountId,resource: { kind: "site",id: siteId },executionMode: "simulation" }); } catch { return null; }
  };
  let sequence = 0;
  const base = (): Omit<Event,"body"> => ({ protocol: "arbi/1.0",messageId: randomUUID(),realm,siteId,source: registry.devices[0].current!,sequence: String(++sequence),
    sourceTime: { utc: new Date().toISOString(),monotonicMs: 100_000+Date.now()-now,uncertaintyMs: 10 },ingestTime: null,kind: "event",executionMode: "simulation" });
  const snapshot = (): Event => {
    const e = base();
    return { ...e,body: { type: "state.snapshot",configRevision: registry.configRevision,capabilitiesRevision: "capabilities-1",capabilities: [],state: "Ready",
      eventCursor: { source: e.source,stream: "event",sequence: e.sequence },telemetryCursor: null,committedCursor: null,
      supportedCommands: ["motion.move","control.stop","camera.gimbal","camera.capture"],supportedProtocols: ["arbi/1.0"] } };
  };
  const outcome = (command: Command, status: "accepted" | "running" | "completed" | "failed" | "cancelled" = "completed"): Event => ({ ...base(),source: command.command.target,
    body: { type: "command.outcome",commandId: command.command.commandId,correlationId: command.command.correlationId,requestSource: command.source,outcome: status,
      error: status === "failed" ? { code: "EXECUTION_FAILED",retryable: false } : status === "cancelled" ? { code: "CANCELLED",retryable: false } : null,
      resourceId: status === "completed" && command.body.type === "camera.capture" ? command.body.resourceId : null } });
  const upload = (action: "snapshot" | "poll" | "outcome", payload: unknown) => {
    const issuedAtMs = Date.now();
    const unsigned = { version: "arbi.jobs-device/1.0",realm,siteId,deviceId: target.deviceId,credentialId: "credential-1",identity: registry.devices[0].current,
      issuedAtMs,expiresAtMs: issuedAtMs+10000,action,payload };
    return { ...unsigned,signature: sign(null,proofBytes(unsigned),keys.privateKey).toString("base64url") };
  };
  return { registry,identity,human,currentAuthority,snapshot,outcome,upload };
}
