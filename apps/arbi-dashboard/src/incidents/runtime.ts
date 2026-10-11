import { isBranchPreview } from '../deployment';
import { jobFailure } from '../jobs/http';
import type { IncidentHttp } from './http';
let configured:IncidentHttp|undefined;
export function configureIncidents(runtime:IncidentHttp){configured=runtime;}
export function incidentRoute(request:Request,params:{siteId:string;action:string}){
  return (!isBranchPreview()?configured?.handle(request,params):undefined)??Promise.resolve(jobFailure(undefined));
}
