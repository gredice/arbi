import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual} from 'node:util';
import {digest} from '@arbi/audit';
import {bounded,type AuthorizedContext} from '@arbi/gredice';
import {validateAuditEvent,type AuditEvent,type AuditAction} from '@arbi/protocol';
import {scope,type TrustedBinding} from '../audit/store';
import {prove} from '../enrollment/crypto';
import {exact,id,JobError,milliseconds} from '../jobs/contracts';
import type {PostgresJobStore} from '../jobs/store';
import {LIVE_VERSION,LIVE_LEASE_MS,LIVE_MAX_LIFETIME_MS,liveSignal,policy,profile} from './contracts';
import type {LiveAdapter,LivePolicyEvaluator,LiveProfile,LiveViewer,MediaDeviceApproval,ProducerDemand,LiveSignal} from './contracts';
import {LiveTokens} from './tokens';
import {deliverySummary} from './delivery';
import {validateLiveProducerDemand} from '@arbi/protocol/live-demand';
type Tx=Parameters<Parameters<PostgresJobStore['transaction']>[1]>[0];
interface Producer {demand:ProducerDemand;deliveredGeneration:string|null;observedState:'leased'|'stopped'|null}
const binding=(e:AuditEvent):TrustedBinding=>({realm:e.realm,siteId:e.siteId,executionMode:e.executionMode,authenticatedSource:e.source,actor:e.actor,
  resource:e.resource,action:e.action,evidence:e.evidence,links:e.links,record:e.record,metadata:e.metadata,change:e.change});
