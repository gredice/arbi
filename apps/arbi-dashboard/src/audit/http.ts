import { randomUUID } from "node:crypto";
import { AuditError } from "@arbi/audit/errors";
import type { DeviceAuditIngest } from "./ingest";

export function auditFailure(error: unknown): Response {
  const code = error instanceof AuditError ? error.code : "UNAVAILABLE";
  return Response.json({ error: code, correlationId: randomUUID() }, { status: code === "INVALID_REQUEST" ? 400 :
    code === "CONFLICT" ? 409 : code === "DENIED" ? 403 : 503, headers: { "cache-control": "private, no-store" } });
}
export class AuditHttp {
  constructor(readonly service: DeviceAuditIngest) {}
  async handle(request: Request, siteId: string): Promise<Response> {
    try {
      if (request.method !== "POST" || request.headers.has("origin") || request.headers.has("cookie") || request.headers.has("authorization") ||
        request.headers.get("content-type") !== "application/json" || !request.body) throw new AuditError("DENIED");
      const reader = request.body.getReader(); let bytes = 0; const chunks: Uint8Array[] = [];
      try { for (;;) { const part = await reader.read(); if (part.done) break;
        bytes += part.value.length; if (bytes > 12_288) { await reader.cancel(); throw new AuditError("INVALID_REQUEST"); } chunks.push(part.value);
      } } finally { reader.releaseLock(); }
      let input: unknown;
      try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new AuditError("INVALID_REQUEST"); }
      const receipt = await this.service.ingest(input,siteId);
      return Response.json(receipt,{ headers: { "cache-control": "private, no-store" } });
    } catch (error) { return auditFailure(error); }
  }
}
