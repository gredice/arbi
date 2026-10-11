import { auditQueryRoute } from '../../../../../../audit/runtime';
export const runtime='nodejs';
async function handle(request:Request,context:{params:Promise<{siteId:string;action:string}>}){const p=await context.params;return auditQueryRoute(request,p.siteId,p.action);}
export {handle as GET,handle as POST};
