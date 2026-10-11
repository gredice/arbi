import {incidentRoute} from '../../../../../../incidents/runtime';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{siteId:string;action:string}>}){
  return incidentRoute(request,await context.params);
}

export const POST=GET;
