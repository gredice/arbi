import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import type { Realm } from "@arbi/protocol";
import type { DirectorySnapshot, ResourceScope } from "./contracts.js";
import { GrediceIdentityAdapter } from "./identity.js";
import type { GrediceIdentityConfig } from "./identity.js";

export const realm: Realm = { environment: "test", namespaceId: "fixture-suite" };
export const scope: ResourceScope = { resource: { kind: "site", id: "site-a" }, realm,
  siteId: "site-a", accountId: "account-a", executionMode: "simulation" };
/** Synthetic Gredice profile, not provider acceptance. Secrets generated in memory and never logged. */
export function profile() {
  let nowMs = 2_000_000;
  const key = randomBytes(32);
  let snapshot: unknown = structuredClone({
    observedAtMs: nowMs,
    session: { id: "session-a", actor: { kind: "human", id: "human-a" }, realm,
      expiresAtMs: nowMs + 300_000, revoked: false },
    account: { id: "account-a", active: true, member: true },
    site: { id: "site-a", accountId: "account-a", realm, active: true, executionMode: "simulation" },
    membership: { active: true, revision: "membership-1", roles: ["operator"], serviceScopes: [] },
  } satisfies DirectorySnapshot);
  let reads = 0;
  const config: GrediceIdentityConfig = { realm, source: "gredice", issuer: "urn:gredice:issuer:fixture",
    audience: { human: "urn:gredice:audience:arbi:test:human", service: "urn:gredice:audience:arbi:test:service" },
    verificationKey: key, now: () => nowMs, dependencyTimeoutMs: 50,
    readDirectory: async () => { reads++; return structuredClone(snapshot); } };
  return {
    config, adapter: new GrediceIdentityAdapter(realm, config),
    now: () => nowMs, advance: (ms: number) => { nowMs += ms; },
    get reads() { return reads; },
    snapshot: () => snapshot as DirectorySnapshot,
    replace: (value: unknown) => { snapshot = value; },
    async token(claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}, wrongKey = false) {
      return new SignJWT({ iss: config.issuer, aud: config.audience.human, sub: "human-a", jti: "session-a",
        iat: 2_000, exp: 2_300, tokenUse: "arbi_access", accountId: "account-a", realm, ...claims })
        .setProtectedHeader({ alg: "HS256", ...header }).sign(wrongKey ? randomBytes(32) : key);
    },
  };
}
