import {liveRoute} from '../../../../../../live/runtime';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request,context:{params:Promise<{siteId:string;action:string}>}){
  return liveRoute(request,await context.params);
}
