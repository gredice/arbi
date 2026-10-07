import { realtimeRoute } from '../../../../../../realtime/runtime';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ siteId: string; action: string }> }): Promise<Response> {
  return realtimeRoute(request,await context.params);
}
