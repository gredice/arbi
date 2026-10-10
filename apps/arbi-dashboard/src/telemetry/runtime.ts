import { jobFailure } from '../jobs/http';
import type { TelemetryHttp } from './http';
let configured:TelemetryHttp|undefined;
export function configureTelemetry(runtime:TelemetryHttp):void {configured=runtime;}
export function telemetryRoute(request:Request,params:{siteId:string;action:string}):Promise<Response> {
  return configured?.handle(request,params)??Promise.resolve(jobFailure(undefined));
}
