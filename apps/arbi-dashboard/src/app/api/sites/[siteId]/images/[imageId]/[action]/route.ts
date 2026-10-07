import { mediaRoute } from "../../../../../../../media/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
type Context = { params: Promise<{ siteId: string; imageId: string; action: string }> };
export async function POST(request: Request, context: Context) { return mediaRoute(request, await context.params); }
export async function GET(request: Request, context: Context) { return mediaRoute(request, await context.params); }
