import { isBranchPreview } from '../deployment';
import { jobFailure } from '../jobs/http';
import type { UsageHttp } from './http';
let configured:UsageHttp|undefined;
export function configureUsage(server:UsageHttp):void{configured=server;}
export function usageRoute(request:Request,params:{siteId:string;action:string}):Promise<Response>{
  return (!isBranchPreview()?configured?.handle(request,params):undefined)??Promise.resolve(jobFailure(undefined));
}
