import { jobFailure } from '../jobs/http';
import type { TelemetryHttp } from './http';
import { isBranchPreview } from '../deployment';
let configured:TelemetryHttp|undefined;
export function configureTelemetry(runtime:TelemetryHttp):void {configured=runtime;}
export function telemetryRoute(request:Request,params:{siteId:string;action:string}):Promise<Response> {
  return (!isBranchPreview() ? configured?.handle(request,params) : undefined)??Promise.resolve(jobFailure(undefined));
}
