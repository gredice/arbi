import { jobFailure } from "./http";
import type { JobsHttp } from "./http";
let configured: JobsHttp | undefined;
/** Explicit server-only setup. No fixture authority or provider credentials are deployment defaults. */
export function configureJobs(runtime: JobsHttp): void { configured = runtime; }
export function jobsRoute(request: Request, params: { siteId: string; action: string }): Promise<Response> {
  return configured?.handle(request,params) ?? Promise.resolve(jobFailure(undefined));
}
