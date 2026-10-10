import { jobFailure } from '../jobs/http';
import type { RealtimeHttp } from './server';
import { isBranchPreview } from '../deployment';
let configured: RealtimeHttp | undefined;
export function configureRealtime(runtime: RealtimeHttp) { configured=runtime; }
export function realtimeRoute(request: Request, params: { siteId: string; action: string }): Promise<Response> {
  return (!isBranchPreview() ? configured?.handle(request,params) : undefined) ?? Promise.resolve(jobFailure(undefined));
}
