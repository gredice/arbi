import { compareReleaseVersions,releaseVersionInRange,validateReleaseRecord } from '@arbi/protocol';
import type { Realm,ReleaseManifest } from '@arbi/protocol';
import { isId } from '@arbi/gredice';
import { digest } from '@arbi/audit';
import { fields,plain,reject,UpdateSecurityJournal } from './journal.js';
import type { UpdateTrustStore } from './trust.js';

/** Representative persisted data. No executable configuration, position, credential or motion permission. */
export interface MigrationData {
  schemaVersion:'arbi.update-data/1.0';dataVersion:string;configurationRevision:string;calibrationRevision:string|null;
  limits:{minimumVoltageV:number;maximumVoltageV:number;maxSpeedMmPerS:number};
}
function data(input:unknown):MigrationData{
  const x=plain(input);fields(x,['schemaVersion','dataVersion','configurationRevision','calibrationRevision','limits']);fields(x.limits,['minimumVoltageV','maximumVoltageV','maxSpeedMmPerS']);
  if(x.schemaVersion!=='arbi.update-data/1.0'||typeof x.dataVersion!=='string'||!/^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(x.dataVersion)||!isId(x.configurationRevision)||x.calibrationRevision!==null&&!isId(x.calibrationRevision))reject('INVALID_DATA');
  const l=x.limits;if(typeof l.minimumVoltageV!=='number'||typeof l.maximumVoltageV!=='number'||typeof l.maxSpeedMmPerS!=='number'||l.minimumVoltageV<0||l.maximumVoltageV>100||l.maximumVoltageV<=l.minimumVoltageV||l.maxSpeedMmPerS<=0||l.maxSpeedMmPerS>100)reject('INVALID_DATA');
  return x as unknown as MigrationData;
}
interface State {
  state:'active'|'prepared'|'committed'|'rolled-back'|'recovery-required';operationId:string|null;
  active:MigrationData;prior:MigrationData|null;manifest:ReleaseManifest|null;priorReleaseId:string;
  reason:string|null;dataDigest:string;motionAuthorized:false;
}
/** Actual private SQLite snapshots and marker recovery; no updater/reboot or actuation callback. */
export class UpdateMigrationStore {
  readonly #journal:UpdateSecurityJournal;
  constructor(readonly options:{path:string;realm:Realm;siteId:string;deviceId:string;trust:UpdateTrustStore;
    initial?:{data:MigrationData;manifest:ReleaseManifest;artifact:Uint8Array};fault?:(point:'before-commit'|'after-commit')=>void}){
    if(options.realm.environment!=='test'||!isId(options.siteId)||!isId(options.deviceId))reject('SCOPE_MISMATCH');
    options.trust.assertScope(options.realm,options.siteId,options.deviceId);
    this.#journal=new UpdateSecurityJournal(options.path,[options.realm,options.siteId,options.deviceId,'arbi.update-data/1.0']);
    try{
      if(this.#journal.verify().length===0){
        if(!options.initial)reject('PRIOR_DATA_REQUIRED');const initial=data(options.initial.data),manifest=options.trust.verifyArtifact(options.initial.manifest,options.initial.artifact);
        if(manifest.target.moduleId!==options.deviceId||!releaseVersionInRange(initial.dataVersion,manifest.configuration.dataRange))reject('INCOMPATIBLE_DATA');
        const first:State={state:'active',operationId:null,active:initial,prior:null,manifest:null,priorReleaseId:manifest.releaseId,reason:null,dataDigest:digest(initial),motionAuthorized:false};
        this.#journal.mutate(()=>({record:first,result:null}));
      }
      this.#state();
    }catch(e){this.#journal.close();throw e;}
  }
  close(){this.#journal.close();}
  #state(records=this.#journal.verify()):State{
    for(const input of records){fields(input,['state','operationId','active','prior','manifest','priorReleaseId','reason','dataDigest','motionAuthorized']);
      if(!['active','prepared','committed','rolled-back','recovery-required'].includes(String(input.state))||input.motionAuthorized!==false||input.dataDigest!==digest(data(input.active))||!isId(input.priorReleaseId)||input.operationId!==null&&!isId(input.operationId)||input.reason!==null&&!isId(input.reason))reject('CORRUPT_JOURNAL');
      if(input.prior!==null)data(input.prior);
      if(input.manifest!==null){const parsed=validateReleaseRecord('manifest',input.manifest);if(!parsed.ok||parsed.value.target.moduleId!==this.options.deviceId)reject('CORRUPT_JOURNAL');}
    }
    if(!records.length)reject('PRIOR_DATA_REQUIRED');return structuredClone(records.at(-1)) as State;
  }
  prepare(operationId:string,manifestInput:unknown,artifact:Uint8Array){
    if(!isId(operationId))reject('INVALID_OPERATION');const manifest=this.options.trust.verifyArtifact(manifestInput,artifact);
    if(manifest.target.moduleId!==this.options.deviceId)reject('TARGET_MISMATCH');
    return this.#journal.mutate(records=>{
      const current=this.#state(records);
      if(current.operationId===operationId){if(digest(current.manifest)!==digest(manifest))reject('IDEMPOTENCY_CONFLICT');return {record:current,result:current};}
      if(current.state==='prepared'||current.state==='recovery-required')reject('RECOVERY_REQUIRED');
      const migration=manifest.configuration.migration;
      if(!migration||migration.from!==current.active.dataVersion||compareReleaseVersions(migration.to,migration.from)<=0||!releaseVersionInRange(migration.to,manifest.configuration.dataRange))reject('INCOMPATIBLE_DATA');
      const next:State={...current,state:'prepared',operationId,prior:current.active,manifest,priorReleaseId:current.state==='committed'?current.manifest!.releaseId:current.priorReleaseId,reason:'MIGRATION_PENDING'};
      return {record:next,result:next};
    },this.options.fault);
  }
  apply(operationId:string,artifact:Uint8Array){
    const pending=this.#state();if(pending.operationId!==operationId||!pending.manifest)reject('OPERATION_MISMATCH');
    this.options.trust.verifyArtifact(pending.manifest,artifact);
    return this.#journal.mutate(records=>{
      const current=this.#state(records);if(current.operationId!==operationId)reject('OPERATION_MISMATCH');
      if(current.state==='committed')return {record:current,result:current};if(current.state!=='prepared'||!current.manifest||!current.prior)reject('RECOVERY_REQUIRED');
      const migration=current.manifest.configuration.migration!;
      if(migration.recordId!=='synthetic-reversible-migration'||migration.from!=='1.0.0'||migration.to!=='1.1.0'){
        const blocked:State={...current,state:'recovery-required',reason:'MIGRATION_IMPLEMENTATION_UNAVAILABLE'};return {record:blocked,result:blocked};
      }
      // Named isolated fixture transform; the unchanged prior snapshot is the actual reverse path.
      const nextData=data({...current.prior,dataVersion:migration.to,limits:{...current.prior.limits,maxSpeedMmPerS:current.prior.limits.maxSpeedMmPerS/2}});
      const next:State={...current,state:'committed',active:nextData,dataDigest:digest(nextData),reason:null};return {record:next,result:next};
    },this.options.fault);
  }
  rollback(operationId:string,baselineInput:unknown,artifact:Uint8Array){
    // Trust/security-floor failure leaves both active and prior snapshots intact.
    const baseline=this.options.trust.verifyArtifact(baselineInput,artifact);
    return this.#journal.mutate(records=>{
      const current=this.#state(records);
      if(current.operationId!==operationId||!current.prior||!current.manifest||baseline.target.moduleId!==this.options.deviceId||baseline.releaseId!==current.priorReleaseId)reject('ROLLBACK_TARGET_MISMATCH');
      if(current.manifest.configuration.migration?.rollbackTo!==current.prior.dataVersion||!releaseVersionInRange(current.prior.dataVersion,baseline.configuration.dataRange))reject('ROLLBACK_DATA_INCOMPATIBLE');
      const next:State={...current,state:'rolled-back',active:current.prior,dataDigest:digest(current.prior),reason:null};return {record:next,result:next};
    },this.options.fault);
  }
  get status(){const state=this.#state();return {...state,requiredAction:state.state==='prepared'?'resume-or-restore-prior-data':state.state==='recovery-required'?'review-compatible-migration-or-restore-prior-data':null,provenance:'declared-isolated-data',motionAuthorized:false as const};}
}
