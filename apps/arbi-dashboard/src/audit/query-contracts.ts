import { exact, id, milliseconds, JobError } from '../jobs/contracts';
export const QUERY_VERSION='arbi.audit-query/1.0';
export interface AuditQuery {
  fromMs:number;toMs:number;limit:number;cursor?:string;actorId?:string;deviceId?:string;
  action?:string;resourceId?:string;outcome?:string;correlationId?:string;sessionId?:string;
}
const fields=['fromMs','toMs','limit','cursor','actorId','deviceId','action','resourceId','outcome','correlationId','sessionId'];
export function auditQuery(input:unknown):AuditQuery {
  try{
    if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(k=>!fields.includes(k)))throw Error();
    const q=input as unknown as AuditQuery;milliseconds(q.fromMs,0,8_640_000_000_000_000);milliseconds(q.toMs,q.fromMs+1,q.fromMs+31*86400000);milliseconds(q.limit,1,100);
    for(const key of ['actorId','deviceId','action','resourceId','outcome','correlationId','sessionId'] as const)if(q[key]!==undefined)id(q[key]);
    if(q.cursor!==undefined && (typeof q.cursor!=='string' || q.cursor.length>2048))throw Error();return structuredClone(q);
  }catch{throw new JobError('INVALID_REQUEST');}
}
export type DataClass='audit'|'media'|'operational';
export function retentionExpired(receivedAtMs:number,nowMs:number,retainDays:number):boolean {
  return receivedAtMs<=nowMs-retainDays*86400000;
}
export interface RetentionPolicy {class:DataClass;revision:string;retainDays:number;identityMode:'pseudonymized';maxHoldDays:number}
export function retentionPolicy(input:unknown):RetentionPolicy {
  try{exact(input,['class','revision','retainDays','identityMode','maxHoldDays']);id(input.revision);milliseconds(input.retainDays,1,3650);milliseconds(input.maxHoldDays,1,365);
    if(!['audit','media','operational'].includes(String(input.class)) || input.identityMode!=='pseudonymized')throw Error();return structuredClone(input) as unknown as RetentionPolicy;
  }catch{throw new JobError('INVALID_REQUEST');}
}
