import { usageRoute } from '../../../../../../usage/runtime';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request,context:{params:Promise<{siteId:string;action:string}>}):Promise<Response>{
  return usageRoute(request,await context.params);
}
export const GET=POST;
