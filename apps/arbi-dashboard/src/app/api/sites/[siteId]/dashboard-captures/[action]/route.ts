import { dashboardCaptureRoute } from '../../../../../../dashboard/runtime';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request:Request,context:{params:Promise<{siteId:string;action:string}>}){const {siteId,action}=await context.params;return dashboardCaptureRoute(request,siteId,action);}
export const GET=handle;
export const POST=handle;
