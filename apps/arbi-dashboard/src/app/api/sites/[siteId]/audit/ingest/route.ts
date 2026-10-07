import { auditRoute } from "../../../../../../audit/runtime";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ siteId: string }> }): Promise<Response> {
  return auditRoute(request,(await context.params).siteId);
}
