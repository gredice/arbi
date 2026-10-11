import { canonical,digest } from '@arbi/audit';
import { isId } from '@arbi/gredice';
import { validateConfigurationRecord,type ErrorCode } from '@arbi/protocol';
import type { LocalJobConsumer } from '../jobs/orchestrator.js';
import type { ManualControl } from '../jobs/manual.js';
import { REQUIRED_INPUTS,type LocalAuthority } from '../jobs/types.js';
import type { CaptureWorkflow } from '../images/workflow.js';
import type { UpdateOrchestrator } from './orchestrator.js';
import { fields,reject,UpdateSecurityJournal } from './journal.js';
import { updateSafety } from './safety.js';

interface LockRecord {operationId:string;phase:'draining'|'ready'|'released';binding:string;reviewId:string|null}
/** Trusted test-realm composition only. The existing operation owner remains the
 * sole release manager; this journal retains only local admission inhibition. */
export class EdgeUpdatePreflight {
  readonly #journal:UpdateSecurityJournal;
  #closed=false;
  constructor(readonly options:{path:string;orchestrator:()=>UpdateOrchestrator;authority:()=>LocalAuthority;
    jobs:LocalJobConsumer;manual:ManualControl;capture?:CaptureWorkflow;drainTimeoutMs:number}) {
    const s=options.orchestrator().options.store.options;
    if(s.realm.environment!=='test'||!Number.isSafeInteger(options.drainTimeoutMs)||options.drainTimeoutMs<10||options.drainTimeoutMs>5000)reject('ISOLATED_PREFLIGHT_REQUIRED');
    this.options=Object.freeze({...options});
    this.#journal=new UpdateSecurityJournal(options.path,[s.realm,s.siteId,s.source.deviceId,'arbi.edge-update-inhibit/1.0']);
    try{this.#lock();}catch(e){this.#journal.close();throw e;}
  }
  close(){if(!this.#closed){this.#closed=true;this.#journal.close();}}
  #lock():LockRecord|null {
    let last:LockRecord|null=null;
    for(const value of this.#journal.verify()){
      fields(value,['operationId','phase','binding','reviewId']);
      if(!isId(value.operationId)||!['draining','ready','released'].includes(String(value.phase))||!(/^[a-f0-9]{64}$/).test(String(value.binding))||value.reviewId!==null&&!isId(value.reviewId))reject('CORRUPT_JOURNAL');
      last=value as unknown as LockRecord;
    }
    return last?.phase==='released'?null:last;
  }
  #binding(a:LocalAuthority){return digest([a.gate.receiver,a.applied,a.modules]);}
  #write(value:LockRecord){this.#journal.mutate(()=>({record:value,result:null}));}
  /** Supply this to both job admission and manual control. Failure inhibits. */
  admissionInhibit=():ErrorCode|null=>{try{return this.#lock()?'FAULT_INHIBITED':null;}catch{return 'FAULT_INHIBITED';}};
  get status(){try{return {lock:this.#lock(),available:true,physicalInstallationEnabled:false,oldJobsMayResume:false};}catch{return {lock:null,available:false,physicalInstallationEnabled:false,oldJobsMayResume:false};}}
  #local(target:string,ownLock:LockRecord|null):string|null {
    const o=this.options,a=o.authority(),s=o.orchestrator().options.store.options,now=a.gate.nowMonotonicMs;
    if(canonical(a.gate.realm)!==canonical(s.realm)||a.gate.siteId!==s.siteId||a.gate.receiver.deviceId!==s.source.deviceId||a.gate.executionMode!=='simulation')return 'LOCAL_SCOPE_MISMATCH';
    if(!a.stationary)return 'ACTIVE_MOTION';
    if(o.manual?.status.active)return 'MANUAL_CONTROL_ACTIVE';
    if(a.state==='Maintenance'||a.conditions.maintenance.value==='deny')return 'MAINTENANCE_CONFLICT';
    if(a.conditions.dock.value!=='allow')return 'DOCK_STATE_AMBIGUOUS';
    if(a.conditions.fault.value!=='allow'||a.gate.faultInhibited)return 'LOCAL_FAULT_INHIBITED';
    if(!a.clockReliable||!Number.isSafeInteger(now)||now<0)return 'LOCAL_CLOCK_UNCERTAIN';
    if(!validateConfigurationRecord(a.applied,'applied').ok||canonical(a.gate.receiver)!==canonical(a.boundary.receiver)||a.gate.configRevision!==a.applied.request.configuration.revision)return 'LOCAL_CONFIG_MISMATCH';
    if(a.commissioning&&(!a.commissioning().ready||a.commissioning().configurationDigest!==a.applied.configurationDigest))return 'COMMISSIONING_NOT_READY';
    for(const name of REQUIRED_INPUTS){const c=a.conditions[name];
      if(c.value!=='allow'||c.origin!=='simulated'||!c.supported||!Number.isSafeInteger(c.sampledAtMs)||!Number.isSafeInteger(c.validUntilMs)||c.sampledAtMs<0||c.sampledAtMs>now||c.validUntilMs<=now||now-c.sampledAtMs>1500||c.configurationDigest!==a.applied.configurationDigest||c.calibrationRevision!==a.applied.request.configuration.calibration?.revision)return 'LOCAL_CONDITIONS_UNKNOWN';
    }
    for(const m of Object.values(a.modules))if(!isId(m.source.deviceId)||!isId(m.source.bootId)||!isId(m.source.sessionId)||!Number.isSafeInteger(m.generation)||m.generation<1||m.configurationDigest!==a.applied.configurationDigest||m.calibrationRevision!==a.applied.request.configuration.calibration?.revision)return 'MODULE_RECONCILIATION_REQUIRED';
    if(ownLock&&ownLock.binding!==this.#binding(a))return 'POST_UPDATE_RECONCILIATION_REQUIRED';
    const jobs=o.jobs.status;
    if(o.manual?.status.degraded||jobs.journalDegraded||jobs.auditPending===null||jobs.auditPending>0||jobs.active===null||jobs.degraded&&!ownLock||jobs.recoveryRequired&&!ownLock)return 'LOCAL_JOB_RECOVERY_REQUIRED';
    if(jobs.active>0)return 'LOCAL_JOB_ACTIVE';
    if(ownLock?.phase==='ready'){const media=o.capture?.status;if(media&&(!media.closed||media.busy||media.preview?.active||media.preview?.busy||media.preview?.quarantined))return 'MEDIA_DRAIN_UNCONFIRMED';}
    const safe=updateSafety(o.orchestrator().options.safety(target),target,o.orchestrator().options.store.readClock().utcMs);
    return safe.ok?null:safe.reason;
  }
  check=(operationId:string,target:string):string|null=>{
    try{const lock=this.#lock();if(lock&&lock.operationId!==operationId)return 'UPDATE_LOCK_HELD';
      return this.#local(target,lock);
    }catch{return 'LOCAL_PREFLIGHT_UNAVAILABLE';}
  };
  /** The durable lock precedes every stop/drain and survives lost responses. */
  prepare=async(operationId:string,target:string):Promise<string|null>=>{
    const reason=this.check(operationId,target);if(reason)return reason;
    const old=this.#lock();if(old)return old.phase==='ready'?null:'UPDATE_DRAIN_REVIEW_REQUIRED';
    const operation=this.options.orchestrator().options.store.get(operationId);
    if(!operation.targets.some(t=>t.moduleId===target))return 'TARGET_NOT_IN_OPERATION';
    const lock:LockRecord={operationId,phase:'draining',binding:this.#binding(this.options.authority()),reviewId:null};
    this.#journal.mutate(prior=>{const last=prior.at(-1) as LockRecord|undefined;if(last&&last.phase!=='released')reject('UPDATE_LOCK_HELD');return {record:lock,result:null};});
    return this.#drain(lock,target);
  };
  async #drain(lock:LockRecord,target:string){
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{
      this.options.jobs.localSafetyStop();this.options.manual.retireForUpdate();
      await Promise.race([this.options.capture?.stopAndDrain()??Promise.resolve(),new Promise<never>((_,fail)=>{timer=setTimeout(()=>fail(Error('UPDATE_DRAIN_TIMEOUT')),this.options.drainTimeoutMs);})]);
      const reason=this.#local(target,lock);if(reason)return reason;
      const media=this.options.capture?.status;
      if(media&&(!media.closed||media.busy||(media.preview?.active||media.preview?.busy||media.preview?.quarantined)))return 'MEDIA_DRAIN_UNCONFIRMED';
      this.#write({...lock,phase:'ready'});return null;
    }catch{return 'UPDATE_DRAIN_UNCONFIRMED';}finally{if(timer)clearTimeout(timer);}
  }
  /** A private reviewed recovery may finish draining; it never installs bytes. */
  async resumeDrain(operationId:string,target:string,reviewId:string){
    if(!isId(reviewId))reject('RECOVERY_REVIEW_REQUIRED');const lock=this.#lock();
    if(!lock||lock.operationId!==operationId||lock.phase!=='draining')reject('UPDATE_DRAIN_REVIEW_REQUIRED');
    const reason=this.#local(target,lock);if(reason)return reason;
    const reviewed={...lock,reviewId};this.#write(reviewed);return this.#drain(reviewed,target);
  }
  /** New local epochs need a fresh human reconciliation, never a cached cloud
   * grant. Reviewing local state retains the lock and dispatches nothing. */
  reviewLocalRecovery(operationId:string,reviewId:string){
    if(!isId(reviewId))reject('RECOVERY_REVIEW_REQUIRED');const lock=this.#lock(),a=this.options.authority(),r=a.reconciliation,now=a.gate.nowMonotonicMs;
    if(!lock||lock.operationId!==operationId)reject('UPDATE_LOCK_REQUIRED');
    if(!r||r.actor.kind!=='human'||!isId(r.authorizationId)||r.origin!=='simulated'||!r.stopped||!r.referencesReady||!r.dockReleased||canonical(r.modules)!==canonical(a.modules)||!Number.isSafeInteger(r.atMs)||r.atMs>now||now-r.atMs>1500)reject('LOCAL_RECONCILIATION_REQUIRED');
    const next={...lock,binding:this.#binding(a),reviewId},operation=this.options.orchestrator().options.store.get(operationId);
    for(const target of operation.targets){const reason=this.#local(target.moduleId,next);if(reason)reject(reason);}
    this.options.jobs.localSafetyStop();this.options.manual.retireForUpdate();this.#write(next);
    return this.status;
  }
  /** Terminal durable operation + current target readbacks + explicit local
   * review release inhibition. Job recovery/leases remain their owners' work. */
  reconcile(operationId:string,reviewId:string){
    if(!isId(reviewId))reject('RECOVERY_REVIEW_REQUIRED');const lock=this.#lock(),o=this.options.orchestrator();
    if(!lock||lock.operationId!==operationId)reject('UPDATE_LOCK_REQUIRED');
    const operation=o.options.store.get(operationId);
    if(operation.worker||!['healthy','failed','rolled-back','cancelled'].includes(operation.state))reject('UPDATE_NOT_TERMINAL');
    for(const target of operation.targets){const local=this.#local(target.moduleId,lock);if(local)reject(local);
      const current=o.options.targets.get(target.moduleId)?.status;
      const expected=target.phase==='healthy'?target.manifest:target.journal.baselineManifest;
      if(!current||current.boot.health!=='passed'||current.boot.releaseId!==expected.releaseId||canonical(current.manifest)!==canonical(expected))reject('TARGET_RECONCILIATION_REQUIRED');
    }
    this.#write({...lock,phase:'released',reviewId});
    return this.status;
  }
}
