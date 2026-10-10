import { randomUUID } from "node:crypto";
import { isId } from "@arbi/gredice";
import type { SiteRequestBoundary } from "@arbi/gredice";
import { EnrollmentError } from "./contracts";
import type { EnrollmentService } from "./service";

const MAX_BODY_BYTES = 16_384;
// Reused by app-owned metadata endpoints; this reads only bounded JSON, never media bytes.
export { body as readJsonBody };
async function body(request: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 60_000) throw new EnrollmentError("INVALID_REQUEST");
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json" ||
    (request.headers.has("content-length") && Number(request.headers.get("content-length")) > maxBytes) || !request.body) {
    throw new EnrollmentError("INVALID_REQUEST");
  }
  const reader = request.body.getReader();
  const deadline = Date.now() + 5_000;
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      if (request.signal.aborted || Date.now() >= deadline) throw new EnrollmentError("INVALID_REQUEST");
      let timer: ReturnType<typeof setTimeout> | undefined;
      let part: ReadableStreamReadResult<Uint8Array>;
      try {
        part = await Promise.race([reader.read(), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new EnrollmentError("INVALID_REQUEST")), Math.max(1, deadline - Date.now()));
        })]);
      } finally { clearTimeout(timer); }
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) throw new EnrollmentError("INVALID_REQUEST");
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { void reader.cancel().catch(() => {}); throw new EnrollmentError("INVALID_REQUEST"); }
  finally { reader.releaseLock(); }
}
export function failure(error: unknown): Response {
  const code = error instanceof EnrollmentError ? error.code : "UNAVAILABLE";
  return Response.json({ error: code, correlationId: randomUUID() }, { status: code === "UNAVAILABLE" ? 503 :
    code === "INVALID_REQUEST" ? 400 : ["CONFLICT", "STALE_IDENTITY", "STALE_CONFIGURATION"].includes(code) ? 409 :
      code === "CAPACITY" ? 429 : 403, headers: { "cache-control": "private, no-store" } });
}
export class EnrollmentHttp {
  constructor(readonly service: EnrollmentService, readonly humans: SiteRequestBoundary) {}
  async handle(request: Request, { siteId, action }: { siteId: string; action: string }): Promise<Response> {
    if (!isId(siteId)) return failure(new EnrollmentError("INVALID_REQUEST"));
    try {
      if (action === "device") {
        if (request.method !== "POST" || request.headers.has("origin") || request.headers.has("authorization")) {
          throw new EnrollmentError("DENIED");
        }
        return Response.json(await this.service.device(siteId, await body(request)), { headers: { "cache-control": "private, no-store" } });
      }
      if (!["challenge", "complete", "revoke", "inventory"].includes(action) ||
        request.method !== (action === "inventory" ? "GET" : "POST")) throw new EnrollmentError("INVALID_REQUEST");
      return await this.humans.run(request, { siteId, surface: "http",
        capability: action === "inventory" ? "diagnostics.read" : "configuration.write" }, async (context) => {
        try { return Response.json(await this.service.human(context, action, action === "inventory" ? null : await body(request))); }
        catch (error) { return failure(error); }
      });
    } catch (error) { return failure(error); }
  }
}
