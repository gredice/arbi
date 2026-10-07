import { SiteRequestBoundary, isResourceScope, sameRealm } from "@arbi/gredice";
import type { GrediceIdentityAdapter, ResourceResolver } from "@arbi/gredice";
import type { Realm } from "@arbi/protocol";
import type { SqlDatabase } from "../enrollment/store";
import { JobError } from "./contracts";
import type { CurrentAuthority } from "./contracts";
import { JobsHttp } from "./http";
import { PostgresJobStore } from "./store";

/** Trusted server composition. Requires current Gredice session/membership/resource reads at delivery after restart. */
export function createJobsServer(config: { db: SqlDatabase; realm: Realm; identity: GrediceIdentityAdapter;
  resolveSite: ResourceResolver; currentAuthority: CurrentAuthority; browserOrigins: readonly string[]; receiverUncertaintyMs?: number }): JobsHttp {
  if (!sameRealm(config.realm,config.identity.realm)) throw new JobError("DENIED");
  const resolveSite: ResourceResolver = async (query) => {
    const scope = await config.resolveSite(query);
    return isResourceScope(scope) && scope.executionMode === "simulation" ? scope : null;
  };
  const store = new PostgresJobStore(config.db,config.realm,async (previous,signal) => {
    const scope = await resolveSite({ realm: config.realm,siteId: previous.siteId,resource: { kind: "site",id: previous.siteId },signal });
    if (!isResourceScope(scope) || !sameRealm(scope.realm,config.realm) || scope.siteId !== previous.siteId ||
      scope.accountId !== previous.accountId || scope.resource.kind !== "site" || scope.resource.id !== previous.siteId) return null;
    return config.currentAuthority(previous,signal);
  },config.receiverUncertaintyMs);
  return new JobsHttp(store,new SiteRequestBoundary({ identity: config.identity,resolveResource: resolveSite,
    browserOrigins: config.browserOrigins,auditAuthorization: (record,signal) => store.authorization(record,signal) }));
}
