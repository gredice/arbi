import { operationsRoute } from '../../../../../../operations/runtime';
export const runtime='nodejs';
export async function GET(request:Request,context:{params:Promise<{siteId:string;action:string}>}){return operationsRoute(request,await context.params);}
