import { randomUUID } from "node:crypto";
import { isId } from "@arbi/gredice";
import type { SiteRequestBoundary } from "@arbi/gredice";
import { EnrollmentError } from "../enrollment/contracts";
import { readJsonBody } from "../enrollment/http";
import { exact, id, JobError } from "./contracts";
import type { Job } from "./contracts";
import type { PostgresJobStore } from "./store";

export function jobFailure(error: unknown): Response {
  const code = error instanceof JobError ? error.code : error instanceof EnrollmentError && error.code === "INVALID_REQUEST" ? "INVALID_REQUEST" : "UNAVAILABLE";
  return Response.json({ error: code,correlationId: randomUUID() },{ status: code === "UNAVAILABLE" ? 503 : code === "INVALID_REQUEST" ? 400 :
    ["CONFLICT","STALE_FENCE"].includes(code) ? 409 : code === "CAPACITY" ? 429 : 403,headers: { "cache-control": "private, no-store" } });
}
/** Public state has explicit admission/receipt/execution/result provenance; no optimistic completed flag. */
export function jobView(job: Job) {
  return { id: job.id,cloudDisposition: job.cloudDisposition,deviceStatus: job.deviceStatus,terminal: job.terminal,
    command: job.command,expiresAtMs: job.expiresAtMs };
}
export class JobsHttp {
  constructor(readonly store: PostgresJobStore, readonly humans: SiteRequestBoundary) {}
  async handle(request: Request, params: { siteId: string; action: string }): Promise<Response> {
    const { siteId,action } = params;
    if (!isId(siteId)) return jobFailure(new JobError("INVALID_REQUEST"));
    try {
      if (action === "device") {
        if (request.method !== "POST" || request.headers.has("origin") || request.headers.has("authorization")) throw new JobError("DENIED");
        return Response.json(await this.store.device(siteId,await readJsonBody(request)),{ headers: { "cache-control": "private, no-store" } });
      }
      if (!["submit","status","cancel","acquire","renew","release","revoke"].includes(action) ||
        request.method !== (action === "status" ? "GET" : "POST")) throw new JobError("INVALID_REQUEST");
      return await this.humans.run(request,{ siteId,surface: "http",capability: action === "status" ? "state.read" : action === "revoke" ? "configuration.write" : "manipulation.request" },async (context) => {
        try {
          if (context.actor.kind !== "human") throw new JobError("DENIED");
          if (action === "status") {
            const url = new URL(request.url);if ([...url.searchParams.keys()].some((k) => k !== "jobId") || url.searchParams.getAll("jobId").length !== 1) throw new JobError("INVALID_REQUEST");
            const jobId = url.searchParams.get("jobId");id(jobId);
            return Response.json(jobView(await this.store.status(context,jobId)));
          }
          const body = await readJsonBody(request);
          if (action === "submit") return Response.json(jobView(await this.store.submit(context,body)),{ status: 202 });
          if (action === "cancel") {
            exact(body,["jobId"]);id(body.jobId);return Response.json(jobView(await this.store.status(context,body.jobId,true)));
          }
          const lease = await this.store.lease(context,action as "acquire" | "renew" | "release" | "revoke",body);
          return Response.json({ id: lease.id,fence: lease.fence,expiresAtMs: lease.expiresAtMs,endedAtMs: lease.endedAtMs });
        } catch (error) { return jobFailure(error); }
      });
    } catch (error) { return jobFailure(error); }
  }
}
