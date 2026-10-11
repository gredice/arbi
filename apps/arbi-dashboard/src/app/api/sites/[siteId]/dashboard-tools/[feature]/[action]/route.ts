import { dashboardHistoryRoute } from '../../../../../../../dashboard/runtime';
export const runtime='nodejs';
type Context={params:Promise<{siteId:string;feature:string;action:string}>};
async function handle(request:Request,context:Context){const p=await context.params;return dashboardHistoryRoute(request,p.siteId,p.feature,p.action);}
export const GET=handle;
export const POST=handle;
