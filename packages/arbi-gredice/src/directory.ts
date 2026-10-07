import { isId, isObject } from "./contracts.js";
import type { AuthorizationDirectory, DirectoryQuery, DirectorySnapshot } from "./contracts.js";

/** The committed Gredice auth UserBase shape; global Gredice role is deliberately unused. */
export interface GrediceAccountUser {
  id: string;
  accountIds: readonly string[];
  isTemporary: boolean;
}
export interface GrediceServiceAccount {
  id: string;
  accountIds: readonly string[];
  active: boolean;
}
/** Protected ARBI bindings and session registry alongside the current Gredice account identity. */
export interface GrediceAuthorizationState {
  observedAtMs: number;
  human: GrediceAccountUser | null;
  service: GrediceServiceAccount | null;
  session: DirectorySnapshot["session"];
  account: { id: string; active: boolean };
  site: DirectorySnapshot["site"];
  membership: DirectorySnapshot["membership"];
}
/** Caller implements one consistent storage/API read, not independent browser-selected account lookups. */
export type ReadGrediceAuthorizationState = (query: DirectoryQuery) => Promise<unknown>;

export function createGrediceAuthorizationDirectory(readState: ReadGrediceAuthorizationState): AuthorizationDirectory {
  return async (query) => {
    const state = await readState(query);
    if (!isObject(state) || !isObject(state.account) || !isId(state.account.id)) return null;
    const identity = query.actor.kind === "human" ? state.human : state.service;
    if (!isObject(identity) || identity.id !== query.actor.id || !Array.isArray(identity.accountIds) ||
      identity.accountIds.length > 1_000 || !identity.accountIds.every(isId) ||
      (query.actor.kind === "human" && typeof identity.isTemporary !== "boolean") ||
      (query.actor.kind === "service" && typeof identity.active !== "boolean")) return null;
    const member = identity.accountIds.includes(state.account.id) &&
      (query.actor.kind === "human" ? identity.isTemporary === false : identity.active === true);
    // The identity adapter validates every remaining field at runtime. No global role is promoted to site authority.
    return { observedAtMs: state.observedAtMs, session: state.session, account: { id: state.account.id, active: state.account.active, member },
      site: state.site, membership: state.membership };
  };
}
