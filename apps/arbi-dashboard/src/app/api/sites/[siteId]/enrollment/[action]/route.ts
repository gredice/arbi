import { enrollmentRoute } from "../../../../../../enrollment/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;
type Context = { params: Promise<{ siteId: string; action: string }> };
export async function POST(request: Request, context: Context) {
  return enrollmentRoute(request, await context.params);
}
export async function GET(request: Request, context: Context) {
  return enrollmentRoute(request, await context.params);
}
