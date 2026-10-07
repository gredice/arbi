import { isResourceScope, sameRealm, SiteRequestBoundary } from "@arbi/gredice";
import type { GrediceIdentityAdapter, ResourceResolver } from "@arbi/gredice";
import type { Realm } from "@arbi/protocol";
import { EnrollmentHttp } from "./http";
import { EnrollmentService } from "./service";
import { PostgresRegistryStore } from "./store";
import type { SqlDatabase } from "./store";
import { EnrollmentError } from "./contracts";

/** Server-only composition: current directory/resource adapters and a migrated cloud database are required. */
export function createEnrollmentServer(config: {
  realm: Realm; identity: GrediceIdentityAdapter; resolveResource: ResourceResolver;
  browserOrigins: readonly string[]; db: SqlDatabase; now?: () => number;
}): EnrollmentHttp {
  if (!sameRealm(config.realm, config.identity.realm)) throw new EnrollmentError("DENIED");
  const store = new PostgresRegistryStore(config.db);
  return new EnrollmentHttp(new EnrollmentService(store, config.realm, config.now), new SiteRequestBoundary({
    identity: config.identity, browserOrigins: config.browserOrigins,
    resolveResource: async (query) => {
      const scope = await config.resolveResource(query);
      return isResourceScope(scope) && scope.executionMode === "simulation" ? scope : null;
    },
    auditAuthorization: (record, signal) => store.authorization(record, signal),
  }));
}
