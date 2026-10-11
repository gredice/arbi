import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { canonical,checked,digest } from '@arbi/audit';
import { isId } from '@arbi/gredice';
import type { AuthorizedContext } from '@arbi/gredice';
import { admitUpdateEvent,checkReleaseStep,recoverUpdate,requestUpdate,reserveReferenceInstallation,updateIntentAudit,updateOutcomeAudit,configurationDigest } from '@arbi/protocol';
import type { AuditEvent,AuditSource,ReleaseInventory,ReleaseSelection,ReleaseSet,UpdateEvent,UpdateEventBoundary,UpdateRequest } from '@arbi/protocol';
import { TransferBudget,TransferError } from '../transfers/budget.js';
import { ArtifactCache } from '../transfers/artifacts.js';
import { fields,plain,reject,UpdateSecurityError } from './journal.js';
import { UpdateOperationStore,type OperationTarget,type UpdateOperation } from './operation-store.js';
import { IsolatedRangeSource,type RangeReceipt } from './range-source.js';
import type { SimulatedUpdateTarget } from './simulated-target.js';
import { updateSafety,type LocalUpdateSafety } from './safety.js';
import { UpdateTrustStore } from './trust.js';
const result=<T>(r:{ok:true;value:T}|{ok:false;error:{code:string}}):T=>{if(!r.ok)reject(r.error.code);return r.value;};
const terminal=(o:UpdateOperation)=>['healthy','failed','rolled-back','cancelled'].includes(o.state);
export interface UpdateTargetPort {readonly status:{manifest:SimulatedUpdateTarget['status']['manifest'];boot:SimulatedUpdateTarget['status']['boot'];physicalInstallationEnabled:false};install(journal:Parameters<SimulatedUpdateTarget['install']>[0],bytes:Uint8Array):unknown;observe(operationId:string):ReturnType<SimulatedUpdateTarget['observe']>;rollback(journal:Parameters<SimulatedUpdateTarget['rollback']>[0]):ReturnType<SimulatedUpdateTarget['rollback']>}
export interface UpdateChoice {key:string;releaseSetId:string;targets:string[];allowMetered:boolean}
export class UpdateOrchestrator {
  constructor(readonly options:{store:UpdateOperationStore;trust:UpdateTrustStore;inventory:ReleaseInventory;sets:ReleaseSet[];
    targets:Map<string,UpdateTargetPort>;budget:TransferBudget;cache:ArtifactCache;source:IsolatedRangeSource;
    metered:()=>boolean;safety:(target:string)=>LocalUpdateSafety|null;afterReservation?:()=>void;
    local?:{check:(operationId:string,target:string)=>string|null;prepare:(operationId:string,target:string)=>Promise<string|null>}}){
    if(options.budget.policy.maxAttempts>32)reject('UPDATE_RETRY_POLICY_LIMIT');
    const s=options.store.options;options.trust.assertScope(s.realm,s.siteId,s.source.deviceId);
    if(options.inventory.executionMode!=='simulation'||canonical(options.inventory.realm)!==canonical(s.realm)||options.inventory.siteId!==s.siteId)reject('SCOPE_MISMATCH');
    options.sets=structuredClone(options.sets);options.inventory=structuredClone(options.inventory);
  }
  #now(){return this.options.store.clock();}
  #time(){const c=this.options.store.readClock();return {utc:new Date(c.utcMs).toISOString(),uncertaintyMs:c.uncertaintyMs,monotonicMs:c.monotonicMs};}
  #set(id:string){const set=this.options.sets.find(s=>s.releaseSetId===id);if(!set)reject('RELEASE_UNAVAILABLE');return set;}
  #selections(set:ReleaseSet):ReleaseSelection[]{return set.initial.map(s=>{const target=this.options.targets.get(s.moduleId);if(!target)reject('TARGET_UNAVAILABLE');const b=target.status.boot;return {moduleId:s.moduleId,releaseId:b.releaseId,configurationDataVersion:b.configurationDataVersion};});}
  #plan(set:ReleaseSet){const report=this.options.trust.plan(set).report;
    const coordinator=this.options.store.options.source.deviceId,own=set.steps.findIndex(s=>s.moduleId===coordinator);if(own>=0&&own!==set.steps.length-1)reject('COORDINATOR_MUST_BE_LAST');
    for(const step of set.steps){const m=set.manifests.find(m=>m.releaseId===step.releaseId)!;if(m.artifact.sizeBytes>1048576)reject('ARTIFACT_OPERATION_LIMIT');if(!this.options.targets.has(step.moduleId))reject('TARGET_UNAVAILABLE');}
    return report;
  }
  available(){return {version:'arbi.update-view/1.0' as const,realm:this.options.store.options.realm,siteId:this.options.store.options.siteId,inventory:this.options.inventory,
    releases:this.options.sets.map(set=>{let reason:string|null=null;try{this.#plan(set);}catch(e){reason=updateError(e);}return {releaseSetId:set.releaseSetId,targets:set.steps.map(s=>({moduleId:s.moduleId,releaseId:s.releaseId,build:set.manifests.find(m=>m.releaseId===s.releaseId)!.build,manifest:set.manifests.find(m=>m.releaseId===s.releaseId)!})),compatible:reason===null,reason};}),
    operations:this.options.store.list().map(o=>({operationId:o.id,key:o.key,releaseSetId:o.releaseSetId,createdAtMs:o.createdAtMs,state:o.state,reason:o.reason,actor:o.actor})),
    installed:[...this.options.targets].map(([moduleId,target])=>({moduleId,...target.status})),metered:this.options.metered(),budget:this.options.budget.status,physicalInstallationEnabled:false};}
  request(input:unknown,context:AuthorizedContext,authorizationId:string){const body=plain(input);fields(body,['key','releaseSetId','targets','allowMetered']);
    if(!isId(body.key)||!isId(body.releaseSetId)||!Array.isArray(body.targets)||body.targets.length<1||body.targets.length>8||!body.targets.every(isId)||new Set(body.targets).size!==body.targets.length||typeof body.allowMetered!=='boolean'||context.actor.kind!=='human')reject('INVALID_REQUEST');
    const choice=body as unknown as UpdateChoice,fingerprint=digest({choice,actor:context.actor,sessionId:context.sessionId});
    // The durable key wins over current availability/deadlines on an identical reconnect.
    const prior=this.options.store.list().find(o=>o.key===choice.key);if(prior){if(prior.fingerprint!==fingerprint)reject('IDEMPOTENCY_CONFLICT');return this.view(prior.id);}
    const set=this.#set(choice.releaseSetId),report=this.#plan(set),current=this.#selections(set);
    const prefix=report.updateStates.findIndex(s=>canonical(s)===canonical(current));if(prefix<0)reject('INSTALLED_SELECTION_NOT_IN_PLAN');const steps=set.steps.slice(prefix,prefix+choice.targets.length);
    if(canonical(steps.map(s=>s.moduleId))!==canonical(choice.targets))reject('INVALID_RELEASE_ORDER');
    const c=this.#now(),utc=new Date(c.utcMs).toISOString();
    const operation=this.options.store.admit((existing,next)=>{const duplicate=existing.find(o=>o.key===choice.key);if(duplicate){if(duplicate.fingerprint!==fingerprint)reject('IDEMPOTENCY_CONFLICT');return {operation:duplicate,audit:[]};}if(existing.some(o=>!terminal(o)))reject('OPERATION_IN_PROGRESS');
      const id=randomUUID(),targets:OperationTarget[]=[],audit:AuditEvent[]=[];let selections=structuredClone(current);
      for(const step of steps){const target=this.options.targets.get(step.moduleId)!,baseline=target.status.boot;if(baseline.health!=='passed')reject('BASELINE_NOT_HEALTHY');const manifest=set.manifests.find(m=>m.releaseId===step.releaseId)!;
        const auditContext={actor:context.actor,authorizationId,correlationId:id,intentEventId:randomUUID()},operationId=randomUUID(),transferId=randomUUID();
        const request:UpdateRequest={schemaVersion:'arbi.update/1.0',scope:{realm:context.realm,siteId:context.siteId,executionMode:'simulation'},operationId,coordinatorId:this.options.store.options.source.deviceId,source:this.options.store.options.source,manifest,expectedInstalledReleaseId:baseline.releaseId,issuedAt:utc,startDeadline:new Date(c.utcMs+120000).toISOString(),confirmationDeadline:new Date(c.utcMs+300000).toISOString(),auditContext,budget:{reservationId:transferId,payloadBytes:String(manifest.artifact.sizeBytes),maximumWanBytes:String(manifest.artifact.sizeBytes*32),category:manifest.artifact.kind==='os'?'os-update':'ota'},configurationDataVersion:step.configurationDataVersion,direction:'install',releaseSetId:set.releaseSetId};
        const journal=result(requestUpdate(existing.flatMap(o=>o.targets.filter(t=>!terminal(o)||result(recoverUpdate(t.journal)).status.installationReserved).map(t=>t.journal)),request,{scope:request.scope,inventory:this.options.inventory,releaseSet:set,currentSelections:selections,authenticatedSource:request.source,authorizedAuditContext:auditContext,baseline,baselineManifest:target.status.manifest,nowUtc:utc})).journal;
        const intent=result(updateIntentAudit(journal,this.options.store.source,{utc,uncertaintyMs:c.uncertaintyMs,monotonicMs:c.monotonicMs},next(),context.sessionId));audit.push(intent);
        targets.push({moduleId:step.moduleId,manifest,journal,intent,transferId,phase:'pending',receipts:[]});selections=selections.map(s=>s.moduleId===step.moduleId?step:s);
      }
      return {operation:{id,key:choice.key,fingerprint,realm:context.realm,siteId:context.siteId,releaseSetId:set.releaseSetId,createdAtMs:c.utcMs,deadlineMs:c.utcMs+300000,actor:context.actor,sessionId:context.sessionId,authorizationId,allowMetered:choice.allowMetered,targets,index:0,reason:null,state:'requested',worker:null,overrideId:null},audit};
    });
    for(const target of operation.targets){const reason=this.options.local?.check(operation.id,target.moduleId);if(reason){this.#block(operation.id,reason,authorizationId);break;}}
    return this.view(operation.id);
  }
  owner(id:string,context:AuthorizedContext){const o=this.options.store.get(id);if(context.actor.kind!=='human'||canonical(context.actor)!==canonical(o.actor)||context.siteId!==o.siteId||canonical(context.realm)!==canonical(o.realm))reject('NOT_AUTHORIZED');return o;}
  #progress(o:UpdateOperation,t:OperationTarget,next:(source?:AuditSource)=>string,authorizationId:string,reason:AuditEvent['reason']='observed',receipt?:RangeReceipt):AuditEvent{
    return checked({...structuredClone(t.intent),eventId:randomUUID(),source:this.options.store.source,sourceTime:this.#time(),sequence:next(),action:'update.install',evidence:'update-observation',outcome:'observed',effect:'none',reason,links:{...t.intent.links,sessionId:o.sessionId,causationEventId:t.intent.eventId},record:{kind:'local-record',id:receipt?.chargeId??t.journal.events.at(-1)?.eventId??o.id},metadata:{...t.intent.metadata,authorizationId,updatePhase:t.phase,...(receipt&&receipt.observedPayloadBytes>0?{byteCount:receipt.observedPayloadBytes,observation:'bytes-delivered' as const}:{} )},change:null});
  }
  #block(id:string,reason:string,authorizationId:string,state:UpdateOperation['state']='blocked'){return this.options.store.update(id,(o,next)=>{o.reason=reason;o.state=state;return [this.#progress(o,o.targets[Math.min(o.index,o.targets.length-1)]!,next,authorizationId,'local-inhibit')];});}
  #event(t:OperationTarget,kind:UpdateEvent['kind'],boot:UpdateEvent['boot']=null):UpdateEvent{return {schemaVersion:'arbi.update/1.0',operationId:t.journal.request.operationId,eventId:randomUUID(),kind,source:boot?.source??this.options.store.options.source,observedAt:boot?.observedAt??this.#time().utc,artifactDigest:t.manifest.artifact.sha256,boot,reasonCode:kind,verification:null,preflight:null};}
  #boundary(t:OperationTarget,e:UpdateEvent):UpdateEventBoundary{return {scope:t.journal.request.scope,authenticatedSource:e.source,owner:e.boot?'target':'edge',nowUtc:this.#time().utc,localBootObservation:e.boot,artifactVerification:e.verification,preflight:e.preflight};}
  #append(id:string,e:UpdateEvent,authorizationId:string){return this.options.store.update(id,(o,next)=>{const t=o.targets[o.index]!;t.journal=result(admitUpdateEvent(t.journal,e,this.#boundary(t,e)));
    const state=result(recoverUpdate(t.journal)).status;t.phase=state.state==='confirmed'?'healthy':state.state==='requested'?'pending':state.state;
    if(e.kind==='confirmed'||e.kind==='rolled-back'||e.kind==='failed'||e.kind==='recovery-required'){
      const source:AuditSource={module:e.boot?t.moduleId==='pico'?'motion':t.moduleId==='pod'?'pod':'edge':'edge',identity:e.source};
      const event=result(updateOutcomeAudit(t.intent,t.journal,e.eventId,source,this.#time(),next(source)));event.links.sessionId=o.sessionId;
      if(e.kind==='confirmed'&&state.state==='confirmed'){o.index++;o.state=o.index===o.targets.length?'healthy':'requested';o.reason=null;}
      else{o.state=state.state==='rolled-back'?'rolled-back':state.state==='failed'&&!state.installationReserved?'failed':'recovery-required';o.reason=state.state==='rolled-back'?'CANARY_FAILED_ROLLED_BACK':'REVIEW_LOCAL_RECOVERY';}
      return [checked(event)];
    }
    return [this.#progress(o,t,next,authorizationId)];
  });}
  async advance(id:string,context:AuthorizedContext,authorizationId:string,recheck:()=>Promise<string|null>){let o=this.owner(id,context);if(terminal(o))return this.view(id);
    const token=this.options.store.claim(id);let lastReceipt:RangeReceipt|null=null;
    try{
      o=this.options.store.get(id);let t=o.targets[o.index]!,state=result(recoverUpdate(t.journal)).status;
      // An ambiguous reserved start is reconciled exclusively from the target; never resend it.
      if(!state.installationReserved){
        const localReason=this.options.local?.check(id,t.moduleId);if(localReason){this.#block(id,localReason,authorizationId);return this.view(id);}
        const drainReason=await this.options.local?.prepare(id,t.moduleId);if(drainReason){this.#block(id,drainReason,authorizationId);return this.view(id);}
        if(this.#now().utcMs>=Date.parse(t.journal.request.startDeadline)){this.#append(id,this.#event(t,'failed'),authorizationId);return this.view(id);}
        if(state.state==='requested'){
          if(this.options.metered()&&!o.allowMetered){this.#block(id,'METERED_CONSENT_REQUIRED',authorizationId,'paused');return this.view(id);}
          if(t.receipts.length>=32){this.#block(id,'ATTEMPT_LIMIT',authorizationId,'paused');return this.view(id);}
          let transfer=this.options.budget.getTransfer(t.transferId);
          if(!transfer){transfer=this.options.budget.start({id:t.transferId,class:'artifact',direction:'download',expectedBytes:t.manifest.artifact.sizeBytes,artifactDigest:t.manifest.artifact.sha256,stream:false,bitrate:null,overrideId:o.overrideId});if(transfer.id!==t.transferId)this.options.store.update(id,op=>{op.targets[op.index]!.transferId=transfer!.id;return [];});}
          else if(o.overrideId&&transfer.overrideId!==o.overrideId)this.options.budget.attachOverride(transfer.id,o.overrideId);
          let receipt:RangeReceipt|null=null;
          const download=await this.options.cache.step(transfer.id,this.options.source.transport(t.manifest.artifact.sizeBytes,r=>{receipt=r;lastReceipt=r;}));
          this.options.store.update(id,(op,next)=>{const target=op.targets[op.index]!;target.phase='downloading';if(receipt)target.receipts.push(receipt);op.reason=download.complete?null:'RANGE_PENDING';op.state=download.complete?'working':'paused';return [this.#progress(op,target,next,authorizationId,'observed',receipt??undefined)];});
          lastReceipt=null;
          if(!download.complete)return this.view(id);
          const m=this.options.trust.verifyArtifact(t.manifest,readFileSync(download.path!));
          t=this.options.store.get(id).targets[o.index]!;const staged=this.#event(t,'staged');staged.verification={manifestDigest:configurationDigest(m),keyId:m.artifact.signature.keyId,artifactDigest:m.artifact.sha256,recordId:randomUUID()};this.#append(id,staged,authorizationId);
        }
        const renewed=await recheck();if(!renewed){this.#block(id,'CURRENT_APPROVAL_REQUIRED',authorizationId);return this.view(id);}
        authorizationId=renewed;
        o=this.options.store.get(id);t=o.targets[o.index]!;
        this.#plan(this.#set(o.releaseSetId));result(checkReleaseStep(this.#set(o.releaseSetId),this.#selections(this.#set(o.releaseSetId)),{moduleId:t.moduleId,releaseId:t.manifest.releaseId,configurationDataVersion:t.journal.request.configurationDataVersion},'install'));
        const safe=updateSafety(this.options.safety(t.moduleId),t.moduleId,this.#now().utcMs);if(!safe.ok){this.#block(id,safe.reason,authorizationId);return this.view(id);}
        const transfer=this.options.budget.getTransfer(t.transferId);if(!transfer||transfer.state!=='complete')reject('VERIFIED_ARTIFACT_REQUIRED');
        const cached=await this.options.cache.step(t.transferId,this.options.source.transport(t.manifest.artifact.sizeBytes,()=>{}));const bytes=readFileSync(cached.path!);this.options.trust.verifyArtifact(t.manifest,bytes);
        const preparation=await this.options.local?.prepare(id,t.moduleId);if(preparation){this.#block(id,preparation,authorizationId);return this.view(id);}
        const finalSafe=updateSafety(this.options.safety(t.moduleId),t.moduleId,this.#now().utcMs);if(!finalSafe.ok){this.#block(id,finalSafe.reason,authorizationId);return this.view(id);}
        const reservation=this.#event(t,'installation-reserved');reservation.preflight=finalSafe.preflight;
        // Atomic reservation + audit acknowledgement precede the sole dispatch attempt.
        const reserved=this.options.store.update(id,(op,next)=>{const target=op.targets[op.index]!,r=result(reserveReferenceInstallation(target.journal,reservation,this.#boundary(target,reservation)));if(!r.dispatchInstallation)reject('INSTALLATION_ALREADY_RESERVED');target.journal=r.journal;return [this.#progress(op,target,next,authorizationId)];});
        this.options.afterReservation?.();
        this.options.targets.get(t.moduleId)!.install(reserved.targets[reserved.index]!.journal,bytes);
      }
      o=this.options.store.get(id);t=o.targets[o.index]!;state=result(recoverUpdate(t.journal)).status;
      const target=this.options.targets.get(t.moduleId)!,boot=target.observe(t.journal.request.operationId);
      if(!boot){this.#block(id,'RESERVED_INSTALLATION_UNOBSERVED_NO_RESEND',authorizationId,'recovery-required');return this.view(id);}
      if(boot.releaseId===t.journal.baselineManifest.releaseId&&boot.source.bootId!==t.journal.baseline.source.bootId){this.#append(id,this.#event(t,'rolled-back',boot),authorizationId);return this.view(id);}
      if(state.state==='staged'){this.#append(id,this.#event(t,'trial',boot),authorizationId);t=this.options.store.get(id).targets[o.index]!;}
      if(boot.health==='unknown'){this.#block(id,'TARGET_HEALTH_PENDING',authorizationId,'recovery-required');return this.view(id);}
      if(result(recoverUpdate(t.journal)).status.state==='recovery-required'){this.#block(id,'CONFIRMATION_DEADLINE_EXPIRED',authorizationId,'recovery-required');return this.view(id);}
      if(this.#now().utcMs>=Date.parse(t.journal.request.confirmationDeadline)){this.#block(id,'CONFIRMATION_DEADLINE_EXPIRED',authorizationId,'recovery-required');return this.view(id);}
      if(boot.health==='passed'){this.#append(id,this.#event(t,'confirmed',boot),authorizationId);return this.view(id);}
      const recoveryApproval=await recheck();if(!recoveryApproval){this.#block(id,'CURRENT_APPROVAL_REQUIRED',authorizationId,'recovery-required');return this.view(id);}
      authorizationId=recoveryApproval;
      const safe=updateSafety(this.options.safety(t.moduleId),t.moduleId,this.#now().utcMs);if(!safe.ok){this.#block(id,safe.reason,authorizationId,'recovery-required');return this.view(id);}
      const localRecovery=this.options.local?.check(id,t.moduleId);if(localRecovery){this.#block(id,localRecovery,authorizationId,'recovery-required');return this.view(id);}
      const restored=target.rollback(t.journal);this.#append(id,this.#event(t,'rolled-back',restored),authorizationId);return this.view(id);
    }catch(e){if(e instanceof TransferError){if(lastReceipt){this.options.store.update(id,(op,next)=>{const target=op.targets[op.index]!;target.receipts.push(lastReceipt!);return [this.#progress(op,target,next,authorizationId,'interrupted',lastReceipt!)];});lastReceipt=null;}const current=this.options.store.get(id).targets[o.index]!,transfer=this.options.budget.getTransfer(current.transferId);if(transfer?.state==='active'&&!transfer.pending)this.options.budget.pause(transfer.id);this.#block(id,updateError(e),authorizationId,e.code==='OVERSIZED_RANGE'?'blocked':'paused');return this.view(id);}if(e instanceof UpdateSecurityError){const current=this.options.store.get(id).targets[o.index]!,reserved=result(recoverUpdate(current.journal)).status.installationReserved;this.#block(id,updateError(e),authorizationId,reserved?'recovery-required':'blocked');return this.view(id);}try{const current=this.options.store.get(id).targets[o.index]!,reserved=result(recoverUpdate(current.journal)).status.installationReserved;this.#block(id,reserved?'INSTALLATION_RESULT_UNAVAILABLE':'UPDATE_RESULT_UNAVAILABLE',authorizationId,reserved?'recovery-required':'blocked');}catch{ /* No action can follow an unavailable journal; prior reservation/charges remain recoverable. */ }throw e;}
    finally{this.options.store.release(id,token);}
  }
  override(id:string,context:AuthorizedContext,authorizationId:string,bytes:number){const o=this.owner(id,context);if(terminal(o)||!Number.isSafeInteger(bytes)||bytes<1||bytes>1048576)reject('INVALID_REQUEST');const grant=this.options.budget.override({id:randomUUID(),class:'artifact',bytes,expiresUtcMs:this.#now().utcMs+60000,actor:o.actor});
    this.options.budget.copyAudit(event=>this.options.store.copyAudit([event]));
    this.options.store.update(id,(op,next)=>{op.overrideId=grant.override.id;return [checked({...this.#progress(op,op.targets[op.index]!,next,authorizationId),metadata:{permission:'update',updatePhase:op.targets[op.index]!.phase,authorizationId,configRevision:grant.override.id,grantId:grant.auditIntentId}})];});return this.view(id);
  }
  cancel(id:string,context:AuthorizedContext,authorizationId:string){const o=this.owner(id,context);if(o.worker||o.targets.some(t=>result(recoverUpdate(t.journal)).status.installationReserved))reject('LOCAL_RECOVERY_REQUIRED');
    for(const t of o.targets){const transfer=this.options.budget.getTransfer(t.transferId);if(transfer&&transfer.state!=='complete'&&!transfer.pending)this.options.budget.finish(t.transferId,true);}
    this.options.store.update(id,(op,next)=>{const audit:AuditEvent[]=[];for(const target of op.targets){const e=this.#event(target,'failed');target.journal=result(admitUpdateEvent(target.journal,e,this.#boundary(target,e)));target.phase='failed';audit.push(this.#progress(op,target,next,authorizationId,'cancelled'));}op.state='cancelled';op.reason='OPERATOR_CANCELLED';return audit;});return this.view(id);
  }
  view(id:string){const o=this.options.store.get(id);return {version:'arbi.update-view/1.0' as const,realm:o.realm,siteId:o.siteId,operationId:o.id,releaseSetId:o.releaseSetId,actor:o.actor,sessionId:o.sessionId,authorizationId:o.authorizationId,createdAtMs:o.createdAtMs,deadlineMs:o.deadlineMs,state:o.state,reason:o.reason,index:o.index,
    requiredAction:o.state==='paused'?o.reason==='METERED_CONSENT_REQUIRED'?'cancel-and-request-metered-consent':'retry-or-request-authorized-budget-override':o.state==='blocked'?'resolve-local-preflight-and-renew-approval':o.state==='recovery-required'?'inspect-target-or-publish-compatible-replacement':null,
    targets:o.targets.map(t=>({moduleId:t.moduleId,phase:t.phase,status:result(recoverUpdate(t.journal)).status,transfer:this.options.budget.getTransfer(t.transferId),usageCharges:this.options.budget.charges(t.transferId),receiptCoverage:{unreconciledPayloadBytes:t.receipts.reduce((n,r)=>n+Math.max(0,r.observedPayloadBytes-(this.options.budget.charges(t.transferId).find(c=>c.id===r.chargeId)?.bytes??0)),0),missingChargeIds:this.options.budget.charges(t.transferId).filter(c=>!t.receipts.some(r=>r.chargeId===c.id)).map(c=>c.id),pendingChargeUpperBoundBytes:this.options.budget.getTransfer(t.transferId)?.pending?.bytes??0},receipts:t.receipts})),budget:this.options.budget.status,budgetOverride:this.options.budget.overrideStatus(o.overrideId),
    accounting:{layer:'application-payload',wireBytes:null,carrierBytes:null,prefixIntegrity:'whole-artifact-hash-and-signature-required',unknownAfterCrash:'pending-budget-grants-retain-upper-bound'},physicalInstallationEnabled:false};}
}
export function updateError(e:unknown){return e instanceof UpdateSecurityError||e instanceof TransferError?e.code:'UPDATE_UNAVAILABLE';}
