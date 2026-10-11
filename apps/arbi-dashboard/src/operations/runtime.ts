import { isBranchPreview } from '../deployment';
import { jobFailure } from '../jobs/http';
import type { OperationsHttp } from './server';
let configured:OperationsHttp|undefined;
/** Trusted composition only. No credentials, migrations or health fallback on app startup. */
export function configureOperations(runtime:OperationsHttp){configured=runtime;}
export function operationsRoute(request:Request,params:{siteId:string;action:string}){return (!isBranchPreview()?configured?.handle(request,params):undefined)??Promise.resolve(jobFailure(undefined));}
