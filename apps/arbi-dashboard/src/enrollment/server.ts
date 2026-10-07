import { SiteRequestBoundary } from "@arbi/gredice";
import type { GrediceIdentityAdapter, ResourceResolver } from "@arbi/gredice";
import type { Realm } from "@arbi/protocol";
import { EnrollmentHttp } from "./http";
import { EnrollmentService } from "./service";
import { PostgresRegistryStore } from "./store";
import type { SqlDatabase } from "./store";

/** Server-only composition: current directory/resource adapters and a migrated cloud database are required. */
export function createEnrollmentServer(config: {
  realm: Realm; identity: GrediceIdentityAdapter; resolveResource: ResourceResolver;
  browserOrigins: readonly string[]; db: SqlDatabase; now?: () => number;
}): EnrollmentHttp {
  const store = new PostgresRegistryStore(config.db);
  return new EnrollmentHttp(new EnrollmentService(store, config.realm, config.now), new SiteRequestBoundary({
    identity: config.identity, resolveResource: config.resolveResource, browserOrigins: config.browserOrigins,
    auditAuthorization: (record, signal) => store.authorization(record, signal),
  }));
}
