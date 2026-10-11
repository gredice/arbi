import {dashboardLiveRoute} from '../../../../../../dashboard/runtime';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request,context:{params:Promise<{siteId:string;action:string}>}){const {siteId,action}=await context.params;return dashboardLiveRoute(request,siteId,action);}
