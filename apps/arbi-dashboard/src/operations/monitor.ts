import { randomUUID } from 'node:crypto';
import { bounded } from '@arbi/gredice';
import type { SqlDatabase } from '../enrollment/store';
import { OPERATIONS_VERSION, SERVICES, type ProbeStatus, type Service } from './contracts';
export type Operation='health'|'migration'|'restore'|'transport';
export type Outcome='ok'|'denied'|'degraded'|'unavailable';
export interface OperationalLog {operation:Operation;outcome:Outcome;correlationId:string;atMs:number;durationMs:number}
export type Probe=(signal:AbortSignal)=>Promise<ProbeStatus>;
const operations=['health','migration','restore','transport'],outcomes=['ok','denied','degraded','unavailable'];
/** Process-local operational counters/logs, never the durable audit or accounting ledger. */
export class OperationsMonitor{
  readonly bootId=randomUUID();readonly #started=performance.now();readonly #logs:OperationalLog[]=[];
  readonly #counts=new Map<string,number>();#active=false;#dropped=0;readonly #pending=new Set<Service>();
  constructor(readonly probes:Partial<Record<Service,Probe>>={},readonly now=Date.now){}
  record(operation:Operation,outcome:Outcome,correlationId:string,durationMs:number){
    if(!operations.includes(operation)||!outcomes.includes(outcome)||!/^[A-Za-z0-9_-]{1,128}$/.test(correlationId)||!Number.isFinite(durationMs))return false;
    const key=`${operation}.${outcome}`;this.#counts.set(key,Math.min(2147483647,(this.#counts.get(key)??0)+1));
    if(this.#logs.length===64){this.#logs.shift();this.#dropped=Math.min(2147483647,this.#dropped+1);}
    this.#logs.push({operation,outcome,correlationId,atMs:this.now(),durationMs:Math.min(30000,Math.max(0,Math.floor(durationMs)))});return true;
  }
  async health(signal:AbortSignal){
    if(this.#active)return {version:OPERATIONS_VERSION,state:'degraded' as const,reason:'capacity' as const};
    this.#active=true;const at=performance.now(),correlationId=randomUUID();
    try{
      const services=await Promise.all(SERVICES.map(async service=>{
        if(this.#pending.has(service))return {service,status:'degraded' as ProbeStatus};
        if(!this.probes[service])return {service,status:'unconfigured' as ProbeStatus};let status:ProbeStatus='unavailable';
        try{status=await bounded(750,async deadline=>{
          if(signal.aborted)throw Error();deadline.throwIfAborted();this.#pending.add(service);
          let result:ProbeStatus;try{result=await this.probes[service]!(deadline);}finally{this.#pending.delete(service);}if(signal.aborted||!['ready','degraded','unavailable','unconfigured'].includes(result))throw Error();return result;
        });}catch{/* Dependencies cannot place exception text, credentials or URLs in this projection. */}
        return {service,status};
      }));
      const state=services.every(s=>s.status==='ready')?'ready':'degraded';this.record('health',state==='ready'?'ok':'degraded',correlationId,performance.now()-at);
      return {version:OPERATIONS_VERSION,bootId:this.bootId,correlationId,atMs:this.now(),uptimeMs:Math.floor(performance.now()-this.#started),state,services,
        counters:Object.fromEntries(this.#counts),logs:this.#logs.map(r=>({...r})),logLimit:64,droppedLogs:this.#dropped,scope:'this process boot; reset on restart; operational, not durable audit or carrier accounting'};
    }finally{this.#active=false;}
  }
}
/** Native database durability/schema/recovery check, requiring only metadata SELECT. */
export function databaseProbe(db:SqlDatabase):Probe{return async signal=>db.transaction(async sql=>{
  if(signal.aborted)throw Error();const row=(await sql.query<{fsync:string;gate:boolean;required:boolean;owner:boolean}>(`SELECT current_setting('fsync') fsync,
    to_regclass('public.arbi_operations_gate') IS NOT NULL AS gate,
    EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.arbi_audit_events') AND relowner=current_user::regrole) AS owner,
    to_regclass('public.arbi_device_registry') IS NOT NULL AND to_regclass('public.arbi_command_jobs') IS NOT NULL
    AND to_regclass('public.arbi_audit_events') IS NOT NULL AND to_regclass('public.arbi_realtime_sites') IS NOT NULL
    AND to_regclass('public.arbi_telemetry_heads') IS NOT NULL AND to_regclass('public.arbi_media_images') IS NOT NULL AS required`)).rows[0];
  if(!row?.required||row.fsync!=='on'||!row.gate||row.owner)return 'degraded';
  const gate=(await sql.query<{state:string}>('SELECT state FROM public.arbi_operations_gate WHERE singleton=true')).rows[0];return !signal.aborted&&gate?.state==='ready'?'ready':'degraded';
});}
