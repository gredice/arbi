import { auditFailure } from "./http";
import type { AuditHttp } from "./http";
let configured: AuditHttp | undefined;
export function configureAudit(runtime: AuditHttp): void { configured = runtime; }
export function auditRoute(request: Request, siteId: string): Promise<Response> {
  return configured?.handle(request,siteId) ?? Promise.resolve(auditFailure(undefined));
}
