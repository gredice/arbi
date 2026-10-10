import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { chmodSync } from 'node:fs';
import { canonical, checked, digest } from '@arbi/audit';
import type { Actor, AuditEvent, Identity, Realm } from '@arbi/protocol';

export type TransferClass='essential'|'media'|'diagnostic'|'artifact';
export interface TransferPolicy {
  revision:string; allowanceBytes:number; essentialBytes:number; maxTransferBytes:number;
  bytesPerSecond:number; essentialBytesPerSecond:number; concurrency:number; essentialConcurrency:number;
  unknownCoverage:'defer'|'allow'; maxAttempts:number; uploadWindows:Array<{startHourUtc:number;endHourUtc:number}>;
  stream:{maxBitrate:number;maxDurationMs:number;idleMs:number};
}
export interface TransferClock {epoch:string;monotonicMs:number;utcMs:number;reliable:boolean}
export interface UsageCheckpoint {
  period:string;startUtcMs:number;endUtcMs:number;revision:number;usedBytes:number;
  coverage:'complete'|'unknown';observedUtcMs:number;maxAgeMs:number;coveredCharges:string[];
}
export interface TransferRequest {
  id:string;class:TransferClass;direction:'upload'|'download';expectedBytes:number;
  artifactDigest:string|null;stream:boolean;bitrate:number|null;overrideId:string|null;
}
interface Transfer extends TransferRequest {
  period:string;state:'active'|'paused'|'complete'|'cancelled';remaining:number;offset:number;attempts:number;
  startedUtcMs:number;lastIntentUtcMs:number;pending:{id:string;bytes:number;offset:number}|null;
}
interface Override {id:string;class:Exclude<TransferClass,'essential'>;bytes:number;expiresUtcMs:number;actor:Actor}
interface Ledger {
  owner:{pid:number;token:string}|null;
  binding:string;policy:TransferPolicy;clock:TransferClock;usage:UsageCheckpoint|null;
  transfers:Record<string,Transfer>;charges:Array<{id:string;transferId:string;period:string;class:TransferClass;bytes:number;covered:boolean}>;
  overrides:Override[];audit:AuditEvent[];copied:string[];rate:{epoch:string;second:number;essential:number;discretionary:number};
}
export class TransferError extends Error {constructor(readonly code:string){super(code);}}
function fail(code:string):never{throw new TransferError(code);}
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof n==='number' && Number.isSafeInteger(n) && n>=min && n<=max;
const MAX_BYTES=1099511627776;
const id=(s:unknown):s is string=>typeof s==='string' && /^[A-Za-z0-9._:-]{1,128}$/.test(s);
export function validatePolicy(p:TransferPolicy):TransferPolicy {
  if(!id(p.revision) || !integer(p.allowanceBytes,0,MAX_BYTES) || !integer(p.essentialBytes,1,MAX_BYTES) || !integer(p.maxTransferBytes,1,67108864) ||
    !integer(p.bytesPerSecond,1,16777216) || !integer(p.essentialBytesPerSecond,1,65536) || !integer(p.concurrency,1,4) ||
    !integer(p.essentialConcurrency,1,2) || !['defer','allow'].includes(p.unknownCoverage) || !integer(p.maxAttempts,1,128) ||
    !Array.isArray(p.uploadWindows) || p.uploadWindows.length>24 || p.uploadWindows.some(w=>!integer(w.startHourUtc,0,23) || !integer(w.endHourUtc,1,24) || w.startHourUtc>=w.endHourUtc) ||
    !integer(p.stream.maxBitrate,1,16777216) || !integer(p.stream.maxDurationMs,1,900000) || !integer(p.stream.idleMs,1,30000))fail('INVALID_POLICY');
  return structuredClone(p);
}
/** Trusted simulation composition. A grant precedes every bounded transport attempt. No local stop path calls this ledger. */
export class TransferBudget {
  readonly #db:DatabaseSync;
  readonly #owner=randomUUID();
  #claimed=false;
  #closed=false;
  constructor(readonly options:{path:string;realm:Realm;siteId:string;source:Identity;policy:TransferPolicy;
    clock:()=>TransferClock;authorize:(actor:Actor)=>boolean}) {
    if(options.realm.environment!=='test' || !id(options.siteId))fail('NOT_AUTHORIZED');
    const policy=validatePolicy(options.policy),clock=options.clock();this.#validateClock(clock);
    this.#db=new DatabaseSync(options.path,{timeout:100});
    try {
      chmodSync(options.path,0o600);
      if(![0,1].includes(Number(this.#db.prepare('PRAGMA user_version').get()!.user_version)))fail('VERSION');
      this.#db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA fullfsync=ON; PRAGMA max_page_count=1024; CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY CHECK(id=1),body TEXT NOT NULL,hash TEXT NOT NULL);');
      const binding=canonical([options.realm,options.siteId,options.source.deviceId]);
      const initial:Ledger={owner:null,binding,policy,clock,usage:null,transfers:{},charges:[],overrides:[],audit:[],copied:[],rate:{epoch:clock.epoch,second:-1,essential:0,discretionary:0}};
      this.#db.prepare('INSERT OR IGNORE INTO ledger VALUES(1,?,?)').run(canonical(initial),digest(initial));
      this.#mutate(s=>{if(s.binding!==binding || canonical(s.policy)!==canonical(policy))fail('BINDING');
        if(s.owner){let alive=true;try{process.kill(s.owner.pid,0);}catch(e){alive=(e as NodeJS.ErrnoException).code!=='ESRCH';}if(alive)fail('OWNERSHIP');}
        s.owner={pid:process.pid,token:this.#owner};
        // Never resume transport or renew live intent at boot. Ambiguous attempts retain their maximum debit.
        for(const t of Object.values(s.transfers))if(t.state==='active'){t.state='paused';t.pending=null;}});
      this.#claimed=true;this.#db.exec('PRAGMA user_version=1');
    }catch(e){this.#db.close();throw e;}
  }
  close(){if(this.#closed)return;this.#db.exec('BEGIN IMMEDIATE');try{const s=this.#read();if(s.owner?.token!==this.#owner)fail('OWNERSHIP');s.owner=null;
    this.#db.prepare('UPDATE ledger SET body=?,hash=? WHERE id=1').run(canonical(s),digest(s));this.#db.exec('COMMIT');
  }catch(e){this.#db.exec('ROLLBACK');throw e;}finally{this.#closed=true;this.#db.close();}}
  #validateClock(c:TransferClock){if(!id(c.epoch) || !integer(c.monotonicMs) || !integer(c.utcMs) || !c.reliable)fail('CLOCK_UNKNOWN');}
  #read():Ledger {
    const row=this.#db.prepare('SELECT * FROM ledger WHERE id=1').get()!;
    const s=JSON.parse(String(row.body)) as Ledger;if(digest(s)!==row.hash)fail('TAMPER');return s;
  }
  #mutate<T>(run:(s:Ledger,c:TransferClock)=>T):T {
    this.#db.exec('BEGIN IMMEDIATE');
    try{const s=this.#read(),c=this.options.clock();this.#validateClock(c);
      if(this.#claimed && s.owner?.token!==this.#owner)fail('OWNERSHIP');
      if(c.utcMs<s.clock.utcMs || c.epoch===s.clock.epoch && c.monotonicMs<s.clock.monotonicMs)fail('CLOCK_REGRESSION');
      s.clock=c;const result=run(s,c);const body=canonical(s);if(Buffer.byteLength(body)>1048576)fail('CAPACITY');
      this.#db.prepare('UPDATE ledger SET body=?,hash=? WHERE id=1').run(body,digest(s));this.#db.exec('COMMIT');return structuredClone(result);
    }catch(e){this.#db.exec('ROLLBACK');throw e;}
  }
  #period(s:Ledger,c:TransferClock):UsageCheckpoint {
    const u=s.usage;if(!u || c.utcMs<u.startUtcMs || c.utcMs>=u.endUtcMs)fail('PERIOD_UNKNOWN');return u;
  }
  #spent(s:Ledger,period:string,essential=false) {
    return s.charges.filter(x=>x.period===period && (x.class==='essential')===essential && (essential || !x.covered)).reduce((n,x)=>n+x.bytes,0);
  }
  #reserved(s:Ledger,period:string,essential=false){return Object.values(s.transfers).filter(t=>t.period===period && (t.class==='essential')===essential && ['active','paused'].includes(t.state)).reduce((n,t)=>n+t.remaining,0);}
  #fresh(s:Ledger,c:TransferClock){const u=this.#period(s,c);return u.coverage==='complete' && c.utcMs-u.observedUtcMs<=u.maxAgeMs;}
  #gate(s:Ledger,c:TransferClock,t:TransferRequest){
    const u=this.#period(s,c);if(t.class!=='essential'){
      if(!this.#fresh(s,c) && s.policy.unknownCoverage==='defer')fail('COVERAGE_UNKNOWN');
      const hour=new Date(c.utcMs).getUTCHours();if(t.direction==='upload' && s.policy.uploadWindows.length && !s.policy.uploadWindows.some(w=>hour>=w.startHourUtc && hour<w.endHourUtc))fail('UPLOAD_WINDOW');
    }
    return u;
  }
  checkpoint(input:UsageCheckpoint){return this.#mutate((s,c)=>{
    const u=structuredClone(input);
    if(!id(u.period) || !integer(u.startUtcMs) || !integer(u.endUtcMs) || u.endUtcMs<=u.startUtcMs || u.endUtcMs-u.startUtcMs>35*86400000 ||
      !integer(u.revision,1) || !integer(u.usedBytes,0,MAX_BYTES) || !integer(u.observedUtcMs) || u.observedUtcMs>c.utcMs || !integer(u.maxAgeMs,1,3600000) ||
      !['complete','unknown'].includes(u.coverage) || !Array.isArray(u.coveredCharges) || u.coveredCharges.length>8192 || new Set(u.coveredCharges).size!==u.coveredCharges.length)fail('INVALID_USAGE');
    const old=s.usage;
    if(old && (u.startUtcMs<old.startUtcMs || u.period===old.period && (u.revision<=old.revision || u.usedBytes<old.usedBytes || u.startUtcMs!==old.startUtcMs || u.endUtcMs!==old.endUtcMs) ||
      u.period!==old.period && (u.startUtcMs<old.endUtcMs || c.utcMs<old.endUtcMs)))fail('USAGE_REPLAY');
    for(const chargeId of u.coveredCharges){const charge=s.charges.find(x=>x.id===chargeId && x.period===u.period);if(!charge || s.transfers[charge.transferId]?.pending?.id===chargeId)fail('INVALID_COVERAGE');charge.covered=true;}
    if(s.charges.filter(x=>x.period===u.period && x.covered).reduce((n,x)=>n+x.bytes,0)>u.usedBytes)fail('INVALID_COVERAGE');
    s.usage=u;return this.#status(s,c);
  });}
  #request(r:TransferRequest){if(!id(r.id) || !['essential','media','diagnostic','artifact'].includes(r.class) || !['upload','download'].includes(r.direction) ||
    !integer(r.expectedBytes,1) || !(r.artifactDigest===null || /^[a-f0-9]{64}$/.test(r.artifactDigest)) || typeof r.stream!=='boolean' ||
    !(r.bitrate===null || integer(r.bitrate,1)) || !(r.overrideId===null || id(r.overrideId)) || (r.class==='artifact')!==(r.artifactDigest!==null) || r.stream && (r.class!=='media' || r.bitrate===null))fail('INVALID_REQUEST');}
  start(input:TransferRequest){this.#request(input);return this.#mutate((s,c)=>{
    const r=structuredClone(input);const prior=s.transfers[r.id];if(prior){if(canonical(Object.fromEntries(Object.keys(r).map(k=>[k,prior[k as keyof Transfer]])))!==canonical(r))fail('ID_CONFLICT');return prior;}
    if(r.artifactDigest){const same=Object.values(s.transfers).find(t=>t.artifactDigest===r.artifactDigest && t.state!=='cancelled');
      if(same){if(same.expectedBytes!==r.expectedBytes || same.direction!==r.direction)fail('ID_CONFLICT');return same;}}
    if(Object.keys(s.transfers).length>=512 || r.expectedBytes>s.policy.maxTransferBytes)fail('CAPACITY');
    const u=this.#gate(s,c,r),essential=r.class==='essential';
    if(Object.values(s.transfers).filter(t=>t.state==='active' && (t.class==='essential')===essential).length>=(essential?s.policy.essentialConcurrency:s.policy.concurrency))fail('CONCURRENCY');
    if(r.stream && (r.bitrate!>s.policy.stream.maxBitrate || r.expectedBytes>Math.ceil(r.bitrate!*s.policy.stream.maxDurationMs/8000)))fail('STREAM_LIMIT');
    const extra=this.#override(s,c,r);const used=essential?0:u.usedBytes;
    if(used+this.#spent(s,u.period,essential)+this.#reserved(s,u.period,essential)+r.expectedBytes>(essential?s.policy.essentialBytes:s.policy.allowanceBytes)+extra)fail('QUOTA_EXHAUSTED');
    const t:Transfer={...r,period:u.period,state:'active',remaining:r.expectedBytes,offset:0,attempts:0,startedUtcMs:c.utcMs,lastIntentUtcMs:c.utcMs,pending:null};
    s.transfers[r.id]=t;return t;
  });}
  #override(s:Ledger,c:TransferClock,r:TransferRequest){if(r.overrideId===null)return 0;const o=s.overrides.find(x=>x.id===r.overrideId);
    if(!o || o.class!==r.class || c.utcMs>=o.expiresUtcMs || !this.options.authorize(o.actor))fail('OVERRIDE_EXPIRED');return o.bytes;}
  resume(transferId:string){return this.#mutate((s,c)=>{
    const t=s.transfers[transferId];if(!t || t.state!=='paused')fail('INVALID_STATE');this.#gate(s,c,t);
    if(t.period!==s.usage!.period || t.stream)fail('RESTART_REQUIRED');this.#override(s,c,t);
    const essential=t.class==='essential';if(Object.values(s.transfers).filter(x=>x.state==='active' && (x.class==='essential')===essential).length>=(essential?s.policy.essentialConcurrency:s.policy.concurrency))fail('CONCURRENCY');
    t.state='active';return t;
  });}
  intent(transferId:string){return this.#mutate((s,c)=>{const t=s.transfers[transferId];if(!t || t.state!=='active' || !t.stream || c.utcMs-t.lastIntentUtcMs>=s.policy.stream.idleMs)fail('STREAM_EXPIRED');t.lastIntentUtcMs=c.utcMs;});}
  grant(transferId:string,bytes:number){return this.#mutate((s,c)=>{
    const t=s.transfers[transferId];if(!t || t.state!=='active' || t.pending || !integer(bytes,1,65536))fail('INVALID_STATE');
    const u=this.#gate(s,c,t);if(t.period!==u.period)fail('PERIOD_CHANGED');const extra=this.#override(s,c,t);
    if(t.attempts>=s.policy.maxAttempts || s.charges.length>=8192)fail('ATTEMPT_LIMIT');
    if(t.stream && (c.utcMs-t.startedUtcMs>=s.policy.stream.maxDurationMs || c.utcMs-t.lastIntentUtcMs>=s.policy.stream.idleMs))fail('STREAM_EXPIRED');
    const essential=t.class==='essential',allowance=essential?s.policy.essentialBytes:s.policy.allowanceBytes;
    // Retry attempts are new bytes. Outstanding reservations cannot spend the same quota twice.
    const additional=Math.max(0,bytes-t.remaining);
    if((essential?0:u.usedBytes)+this.#spent(s,u.period,essential)+this.#reserved(s,u.period,essential)+additional>allowance+extra)fail('QUOTA_EXHAUSTED');
    const second=Math.floor(c.utcMs/1000);if(s.rate.second!==second)s.rate={epoch:c.epoch,second,essential:0,discretionary:0};
    const key=essential?'essential':'discretionary',limit=essential?s.policy.essentialBytesPerSecond:s.policy.bytesPerSecond;
    if(s.rate[key]+bytes>limit)fail('RATE_LIMIT');
    if(t.stream){const max=Math.floor(t.bitrate!*(c.utcMs-t.startedUtcMs+1000)/8000);const sent=s.charges.filter(x=>x.transferId===t.id).reduce((n,x)=>n+x.bytes,0);if(sent+bytes>max)fail('BITRATE_LIMIT');}
    s.rate[key]+=bytes;t.attempts++;t.remaining=Math.max(0,t.remaining-bytes);
    const charge={id:randomUUID(),transferId:t.id,period:t.period,class:t.class,bytes,covered:false};s.charges.push(charge);
    t.pending={id:charge.id,bytes,offset:t.offset};return t.pending;
  });}
  settle(transferId:string,chargeId:string,attemptedBytes:number,acceptedBytes:number){return this.#mutate(s=>{
    const t=s.transfers[transferId],p=t?.pending;if(!p || p.id!==chargeId || !integer(attemptedBytes,0,p.bytes) || !integer(acceptedBytes,0,attemptedBytes))fail('INVALID_RECEIPT');
    const charge=s.charges.find(x=>x.id===p.id)!;charge.bytes=attemptedBytes;
    t.remaining+=p.bytes-attemptedBytes;t.offset+=acceptedBytes;t.pending=null;return t;
  });}
  finish(transferId:string,cancel=false){return this.#mutate(s=>{const t=s.transfers[transferId];if(!t || t.pending)fail('INVALID_STATE');t.state=cancel?'cancelled':'complete';t.remaining=0;return t;});}
  pause(transferId:string){return this.#mutate(s=>{const t=s.transfers[transferId];if(!t || t.pending || t.state!=='active')fail('INVALID_STATE');t.state='paused';return t;});}
  override(input:Override){return this.#mutate((s,c)=>{
    const o=structuredClone(input);if(!id(o.id) || !['media','diagnostic','artifact'].includes(o.class) || !integer(o.bytes,1,s.policy.maxTransferBytes) ||
      !integer(o.expiresUtcMs,c.utcMs+1,c.utcMs+900000) || o.actor.kind!=='human' || !this.options.authorize(o.actor))fail('NOT_AUTHORIZED');
    if(s.overrides.some(x=>x.id===o.id) || s.overrides.length>=128 || s.audit.length>=1022)fail('CAPACITY');
    const eventId=randomUUID();const root:AuditEvent={auditVersion:'arbi.audit/1.0',eventId,realm:this.options.realm,executionMode:'simulation',siteId:this.options.siteId,
      actor:o.actor,source:{module:'edge',identity:this.options.source},sequence:String(s.audit.length+1),sourceTime:{utc:new Date(c.utcMs).toISOString(),uncertaintyMs:0,monotonicMs:c.monotonicMs},ingestTime:null,
      resource:{kind:'configuration',id:o.id,deviceId:this.options.source.deviceId},action:'configuration.change',evidence:'intent',outcome:'requested',reason:'requested',effect:'none',
      links:{correlationId:eventId,intentEventId:eventId,causationEventId:null,jobId:null,sessionId:null,commandId:null,requestSource:null,target:this.options.source},record:null,
      metadata:{permission:'configure',configRevision:o.id},change:null};
    const allow:AuditEvent={...root,eventId:randomUUID(),sequence:String(s.audit.length+2),evidence:'authorization',outcome:'allow',reason:'authorized',links:{...root.links,causationEventId:eventId}};
    s.audit.push(checked(root),checked(allow));s.overrides.push(o);return {override:o,auditIntentId:eventId};
  });}
  pendingAudit(){const s=this.#read();return s.audit.filter(e=>!s.copied.includes(e.eventId)).map(e=>structuredClone(e));}
  copyAudit(append:(event:AuditEvent)=>void){for(const e of this.pendingAudit()){append(e);this.#mutate(s=>{if(!s.copied.includes(e.eventId))s.copied.push(e.eventId);});}}
  getTransfer(transferId:string){return structuredClone(this.#read().transfers[transferId]??null);}
  #status(s:Ledger,c:TransferClock){const u=s.usage;return {policyRevision:s.policy.revision,period:u?.period??null,coverage:u && c.utcMs>=u.startUtcMs && c.utcMs<u.endUtcMs && this.#fresh(s,c)?'complete':'unknown',
    measuredUsedBytes:u?.usedBytes??null,unreconciledAttemptBytes:u?this.#spent(s,u.period):null,reservedBytes:u?this.#reserved(s,u.period):null,
    remainingBytes:u?Math.max(0,s.policy.allowanceBytes-u.usedBytes-this.#spent(s,u.period)-this.#reserved(s,u.period)):null,
    active:Object.values(s.transfers).filter(t=>t.state==='active').length,auditPending:s.audit.filter(e=>!s.copied.includes(e.eventId)).length,physicalActuationEnabled:false};}
  get status(){try{const c=this.options.clock();this.#validateClock(c);const s=this.#read();if(c.utcMs<s.clock.utcMs || c.epoch===s.clock.epoch && c.monotonicMs<s.clock.monotonicMs)fail('CLOCK_REGRESSION');return {...this.#status(s,c),degraded:false};}
    catch{return {degraded:true,policyRevision:null,period:null,coverage:'unknown',measuredUsedBytes:null,unreconciledAttemptBytes:null,reservedBytes:null,remainingBytes:null,active:null,auditPending:null,physicalActuationEnabled:false};}}
}
