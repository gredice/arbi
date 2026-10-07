import { randomUUID } from "node:crypto";
import { isId } from "@arbi/gredice";
import type { RequestPolicy, SiteRequestBoundary } from "@arbi/gredice";
import { EnrollmentError } from "../enrollment/contracts";
import { readJsonBody } from "../enrollment/http";
import { MediaError } from "./contracts";
import type { MediaService } from "./service";

export function mediaFailure(error: unknown): Response {
  const code = error instanceof MediaError ? error.code : error instanceof EnrollmentError && error.code === "INVALID_REQUEST" ?
    "INVALID_REQUEST" : "UNAVAILABLE";
  return Response.json({ error: code, correlationId: randomUUID() }, { status: code === "UNAVAILABLE" ? 503 :
    code === "INVALID_REQUEST" ? 400 : code === "CONFLICT" ? 409 : code === "CAPACITY" ? 429 :
      code === "MISSING_OBJECT" ? 404 : code === "INVALID_OBJECT" ? 422 : 403,
    headers: { "cache-control": "private, no-store" } });
}
export class MediaHttp {
  constructor(readonly service: MediaService, readonly boundary: SiteRequestBoundary) {}
  async handle(request: Request, params: { siteId: string; action: string; imageId?: string }): Promise<Response> {
    const { siteId, action, imageId } = params;
    if (!isId(siteId) || (imageId !== undefined && !isId(imageId))) return mediaFailure(new MediaError("INVALID_REQUEST"));
    const imageAction = imageId !== undefined;
    if (!(imageAction ? ["metadata", "access"] : ["upload", "complete", "delete", "revoke", "cleanup"]).includes(action) ||
      request.method !== (action === "metadata" ? "GET" : "POST")) return mediaFailure(new MediaError("INVALID_REQUEST"));
    const policy: RequestPolicy = { siteId, surface: imageAction ? "media" : "http",
      capability: imageAction ? "still.read" : ["upload", "complete"].includes(action) ? "capture.request" : "configuration.write",
      ...(imageId ? { resource: { kind: "still", id: imageId } } : {}) };
    try {
      return await this.boundary.run(request, policy, async (context) => {
        try {
          const input = action === "metadata" ? null : await readJsonBody(request);
          const value = action === "metadata" ? await this.service.metadata(context) : action === "access" ? await this.service.access(context, input) :
            action === "upload" ? await this.service.upload(context, input) : action === "complete" ? await this.service.complete(context, input) :
              action === "delete" ? await this.service.delete(context, input) : action === "revoke" ? await this.service.revoke(context, input) :
                await this.service.cleanup(context, input);
          // Storage/signing can take time. Recheck the token, current directory and protected resource before exposing a capability.
          return this.boundary.run(request, policy, async () => Response.json(value));
        } catch (error) { return mediaFailure(error); }
      });
    } catch (error) { return mediaFailure(error); }
  }
}
