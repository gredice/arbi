import { auditFailure } from "./http";
import type { AuditHttp } from "./http";
import { isBranchPreview } from "../deployment";
let configured: AuditHttp | undefined;
export function configureAudit(runtime: AuditHttp): void { configured = runtime; }
export function auditRoute(request: Request, siteId: string): Promise<Response> {
  return (!isBranchPreview() ? configured?.handle(request,siteId) : undefined) ?? Promise.resolve(auditFailure(undefined));
}
