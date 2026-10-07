import { jobFailure } from '../jobs/http';
import type { RealtimeHttp } from './server';
let configured: RealtimeHttp | undefined;
export function configureRealtime(runtime: RealtimeHttp) { configured=runtime; }
export function realtimeRoute(request: Request, params: { siteId: string; action: string }): Promise<Response> {
  return configured?.handle(request,params) ?? Promise.resolve(jobFailure(undefined));
}
