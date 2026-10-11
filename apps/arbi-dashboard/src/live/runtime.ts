import {isBranchPreview} from '../deployment';
import {jobFailure} from '../jobs/http';
import type {LiveHttp} from './http';
let configured:LiveHttp|undefined;
export function configureLive(runtime:LiveHttp){configured=runtime;}
export function liveRoute(request:Request,params:{siteId:string;action:string}){
  return (!isBranchPreview()?configured?.handle(request,params):undefined)??Promise.resolve(jobFailure(undefined));
}
