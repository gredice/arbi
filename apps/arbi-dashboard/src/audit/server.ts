import { AuditError } from "@arbi/audit";
import { isRealm } from "@arbi/gredice";
import type { Realm } from "@arbi/protocol";
import type { SqlDatabase } from "../enrollment/store";
import { AuditHttp } from "./http";
import { DeviceAuditIngest } from "./ingest";
import type { EvidenceResolver } from "./ingest";
import { PostgresAuditStore } from "./store";
export function createAuditServer(config: { db: SqlDatabase; realm: Realm; resolveEvidence: EvidenceResolver; now?: () => number }): AuditHttp {
  if (!isRealm(config.realm) || config.realm.environment === "production") throw new AuditError("DENIED");
  return new AuditHttp(new DeviceAuditIngest(new PostgresAuditStore(config.db,"audit-ingest",config.now),config.realm,config.resolveEvidence,config.now));
}
