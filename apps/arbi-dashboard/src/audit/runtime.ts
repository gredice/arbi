import { auditFailure } from "./http";
import type { AuditHttp } from "./http";
import { isBranchPreview } from "../deployment";
import type { AuditQueryHttp } from './query-http';
let configured: AuditHttp | undefined;
let queries:AuditQueryHttp|undefined;
export function configureAudit(runtime: AuditHttp): void { configured = runtime; }
export function configureAuditQueries(runtime:AuditQueryHttp):void{queries=runtime;}
export function auditQueryRoute(request:Request,siteId:string,action:string):Promise<Response>{
  return (!isBranchPreview()?queries?.handle(request,{siteId,action}):undefined)??Promise.resolve(auditFailure(undefined));
}
export function auditRoute(request: Request, siteId: string): Promise<Response> {
  return (!isBranchPreview() ? configured?.handle(request,siteId) : undefined) ?? Promise.resolve(auditFailure(undefined));
}
