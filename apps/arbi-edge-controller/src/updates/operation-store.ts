import { randomUUID } from 'node:crypto';
import { canonical,checked,digest } from '@arbi/audit';
import type { AuthorizationObservation,AuthorizedContext } from '@arbi/gredice';
import { isId } from '@arbi/gredice';
import { recoverUpdate,updateIntentAudit } from '@arbi/protocol';
import type { AuditEvent,AuditSource,Identity,Realm,ReleaseManifest,UpdateJournal } from '@arbi/protocol';
import type { RangeReceipt } from './range-source.js';
import { fields,reject,UpdateSecurityJournal } from './journal.js';

export interface OperationTarget {
  moduleId:string;manifest:ReleaseManifest;journal:UpdateJournal;intent:AuditEvent;transferId:string;
  phase:'pending'|'downloading'|'staged'|'trial'|'healthy'|'rolled-back'|'failed'|'recovery-required';
  receipts:RangeReceipt[];
}
export interface UpdateOperation {
  id:string;key:string;fingerprint:string;realm:Realm;siteId:string;releaseSetId:string;createdAtMs:number;deadlineMs:number;
  actor:AuthorizedContext['actor'];sessionId:string;authorizationId:string;allowMetered:boolean;
  targets:OperationTarget[];index:number;reason:string|null;state:'requested'|'working'|'paused'|'blocked'|'healthy'|'failed'|'rolled-back'|'recovery-required'|'cancelled';
  worker:{token:string;pid:number}|null;overrideId:string|null;
}
const activeWorkers=new Set<string>();
interface Record {kind:'authorization'|'operation'|'audit-copy';operation:UpdateOperation|null;audit:AuditEvent[]}
export interface OperationClock {utcMs:number;monotonicMs:number;uncertaintyMs:number;reliable:boolean}
/** Operation snapshots and their attributable audit deltas share a single acknowledged immutable SQLite transaction. */
export class UpdateOperationStore {
  readonly #journal:UpdateSecurityJournal;readonly source:AuditSource;
  constructor(readonly options:{path:string;realm:Realm;siteId:string;source:Identity;clock:()=>OperationClock;fault?:(point:'before-commit'|'after-commit')=>void}){
    if(options.realm.environment!=='test'||!isId(options.siteId)||![options.source.deviceId,options.source.bootId,options.source.sessionId].every(isId))reject('SCOPE_MISMATCH');
    this.options=Object.freeze({...options,realm:Object.freeze(structuredClone(options.realm)),source:Object.freeze(structuredClone(options.source))});
    this.source={module:'edge',identity:structuredClone(options.source)};
    this.#journal=new UpdateSecurityJournal(options.path,[options.realm,options.siteId,options.source.deviceId,'arbi.update-operations/1.0']);
    try{this.#records();}catch(e){this.#journal.close();throw e;}
  }
  close(){this.#journal.close();}
  readClock(){const c=this.options.clock();if(!c.reliable||!Number.isSafeInteger(c.monotonicMs)||c.monotonicMs<0||!Number.isSafeInteger(c.uncertaintyMs)||c.uncertaintyMs<1||c.uncertaintyMs>250)reject('CLOCK_UNCERTAIN');return c;}
  clock(){const c=this.readClock();this.#journal.checkpointClock({utcMs:c.utcMs,reliable:c.reliable});return c;}
  #records(raw=this.#journal.verify()):Record[]{
    return raw.map(input=>{
      fields(input,['kind','operation','audit']);if(!['authorization','operation','audit-copy'].includes(String(input.kind))||!Array.isArray(input.audit)||input.audit.length>32)reject('CORRUPT_JOURNAL');
      this.#audit(input.audit as AuditEvent[]);
      if((input.kind==='operation')!==(input.operation!==null))reject('CORRUPT_JOURNAL');
      if(input.operation!==null)this.#validate(input.operation as UpdateOperation);
      return input as unknown as Record;
    });
  }
  #validate(op:UpdateOperation){
    fields(op,['id','key','fingerprint','realm','siteId','releaseSetId','createdAtMs','deadlineMs','actor','sessionId','authorizationId','allowMetered','targets','index','reason','state','worker','overrideId']);
    if(!op||!isId(op.id)||!isId(op.key)||!isId(op.sessionId)||canonical(op.realm)!==canonical(this.options.realm)||op.siteId!==this.options.siteId||!Array.isArray(op.targets)||op.targets.length<1||op.targets.length>8||!Number.isSafeInteger(op.index)||op.index<0||op.index>op.targets.length||!Number.isSafeInteger(op.deadlineMs)||!Number.isSafeInteger(op.createdAtMs)||op.deadlineMs<=op.createdAtMs||op.deadlineMs-op.createdAtMs>300000||op.actor.kind!=='human')reject('INVALID_OPERATION');
    if(!/^[a-f0-9]{64}$/.test(op.fingerprint)||!isId(op.actor.id)||!isId(op.authorizationId)||!isId(op.releaseSetId)||typeof op.allowMetered!=='boolean'||!['requested','working','paused','blocked','healthy','failed','rolled-back','recovery-required','cancelled'].includes(op.state)||op.reason!==null&&!isId(op.reason)||op.overrideId!==null&&!isId(op.overrideId))reject('INVALID_OPERATION');
    if(op.worker){fields(op.worker,['token','pid']);if(!isId(op.worker.token)||!Number.isSafeInteger(op.worker.pid)||op.worker.pid<1)reject('INVALID_OPERATION');}
    for(const t of op.targets){fields(t,['moduleId','manifest','journal','intent','transferId','phase','receipts']);if(!isId(t.moduleId)||!isId(t.transferId)||t.manifest.target.moduleId!==t.moduleId||!recoverUpdate(t.journal).ok||!Array.isArray(t.receipts)||t.receipts.length>32||!['pending','downloading','staged','trial','healthy','rolled-back','failed','recovery-required'].includes(t.phase))reject('INVALID_OPERATION');const r=t.journal.request;this.#audit([t.intent]);for(const receipt of t.receipts){fields(receipt,['chargeId','offset','requestedBytes','observedPayloadBytes','acceptedPrefixBytes','reason','layer','prefixIntegrity','wireBytes']);if(!isId(receipt.chargeId)||!Number.isSafeInteger(receipt.offset)||receipt.offset<0||!Number.isSafeInteger(receipt.requestedBytes)||receipt.requestedBytes<1||receipt.requestedBytes>65536||!Number.isSafeInteger(receipt.observedPayloadBytes)||receipt.observedPayloadBytes<0||receipt.observedPayloadBytes>67108864||!Number.isSafeInteger(receipt.acceptedPrefixBytes)||receipt.acceptedPrefixBytes<0||receipt.acceptedPrefixBytes>Math.min(receipt.observedPayloadBytes,receipt.requestedBytes)||!['complete-range','interrupted-range','source-rejected','invalid-range','source-unavailable'].includes(receipt.reason)||receipt.layer!=='application-payload'||receipt.prefixIntegrity!=='pending-whole-artifact-verification'||receipt.wireBytes!==null)reject('INVALID_OPERATION');}if(canonical(r.scope)!==canonical({realm:op.realm,siteId:op.siteId,executionMode:'simulation'})||canonical(r.manifest)!==canonical(t.manifest)||canonical(r.auditContext.actor)!==canonical(op.actor)||r.auditContext.authorizationId!==op.authorizationId||r.auditContext.intentEventId!==t.intent.eventId)reject('INVALID_OPERATION');const intent=updateIntentAudit(t.journal,t.intent.source,t.intent.sourceTime,t.intent.sequence,op.sessionId);if(!intent.ok||canonical(intent.value)!==canonical(t.intent))reject('INVALID_OPERATION');}
  }
  #audit(events:AuditEvent[]){if(events.length>32)reject('RESOURCE_LIMIT');for(const input of events){const e=checked(input);if(canonical(e.realm)!==canonical(this.options.realm)||e.siteId!==this.options.siteId||e.executionMode!=='simulation')reject('SCOPE_MISMATCH');}}
  #operations(records:Record[]){const values=new Map<string,UpdateOperation>();for(const r of records)if(r.operation)values.set(r.operation.id,r.operation);if(values.size>32)reject('RESOURCE_LIMIT');return values;}
  #sequence(records:Record[]){const values=new Map<string,bigint>();for(const record of records)for(const event of record.audit){const key=canonical(event.source);if(BigInt(event.sequence)>(values.get(key)??0n))values.set(key,BigInt(event.sequence));}return (source=this.source)=>{const key=canonical(source),n=(values.get(key)??0n)+1n;if(n>=(1n<<64n))reject('RESOURCE_LIMIT');values.set(key,n);return String(n);};}
  #time(){const c=this.options.clock();return {utc:new Date(c.utcMs).toISOString(),uncertaintyMs:c.uncertaintyMs,monotonicMs:c.monotonicMs};}
  event(records:Record[],actor:AuditEvent['actor'],sessionId:string|null,action:AuditEvent['action']='authorization.check'):AuditEvent{
    const id=randomUUID();return checked({auditVersion:'arbi.audit/1.0',eventId:id,realm:this.options.realm,executionMode:'simulation',siteId:this.options.siteId,actor,source:this.source,sequence:this.#sequence(records)(),sourceTime:this.#time(),ingestTime:null,
      resource:{kind:'site',id:this.options.siteId,deviceId:null},action,evidence:'authorization',outcome:'allow',effect:'none',reason:'authorized',
      links:{correlationId:id,intentEventId:null,causationEventId:null,jobId:null,sessionId,commandId:null,requestSource:null,target:null},record:null,metadata:{},change:null});
  }
  authorization(observation:AuthorizationObservation):string{
    if(canonical(observation.realm)!==canonical(this.options.realm)||observation.decision==='authorized'&&observation.siteId!==this.options.siteId)reject('SCOPE_MISMATCH');
    this.clock();return this.#journal.mutate(raw=>{
      const records=this.#records(raw),event=this.event(records,observation.actor??{kind:'service',id:'unverified-update-attempt'},observation.sessionId);
      event.links.correlationId=observation.correlationId;event.outcome=observation.decision==='authorized'?'allow':'deny';event.reason=event.outcome==='allow'?'authorized':'not-authorized';
      event.metadata.permission=observation.capability==='update.request'?'update':observation.capability==='configuration.write'?'configure':'view';
      return {record:{kind:'authorization',operation:null,audit:[checked(event)]},result:event.eventId};
    },this.options.fault);
  }
  admit(build:(existing:UpdateOperation[],nextSequence:(source?:AuditSource)=>string)=>{operation:UpdateOperation;audit:AuditEvent[]}){
    this.clock();return this.#journal.mutate(raw=>{
      const records=this.#records(raw),values=this.#operations(records),next=build([...values.values()],this.#sequence(records));
      this.#validate(next.operation);const previous=values.get(next.operation.id);if(previous){for(const key of ['id','key','fingerprint','realm','siteId','releaseSetId','createdAtMs','deadlineMs','actor','sessionId','authorizationId','allowMetered'] as const)if(canonical(previous[key])!==canonical(next.operation[key]))reject('IDEMPOTENCY_CONFLICT');if(previous.targets.length!==next.operation.targets.length)reject('IDEMPOTENCY_CONFLICT');for(let i=0;i<previous.targets.length;i++){const before=previous.targets[i]!,after=next.operation.targets[i]!;for(const key of ['moduleId','manifest','intent'] as const)if(canonical(before[key])!==canonical(after[key]))reject('IDEMPOTENCY_CONFLICT');if(canonical({...before.journal,events:[]})!==canonical({...after.journal,events:[]})||canonical(after.journal.events.slice(0,before.journal.events.length))!==canonical(before.journal.events))reject('IDEMPOTENCY_CONFLICT');}}if(!values.has(next.operation.id)&&values.size>=32)reject('RESOURCE_LIMIT');this.#audit(next.audit);
      return {record:{kind:'operation',operation:next.operation,audit:next.audit},result:structuredClone(next.operation)};
    },this.options.fault);
  }
  update(id:string,work:(operation:UpdateOperation,nextSequence:(source?:AuditSource)=>string)=>AuditEvent[]=()=>[]){
    return this.admit((existing,next)=>{const original=existing.find(o=>o.id===id);if(!original)reject('NOT_FOUND');const operation=structuredClone(original),audit=work(operation,next);return {operation,audit};});
  }
  claim(id:string){const token=randomUUID();
    const claimed=this.admit((existing)=>{
      for(const operation of existing){if(!operation.worker)continue;let live=true;try{process.kill(operation.worker.pid,0);}catch(e){live=(e as NodeJS.ErrnoException).code!=='ESRCH';}if(live&&(operation.worker.pid!==process.pid||activeWorkers.has(operation.worker.token)))reject('OPERATION_BUSY');}
      const original=existing.find(o=>o.id===id);if(!original)reject('NOT_FOUND');const operation=structuredClone(original);operation.worker={token,pid:process.pid};operation.state='working';return {operation,audit:[]};
    }).worker!.token;activeWorkers.add(claimed);return claimed;
  }
  release(id:string,token:string){try{return this.update(id,op=>{if(op.worker?.token!==token)reject('STALE_WORKER');op.worker=null;return [];});}finally{activeWorkers.delete(token);}}
  copyAudit(events:AuditEvent[]){this.clock();return this.#journal.mutate(raw=>{const records=this.#records(raw),prior=new Map(records.flatMap(r=>r.audit).map(e=>[e.eventId,e]));const fresh=[];
    for(const input of events){const event=checked(input),old=prior.get(event.eventId);if(old){if(digest(old)!==digest(event))reject('AUDIT_CONFLICT');continue;}fresh.push(event);prior.set(event.eventId,event);}
    this.#audit(fresh);return {record:{kind:'audit-copy',operation:null,audit:fresh},result:fresh.length};});}
  get(id:string){const op=this.#operations(this.#records()).get(id);if(!op)reject('NOT_FOUND');return structuredClone(op);}
  list(){return [...this.#operations(this.#records()).values()].map(op=>structuredClone(op));}
  auditPage(after=0,through:number|null=null,limit=32){const events=this.audit();through??=events.length;if(!Number.isSafeInteger(after)||!Number.isSafeInteger(through)||after<0||through<after||through>events.length||!Number.isSafeInteger(limit)||limit<1||limit>64)reject('INVALID_REQUEST');const page:AuditEvent[]=[];let bytes=0,cursor=after;for(const e of events.slice(after,through)){const size=Buffer.byteLength(JSON.stringify(e));if(page.length>=limit||bytes+size>262144)break;page.push(e);bytes+=size;cursor++;}return {events:page,through,nextAfter:cursor<through?cursor:null,coverage:'selected-durable-update-producers'};}
  audit(){return this.#records().flatMap(r=>r.audit).map(e=>structuredClone(e));}
}
