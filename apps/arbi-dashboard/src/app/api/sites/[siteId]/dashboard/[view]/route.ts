import { dashboardRoute } from "../../../../../../dashboard/runtime";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ siteId: string; view: string }> }) {
  const params = await context.params;
  return dashboardRoute(request, params.siteId, params.view);
}