/** Native durable session authority; external adapter work begins only after admission COMMIT. */
export class LiveStore{
  readonly tokens:LiveTokens;readonly profiles:readonly LiveProfile[];
  constructor(readonly jobs:PostgresJobStore,readonly adapter:LiveAdapter,key:Uint8Array,profiles:readonly LiveProfile[],readonly approveDevice:MediaDeviceApproval,readonly evaluatePolicy:LivePolicyEvaluator){
    if(jobs.realm.environment!=='test'||!profiles.length||profiles.length>4||typeof approveDevice!=='function'||typeof evaluatePolicy!=='function')throw new JobError('DENIED');
    this.profiles=profiles.map(profile);if(new Set(this.profiles.map(p=>p.id)).size!==profiles.length)throw new JobError('INVALID_REQUEST');this.tokens=new LiveTokens(jobs.realm,key);
  }
  async #emit(tx:Tx,root:AuditEvent,action:AuditAction,evidence:AuditEvent['evidence'],outcome:AuditEvent['outcome'],reason:AuditEvent['reason'],metadata:AuditEvent['metadata']={}){
    const event:AuditEvent={...structuredClone(root),eventId:randomUUID(),sequence:await this.jobs.nextAudit(tx),source:this.jobs.source,action,evidence,outcome,reason,effect:'none',ingestTime:null,
      sourceTime:{utc:null,uncertaintyMs:null,monotonicMs:Math.floor(performance.now()-this.jobs.startedAt)},metadata:{...root.metadata,...metadata},links:{...root.links,causationEventId:root.eventId}};
    await this.jobs.audit.stage(tx.sql,event,binding(event));
  }
  #device(tx:Tx,deviceId:string){const device=tx.registry.devices.find(d=>d.id===deviceId&&d.status==='active'&&d.revokedAtMs===null&&d.current&&d.appliedConfigRevision===tx.registry.configRevision);
    if(!device?.current||!this.approveDevice(structuredClone(tx.registry),structuredClone(device)))throw new JobError('DENIED');return device;}
  async #save(tx:Tx,v:LiveViewer){await tx.sql.query('UPDATE arbi_live_viewers SET ended_at_ms=$2,record=$3::jsonb WHERE id=$1',[v.id,v.endedAtMs,JSON.stringify(v)]);}
  async #close(tx:Tx,v:LiveViewer,reason:'timeout'|'ended'|'revoked'|'source-restarted'){
    if(v.endedAtMs!==null)return;v.endedAtMs=tx.now;v.endReason=reason;
    v.closure={authorityDurationUpperBoundMs:Math.max(0,Math.min(tx.now,v.expiresAtMs)-v.createdAtMs),deliveryCoverage:v.delivery?'partial':'unknown',playbackDurationMs:null,remoteStopObserved:false};await this.#save(tx,v);
    await this.#emit(tx,v.intent,reason==='timeout'?'live.timeout':reason==='ended'?'live.end':'live.revoke','service-outcome','succeeded',reason==='source-restarted'?'revoked':reason);
  }
  async #active(tx:Tx,deviceId:string){
    const rows=(await tx.sql.query<{record:LiveViewer}>('SELECT record FROM arbi_live_viewers WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND device_id=$4 AND ended_at_ms IS NULL LIMIT 5',[...scope(this.jobs.realm,tx.registry.siteId),deviceId])).rows;
    if(rows.length>4)throw new JobError('CAPACITY');let device;try{device=this.#device(tx,deviceId);}catch(error){if(!(error instanceof JobError)||error.code!=='DENIED')throw error;}
    const active:LiveViewer[]=[];for(const {record:v} of rows){
      if(v.expiresAtMs<=tx.now||v.absoluteExpiresAtMs<=tx.now)await this.#close(tx,v,'timeout');
      else if(!device||!isDeepStrictEqual(device.current,v.target)||v.configRevision!==tx.registry.configRevision)await this.#close(tx,v,'source-restarted');else active.push(v);
    }return active;
  }
  async #producer(tx:Tx,deviceId:string):Promise<Producer>{
    const row=(await tx.sql.query<{record:Producer}>('SELECT record FROM arbi_live_producers WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND device_id=$4',[...scope(this.jobs.realm,tx.registry.siteId),deviceId])).rows[0];
    if(!row)throw new JobError('DENIED');return row.record;
  }
  async #demand(tx:Tx,producer:Producer,active:LiveViewer[]){
    const original=producer.demand;
    const next={...original,viewers:active.length,profile:active[0]?.profile??original.profile,target:active[0]?.target??original.target,
      configRevision:active[0]?.configRevision??original.configRevision,expiresAtMs:active.length?Math.max(...active.map(v=>v.expiresAtMs)):original.viewers?tx.now:original.expiresAtMs};
    // One latest desired generation replaces pending work; no unbounded delivery queue.
    if(!isDeepStrictEqual({...original,generation:'0',issuedAtMs:0},{...next,generation:'0',issuedAtMs:0})){
      next.generation=await this.jobs.next(tx,'fence');next.issuedAtMs=tx.now;producer.demand=next;producer.deliveredGeneration=null;producer.observedState=null;
      await tx.sql.query('UPDATE arbi_live_producers SET record=$2::jsonb WHERE id=$1',[next.id,JSON.stringify(producer)]);
    }return producer;
  }
  async #owned(tx:Tx,context:AuthorizedContext,sessionId:string){id(sessionId);await this.jobs.authority(tx,context);
    const row=(await tx.sql.query<{record:LiveViewer}>('SELECT record FROM arbi_live_viewers WHERE id=$1 AND environment=$2 AND namespace_id=$3 AND site_id=$4',[sessionId,...scope(this.jobs.realm,context.siteId)])).rows[0];
    if(!row||row.record.authority.actor.id!==context.actor.id||row.record.authority.sessionId!==context.sessionId)throw new JobError('DENIED');return row.record;
  }
  /** Private frame-reference sink hook, never mounted as a media HTTP route.
   * Read the existing grants and current authority; mint no new viewer session. */
  async inspectFrameRecipients(input:ProducerDemand){
    validateLiveProducerDemand(input);if(!isDeepStrictEqual(input.realm,this.jobs.realm))throw new JobError('DENIED');
    return this.jobs.transaction(input.siteId,async tx=>{
      const active=await this.#active(tx,input.target.deviceId),producer=await this.#producer(tx,input.target.deviceId),allowed:LiveViewer[]=[];
      for(const v of active){try{
        await this.jobs.authority(tx,v.currentAuthority);
        const current=await this.#policy(tx,v.currentAuthority,v.target.deviceId,v.profile,Math.max(0,active.length-1));
        if(!current.allow){await this.#close(tx,v,'revoked');continue;}allowed.push(v);
      }catch(error){if(!(error instanceof JobError)||error.code!=='DENIED')throw error;await this.#close(tx,v,'revoked');}}
      const current:LiveViewer[]=[];
      // Policy evaluation can await remote work. Recheck authority and each
      // independent deadline after all evaluations, before admitting a frame.
      for(const v of allowed){try{await this.jobs.authority(tx,v.currentAuthority);
        if(v.expiresAtMs<=tx.now||v.absoluteExpiresAtMs<=tx.now)await this.#close(tx,v,'timeout');else current.push(v);
      }catch(error){if(!(error instanceof JobError)||error.code!=='DENIED')throw error;await this.#close(tx,v,'revoked');}}
      const latest=(await this.#demand(tx,producer,current)).demand;
      const authorized=isDeepStrictEqual(latest,input)&&input.expiresAtMs>tx.now&&current.length>0;
      return {authorized,reason:authorized?null:'current-demand-required',demand:structuredClone(latest),
        recipients:authorized?current.map(v=>({id:v.id,epoch:v.epoch,expiresAtMs:v.expiresAtMs,actor:structuredClone(v.authority.actor),sessionId:v.authority.sessionId,intentEventId:v.intent.eventId})):[]};
    });
  }
  async #policy(tx:Tx,context:AuthorizedContext,deviceId:string,p:LiveProfile,count:number){
    const device=this.#device(tx,deviceId),result=policy(await bounded(750,signal=>this.evaluatePolicy({context:structuredClone(context),device:structuredClone(device),profile:structuredClone(p),sharedUpstream:count>0,viewers:count+1,signal})));
    await this.jobs.tick(tx);return result.allow&&(result.maxUpstreamBps===null||result.maxUpstreamBps<p.maxUpstreamBps||result.remainingBytes==='0')?{...result,allow:false,reason:'profile-denied' as const}:result;
  }
  async start(context:AuthorizedContext,input:unknown){
    exact(input,['key','deviceId','profileId']);id(input.key);id(input.deviceId);id(input.profileId);
    if(context.actor.kind!=='human'||context.capability!=='live.view')throw new JobError('DENIED');
    const request={...input,humanSessionId:context.sessionId},fingerprint=digest(request);
    const viewer=await this.jobs.transaction(context.siteId,async tx=>{
      let authority=await this.jobs.authority(tx,context);const device=this.#device(tx,String(input.deviceId));
      const p=this.profiles.find(p=>p.id===input.profileId);if(!p)throw new JobError('DENIED');
      const active=await this.#active(tx,device.id);
      const duplicate=(await tx.sql.query<{fingerprint:string;record:LiveViewer}>('SELECT fingerprint,record FROM arbi_live_viewers WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND actor_id=$4 AND request_key=$5',[...scope(this.jobs.realm,context.siteId),context.actor.id,input.key])).rows[0];
      if(duplicate){if(duplicate.fingerprint!==fingerprint)throw new JobError('CONFLICT');return duplicate.record;}
      const counts=(await tx.sql.query<{total:string;active:string}>(`SELECT count(*)::text total,count(*) FILTER(WHERE ended_at_ms IS NULL AND (record->>'expiresAtMs')::bigint>$4 AND
        (record->>'absoluteExpiresAtMs')::bigint>$4)::text active FROM arbi_live_viewers WHERE environment=$1 AND namespace_id=$2 AND site_id=$3`,[...scope(this.jobs.realm,context.siteId),tx.now])).rows[0];
      if(Number(counts.total)>=4096||Number(counts.active)>=16||active.length>=p.maxViewers)throw new JobError('CAPACITY');
      if(active.some(v=>v.profile.id!==p.id))throw new JobError('CONFLICT');
      let producer=(await tx.sql.query<{record:Producer}>('SELECT record FROM arbi_live_producers WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND device_id=$4',[...scope(this.jobs.realm,context.siteId),device.id])).rows[0]?.record;
      if(!producer){const count=Number((await tx.sql.query<{n:string}>('SELECT count(*)::text n FROM arbi_live_producers WHERE environment=$1 AND namespace_id=$2 AND site_id=$3',scope(this.jobs.realm,context.siteId))).rows[0].n);if(count>=32)throw new JobError('CAPACITY');
        producer={demand:{version:LIVE_VERSION,realm:this.jobs.realm,siteId:context.siteId,id:randomUUID(),generation:await this.jobs.next(tx,'fence'),target:device.current!,configRevision:tx.registry.configRevision,profile:p,viewers:0,issuedAtMs:tx.now,expiresAtMs:tx.now,sharedUpstream:true},deliveredGeneration:null,observedState:null};
        await tx.sql.query('INSERT INTO arbi_live_producers VALUES($1,$2,$3,$4,$5,$6::jsonb)',[producer.demand.id,...scope(this.jobs.realm,context.siteId),device.id,JSON.stringify(producer)]);
      }
      const decision=await this.#policy(tx,authority,device.id,p,active.length),viewerId=randomUUID();
      authority=await this.jobs.authority(tx,authority);
      const intent=await this.jobs.event(tx,authority,'live.grant',{kind:'live-session',id:viewerId,deviceId:device.id},{target:device.current!});intent.metadata.permission='view';intent.metadata.grantId=viewerId;
      const sessionExpiry=authority.sessionExpiresAtMs??authority.expiresAtMs;
      if(!Number.isSafeInteger(sessionExpiry)||sessionExpiry<authority.expiresAtMs)throw new JobError('DENIED');
      const v:LiveViewer={version:LIVE_VERSION,id:viewerId,producerId:producer.demand.id,authority,currentAuthority:authority,target:device.current!,configRevision:tx.registry.configRevision,profile:p,policy:decision,
        createdAtMs:tx.now,expiresAtMs:Math.min(tx.now+LIVE_LEASE_MS,authority.expiresAtMs),absoluteExpiresAtMs:Math.min(tx.now+LIVE_MAX_LIFETIME_MS,sessionExpiry),epoch:1,endedAtMs:decision.allow?null:tx.now,endReason:decision.allow?null:'policy-denied',intent,signal:null,
        policyHistory:[{epoch:1,atMs:tx.now,policy:structuredClone(decision),viewers:active.length+1,sharedUpstream:active.length>0}]};
      if(decision.allow){await this.jobs.admit(tx,intent);await this.#emit(tx,intent,'live.grant','access-grant','allow','authorized');}
      else{await this.jobs.audit.stage(tx.sql,intent,binding(intent));await this.#emit(tx,intent,'live.grant','authorization','deny','not-authorized');}
      await tx.sql.query('INSERT INTO arbi_live_viewers VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)',[v.id,...scope(this.jobs.realm,context.siteId),device.id,context.actor.id,input.key,fingerprint,intent.eventId,v.producerId,v.endedAtMs,JSON.stringify(v)]);
      await this.#demand(tx,producer,decision.allow?[...active,v]:active);return v;
    });return this.#view(viewer);
  }
  async #view(v:LiveViewer){return {version:LIVE_VERSION,id:v.id,deviceId:v.target.deviceId,configRevision:v.configRevision,producerId:v.producerId,profile:v.profile,policy:v.policy,expiresAtMs:v.expiresAtMs,absoluteExpiresAtMs:v.absoluteExpiresAtMs,
    endedAtMs:v.endedAtMs,endReason:v.endReason,epoch:v.epoch,admission:v.endedAtMs===null?'granted':'closed',observedConnection:v.observedConnection??'unobserved',observationEventId:v.observationEventId??null,browserAdvisory:v.browserAdvisory??null,delivery:v.delivery??null,closure:v.closure??null,token:v.endedAtMs===null&&v.expiresAtMs>Date.now()?await this.tokens.issue(v):null};}
  async action(context:AuthorizedContext,action:'state'|'renew'|'end'|'revoke',input:unknown){
    exact(input,action==='renew'?['sessionId','token']:['sessionId']);id(input.sessionId);
    if(context.actor.kind!=='human'||context.capability!==(action==='revoke'?'configuration.write':'live.view'))throw new JobError('DENIED');
    const v=await this.jobs.transaction(context.siteId,async tx=>{
      let viewer:LiveViewer,revokeIntent:AuditEvent|undefined;
      if(action==='revoke'){await this.jobs.authority(tx,context);const row=(await tx.sql.query<{record:LiveViewer}>('SELECT record FROM arbi_live_viewers WHERE id=$1 AND environment=$2 AND namespace_id=$3 AND site_id=$4',[input.sessionId,...scope(this.jobs.realm,context.siteId)])).rows[0];if(!row)throw new JobError('DENIED');viewer=row.record;
        if(viewer.endedAtMs===null){revokeIntent=await this.jobs.event(tx,context,'live.revoke',viewer.intent.resource);revokeIntent.metadata.permission='configure';await this.jobs.admit(tx,revokeIntent);}
      }else viewer=await this.#owned(tx,context,String(input.sessionId));
      const active=await this.#active(tx,viewer.target.deviceId);viewer=active.find(v=>v.id===viewer.id)??(await tx.sql.query<{record:LiveViewer}>('SELECT record FROM arbi_live_viewers WHERE id=$1',[viewer.id])).rows[0].record;
      if(action==='end'||action==='revoke')await this.#close(tx,viewer,action==='end'?'ended':'revoked');
      if(revokeIntent)await this.#emit(tx,revokeIntent,'live.revoke','service-outcome','succeeded','revoked');
      if(action==='renew'){
        await this.tokens.check(input.token,viewer);let authority=await this.jobs.authority(tx,context);const decision=await this.#policy(tx,authority,viewer.target.deviceId,viewer.profile,active.length-1);
        authority=await this.jobs.authority(tx,authority);await this.tokens.check(input.token,viewer);
        if((viewer.policyHistory?.length??0)>=33)throw new JobError('CAPACITY');
        viewer.policyHistory=[...(viewer.policyHistory??[]),{epoch:viewer.epoch+1,atMs:tx.now,policy:structuredClone(decision),viewers:active.length,sharedUpstream:active.length>1}];
        if(!decision.allow){viewer.policy=decision;await this.#emit(tx,viewer.intent,'live.grant','authorization','deny','not-authorized');await this.#close(tx,viewer,'revoked');}
        else{if(viewer.epoch>=32)throw new JobError('CAPACITY');viewer.policy=decision;viewer.currentAuthority=authority;viewer.epoch++;viewer.expiresAtMs=Math.min(tx.now+LIVE_LEASE_MS,viewer.absoluteExpiresAtMs,authority.expiresAtMs);viewer.signal=null;await this.#save(tx,viewer);
          await this.#emit(tx,viewer.intent,'live.grant','access-grant','allow','authorized',{grantId:`${viewer.id}-epoch-${viewer.epoch}`});}
      }
      const remaining=await this.#active(tx,viewer.target.deviceId);await this.#demand(tx,await this.#producer(tx,viewer.target.deviceId),remaining);return viewer;
    });return this.#view(v);
  }
  async synchronize(siteId:string,deviceId:string){id(deviceId);
    const producer=await this.jobs.transaction(siteId,async tx=>this.#demand(tx,await this.#producer(tx,deviceId),await this.#active(tx,deviceId)));
    if(producer.deliveredGeneration===producer.demand.generation)return {state:producer.observedState,generation:producer.demand.generation};
    const observed=await bounded(750,signal=>this.adapter.apply(structuredClone(producer.demand),signal));
    if(observed.id!==producer.demand.id||observed.generation!==producer.demand.generation||!['leased','stopped'].includes(observed.state))throw new JobError('UNAVAILABLE');
    return this.jobs.transaction(siteId,async tx=>{const current=await this.#producer(tx,deviceId);if(current.demand.generation!==observed.generation)return {state:'superseded',generation:current.demand.generation};
      current.deliveredGeneration=observed.generation;current.observedState=observed.state;await tx.sql.query('UPDATE arbi_live_producers SET record=$2::jsonb WHERE id=$1',[current.demand.id,JSON.stringify(current)]);return observed;});
  }
  async signal(context:AuthorizedContext,input:unknown):Promise<LiveSignal>{
    exact(input,['sessionId','token','sequence','message']);id(input.sessionId);milliseconds(input.sequence,1,10000);const message=liveSignal(input.message);
    if(context.capability!=='live.view'||context.actor.kind!=='human')throw new JobError('DENIED');
    const staged=await this.jobs.transaction(context.siteId,async tx=>{const viewer=await this.#owned(tx,context,String(input.sessionId));await this.tokens.check(input.token,viewer);
      this.#device(tx,viewer.target.deviceId);if(!isDeepStrictEqual(this.#device(tx,viewer.target.deviceId).current,viewer.target)||viewer.configRevision!==tx.registry.configRevision)throw new JobError('DENIED');
      const fingerprint=digest(message),prior=viewer.signal;
      if(prior&&Number(input.sequence)<prior.sequence)throw new JobError('STALE_FENCE');
      if(prior&&Number(input.sequence)===prior.sequence){if(prior.fingerprint!==fingerprint)throw new JobError('CONFLICT');}
      else{if(prior&&prior.reply===null)throw new JobError('CONFLICT');viewer.signal={sequence:Number(input.sequence),fingerprint,reply:null};await this.#save(tx,viewer);}
      return {viewer,demand:(await this.#producer(tx,viewer.target.deviceId)).demand};
    });if(staged.viewer.signal?.reply)return staged.viewer.signal.reply;
    await this.synchronize(context.siteId,staged.viewer.target.deviceId);
    const demand=await this.jobs.transaction(context.siteId,async tx=>{const viewer=await this.#owned(tx,context,staged.viewer.id);await this.tokens.check(input.token,viewer);return (await this.#producer(tx,viewer.target.deviceId)).demand;});
    const reply=liveSignal(await bounded(750,signal=>this.adapter.signal({demand,viewerId:staged.viewer.id,epoch:staged.viewer.epoch,sequence:Number(input.sequence),expiresAtMs:staged.viewer.expiresAtMs,message},signal)));
    return this.jobs.transaction(context.siteId,async tx=>{const viewer=await this.#owned(tx,context,staged.viewer.id);await this.tokens.check(input.token,viewer);
      if(viewer.epoch!==staged.viewer.epoch||!viewer.signal||viewer.signal.sequence!==input.sequence||viewer.signal.fingerprint!==digest(message))throw new JobError('CONFLICT');viewer.signal.reply=reply;await this.#save(tx,viewer);return reply;});
  }
  /** Signed enrolled-device reports only. Human playback cannot become this evidence. */
  async device(siteId:string,input:unknown){
    exact(input,['version','realm','siteId','deviceId','credentialId','identity','configRevision','issuedAtMs','expiresAtMs','payload','signature']);
    if(input.version!=='arbi.live-device/1.0'||!isDeepStrictEqual(input.realm,this.jobs.realm)||input.siteId!==siteId)throw new JobError('DENIED');
    id(input.deviceId);id(input.credentialId);id(input.configRevision);milliseconds(input.issuedAtMs,0,Number.MAX_SAFE_INTEGER);milliseconds(input.expiresAtMs,0,Number.MAX_SAFE_INTEGER);
    exact(input.payload,['sessionId','epoch','generation','eventId','sequence','kind','sourceTime',...(typeof input.payload==='object'&&input.payload!==null&&'kind' in input.payload&&input.payload.kind==='delivery'?['summary']:[])]);const payload=input.payload;
    for(const field of ['sessionId','generation','eventId','sequence'])id(payload[field]);milliseconds(payload.epoch,1,10000);
    if(!['connected','ended','delivery'].includes(String(payload.kind)))throw new JobError('INVALID_REQUEST');
    return this.jobs.transaction(siteId,async tx=>{
      const device=this.#device(tx,String(input.deviceId)),credential=device.credentials.find(c=>c.id===input.credentialId&&c.revokedAtMs===null&&c.createdAtMs<=tx.now&&c.expiresAtMs>tx.now);
      if(!credential||!isDeepStrictEqual(device.current,input.identity)||input.configRevision!==tx.registry.configRevision||Number(input.issuedAtMs)>tx.now+100||Number(input.expiresAtMs)<=tx.now||
        Number(input.expiresAtMs)<=Number(input.issuedAtMs)||Number(input.expiresAtMs)-Number(input.issuedAtMs)>2000)throw new JobError('DENIED');
      const {signature,...unsigned}=input;try{prove(credential.publicKey,unsigned,signature);}catch{throw new JobError('DENIED');}
      const fingerprint=digest({payload,identity:device.current,configRevision:input.configRevision});
      const duplicate=(await tx.sql.query<{fingerprint:string}>('SELECT fingerprint FROM arbi_live_reports WHERE id=$1 AND environment=$2 AND namespace_id=$3 AND site_id=$4 AND device_id=$5',[payload.eventId,...scope(this.jobs.realm,siteId),device.id])).rows[0];
      if(duplicate){if(duplicate.fingerprint!==fingerprint)throw new JobError('CONFLICT');return {decision:'duplicate',durable:true,eventId:String(payload.eventId)};}
      if(Number((await tx.sql.query<{n:string}>('SELECT count(*)::text n FROM arbi_live_reports WHERE environment=$1 AND namespace_id=$2 AND site_id=$3',scope(this.jobs.realm,siteId))).rows[0].n)>=4096)throw new JobError('CAPACITY');
      const row=(await tx.sql.query<{record:LiveViewer}>('SELECT record FROM arbi_live_viewers WHERE id=$1 AND environment=$2 AND namespace_id=$3 AND site_id=$4',[payload.sessionId,...scope(this.jobs.realm,siteId)])).rows[0];
      if(!row||!isDeepStrictEqual(row.record.target,device.current)||row.record.epoch!==payload.epoch||row.record.configRevision!==tx.registry.configRevision)throw new JobError('DENIED');
      const viewer=row.record,producer=await this.#producer(tx,device.id);
      if(producer.demand.generation!==payload.generation)throw new JobError('STALE_FENCE');
      await this.jobs.authority(tx,viewer.currentAuthority);
      if(viewer.endedAtMs!==null||viewer.expiresAtMs<=tx.now)throw new JobError('EXPIRED');
      const delivering=payload.kind==='delivery';let delivery:Awaited<ReturnType<typeof deliverySummary>>|undefined;
      if(delivering){if(viewer.delivery&&(tx.now-viewer.delivery.receivedAtMs<5000||viewer.delivery.reports>=32))throw new JobError('CAPACITY');
        delivery=await deliverySummary(tx.sql,viewer,payload.summary,payload.sourceTime as AuditEvent['sourceTime']);}
      const connected=payload.kind==='connected',event:AuditEvent={...structuredClone(viewer.intent),eventId:String(payload.eventId),sequence:String(payload.sequence),
        source:{module:'media',identity:device.current!},sourceTime:payload.sourceTime as AuditEvent['sourceTime'],ingestTime:null,action:connected?'live.start':'live.end',evidence:'media-observation',
        outcome:'observed',reason:connected||delivering?'observed':'ended',effect:'none',metadata:{...viewer.intent.metadata,observation:delivering?'bytes-delivered':connected?'connection-established':'connection-ended',
          ...(delivery?{byteCount:delivery.viewerBytes,observedInterval:{startMonotonicMs:delivery.summary.startMonotonicMs,endMonotonicMs:delivery.summary.endMonotonicMs}}:{})},
        links:{...viewer.intent.links,causationEventId:viewer.intent.eventId}};
      if(delivering)event.action='live.start';
      if(!validateAuditEvent(event).ok)throw new JobError('INVALID_REQUEST');
      await this.jobs.audit.stage(tx.sql,event,binding(event));
      if(delivery)viewer.delivery={receivedAtMs:tx.now,reports:(viewer.delivery?.reports??0)+1,lastReportId:event.eventId,...delivery.summary};
      else{viewer.observedConnection=connected?'device-reported-connected':'device-reported-ended';viewer.observationEventId=event.eventId;}await this.#save(tx,viewer);
      await tx.sql.query('INSERT INTO arbi_live_reports VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',[event.eventId,...scope(this.jobs.realm,siteId),device.id,fingerprint,JSON.stringify({payload,identity:device.current,configRevision:input.configRevision,receivedAtMs:tx.now})]);
      if(!connected&&!delivering){await this.#close(tx,viewer,'ended');await this.#demand(tx,producer,await this.#active(tx,device.id));}
      return {decision:'recorded',durable:true,eventId:event.eventId};
    });
  }
  async advisory(context:AuthorizedContext,input:unknown){
    exact(input,['sessionId','token','sequence','state','sourceTime']);id(input.sessionId);milliseconds(input.sequence,1,10000);
    if(!['playing','ended'].includes(String(input.state))||context.actor.kind!=='human'||context.capability!=='live.view')throw new JobError('INVALID_REQUEST');
    return this.jobs.transaction(context.siteId,async tx=>{
      const viewer=await this.#owned(tx,context,String(input.sessionId));await this.tokens.check(input.token,viewer);const prior=viewer.browserAdvisory;
      if(prior&&(Number(input.sequence)<=prior.sequence||tx.now-prior.receivedAtMs<5000||prior.reports>=32))throw new JobError('CAPACITY');
      const event:AuditEvent={...structuredClone(viewer.intent),eventId:randomUUID(),sequence:String(input.sequence),action:'live.heartbeat',evidence:'browser-observation',outcome:'observed',reason:'heartbeat',effect:'none',
        source:{module:'browser',identity:{deviceId:context.actor.id,bootId:viewer.id,sessionId:context.sessionId}},sourceTime:input.sourceTime as AuditEvent['sourceTime'],ingestTime:null,
        metadata:{...viewer.intent.metadata,observation:'browser-heartbeat'},links:{...viewer.intent.links,causationEventId:viewer.intent.eventId}};
      if(!validateAuditEvent(event).ok)throw new JobError('INVALID_REQUEST');await this.jobs.audit.stage(tx.sql,event,binding(event));
      viewer.browserAdvisory={sequence:Number(input.sequence),receivedAtMs:tx.now,state:input.state as 'playing'|'ended',reports:(prior?.reports??0)+1};await this.#save(tx,viewer);
      return {advisory:true,affectsAdmission:false,eventId:event.eventId};
    });
  }
}
