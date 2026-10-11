import { updatesRoute } from '../../../../../../updates/runtime';
export const runtime='nodejs';
export async function GET(request:Request,context:{params:Promise<{siteId:string;action:string}>}){return updatesRoute(request,await context.params);}
export async function POST(request:Request,context:{params:Promise<{siteId:string;action:string}>}){return updatesRoute(request,await context.params);}
