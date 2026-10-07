import { SiteRequestBoundary, isResourceScope, sameRealm } from "@arbi/gredice";
import type { GrediceIdentityAdapter, ResourceResolver } from "@arbi/gredice";
import type { Realm } from "@arbi/protocol";
import type { SqlDatabase } from "../enrollment/store";
import { MediaError } from "./contracts";
import type { CaptureResolver, PrivateObjectStore } from "./contracts";
import { MediaHttp } from "./http";
import { MediaService } from "./service";
import { PostgresMediaStore } from "./store";

/** Trusted explicit composition only. No fixture identity, site, database or object credentials are synthesized. */
export function createMediaServer(config: {
  realm: Realm; identity: GrediceIdentityAdapter; resolveSite: ResourceResolver; browserOrigins: readonly string[];
  db: SqlDatabase; objects: PrivateObjectStore; resolveCapture?: CaptureResolver; now?: () => number;
}): MediaHttp {
  if (!sameRealm(config.realm, config.identity.realm)) throw new MediaError("DENIED");
  const store = new PostgresMediaStore(config.db);
  return new MediaHttp(new MediaService(store, config.objects, config.resolveCapture, config.now), new SiteRequestBoundary({
    identity: config.identity, browserOrigins: config.browserOrigins,
    resolveResource: async (query) => {
      const own = await store.resolve(query.realm, query.siteId, query.resource.kind === "still" ? query.resource.id : undefined);
      if (!own) return null;
      const live = await config.resolveSite({ ...query, resource: { kind: "site", id: query.siteId } });
      return isResourceScope(live) && sameRealm(live.realm, own.realm) && live.siteId === own.siteId &&
        live.accountId === own.accountId && live.executionMode === own.executionMode ? own : null;
    },
    auditAuthorization: (record, signal) => store.authorization(record, signal),
  }));
}
