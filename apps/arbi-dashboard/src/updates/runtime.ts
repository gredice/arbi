import { isBranchPreview } from '../deployment';
import { dashboardRequest,dashboardUpdateRoute } from '../dashboard/runtime';
/** Trusted private edge gateway. The edge SDK reauthorizes every call; this interface grants no target authority. */
export interface UpdateGateway {handle:(request:Request,siteId:string,action:string)=>Promise<Response>}
let configured:UpdateGateway|undefined;
export function configureUpdates(gateway:UpdateGateway){configured=gateway;}
export function updatesRoute(request:Request,params:{siteId:string;action:string}){
  return (!isBranchPreview()?configured?.handle(dashboardRequest(request),params.siteId,params.action):undefined)??dashboardUpdateRoute(request,params.siteId,params.action);
}
