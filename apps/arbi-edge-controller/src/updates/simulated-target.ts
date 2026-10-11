import { randomUUID } from 'node:crypto';
import { validateUpdateRecord,validateReleaseRecord } from '@arbi/protocol';
import type { Realm,ReleaseManifest,UpdateBootObservation,UpdateJournal } from '@arbi/protocol';
import { fields,reject,UpdateSecurityJournal } from './journal.js';
import type { UpdateMigrationStore } from './migrations.js';
import type { UpdateTrustStore } from './trust.js';
interface Slot {operationId:string|null;manifest:ReleaseManifest;boot:UpdateBootObservation;installations:number;rollbacks:number}
/** Persistent synthetic slots. No firmware flashing, OS installation, hardware reboot or motion callback exists. */
export class SimulatedUpdateTarget {
  readonly #journal:UpdateSecurityJournal;
  constructor(readonly options:{path:string;realm:Realm;siteId:string;deviceId:string;trust:UpdateTrustStore;data:UpdateMigrationStore;
    initial?:{manifest:ReleaseManifest;artifact:Uint8Array};now:()=>number;health:()=> 'passed'|'failed'|'unknown';baselineArtifact:(digest:string)=>Uint8Array;
    fault?:(point:'before-commit'|'after-commit')=>void}){
    options.trust.assertScope(options.realm,options.siteId,options.deviceId);
    this.#journal=new UpdateSecurityJournal(options.path,[options.realm,options.siteId,options.deviceId,'arbi.simulated-slots/1.0']);
    try{if(!this.#journal.verify().length){if(!options.initial)reject('BASELINE_REQUIRED');const m=options.trust.verifyArtifact(options.initial.manifest,options.initial.artifact);if(m.target.moduleId!==options.deviceId)reject('TARGET_MISMATCH');
      this.#journal.mutate(()=>({record:{operationId:null,manifest:m,boot:this.#boot(m,'passed',options.data.status.active.dataVersion),installations:0,rollbacks:0},result:null}));}this.#state();}catch(e){this.#journal.close();throw e;}
  }
  close(){this.#journal.close();}
  #boot(m:ReleaseManifest,health:UpdateBootObservation['health'],version:string):UpdateBootObservation{return {schemaVersion:'arbi.update/1.0',source:{deviceId:this.options.deviceId,bootId:randomUUID(),sessionId:randomUUID()},observedAt:new Date(this.options.now()).toISOString(),provenance:'local-boot-observation',releaseId:m.releaseId,build:m.build,artifactDigest:m.artifact.sha256,configurationDataVersion:version,health,recordId:randomUUID()};}
  #state(records=this.#journal.verify()):Slot{for(const r of records){fields(r,['operationId','manifest','boot','installations','rollbacks']);if(!validateUpdateRecord('boot',r.boot).ok||!validateReleaseRecord('manifest',r.manifest).ok||!Number.isSafeInteger(r.installations)||Number(r.installations)<0||!Number.isSafeInteger(r.rollbacks)||Number(r.rollbacks)<0)reject('CORRUPT_JOURNAL');}const s=records.at(-1) as unknown as Slot;if(s.boot.source.deviceId!==this.options.deviceId||s.manifest.releaseId!==s.boot.releaseId)reject('CORRUPT_JOURNAL');return structuredClone(s);}
  get status(){return {...this.#state(),provenance:'declared-isolated-target',physicalInstallationEnabled:false as const};}
  install(journal:UpdateJournal,bytes:Uint8Array){const s=this.#state(),r=journal.request;
    if(s.operationId===r.operationId)return s.boot;
    if(!journal.events.some(e=>e.kind==='installation-reserved')||s.boot.releaseId!==r.expectedInstalledReleaseId)reject('INSTALLATION_NOT_RESERVED');
    const m=this.options.trust.verifyArtifact(r.manifest,bytes);if(m.target.moduleId!==this.options.deviceId)reject('TARGET_MISMATCH');
    let active=this.options.data.status.active;if(active.dataVersion!==r.configurationDataVersion){this.options.data.prepare(r.operationId,m,bytes);const data=this.options.data.apply(r.operationId,bytes);if(data.state!=='committed')reject('MIGRATION_RECOVERY_REQUIRED');active=data.active;}
    return this.#journal.mutate(records=>{const prior=this.#state(records);if(prior.operationId===r.operationId)reject('IDEMPOTENCY_CONFLICT');const next:Slot={...prior,operationId:r.operationId,manifest:m,boot:this.#boot(m,'unknown',active.dataVersion),installations:prior.installations+1};return {record:next,result:next.boot};},this.options.fault);
  }
  observe(operationId:string){const s=this.#state();if(s.operationId!==operationId)return null;
    if(s.boot.health!=='unknown')return s.boot;
    const health=this.options.health();if(health==='unknown')return s.boot;
    return this.#journal.mutate(records=>{const prior=this.#state(records);const next:Slot={...prior,boot:{...prior.boot,health,observedAt:new Date(this.options.now()).toISOString(),recordId:randomUUID()}};return {record:next,result:next.boot};});
  }
  rollback(journal:UpdateJournal){const s=this.#state(),r=journal.request;if(s.operationId!==r.operationId)reject('ROLLBACK_TARGET_MISMATCH');if(s.boot.releaseId===journal.baselineManifest.releaseId&&s.boot.source.bootId!==journal.baseline.source.bootId)return s.boot;
    const bytes=this.options.baselineArtifact(journal.baselineManifest.artifact.sha256);this.options.trust.verifyArtifact(journal.baselineManifest,bytes);const data=this.options.data.status;const active=data.operationId===r.operationId&&data.prior?this.options.data.rollback(r.operationId,journal.baselineManifest,bytes).active:data.active;if(active.dataVersion!==journal.baseline.configurationDataVersion)reject('ROLLBACK_DATA_INCOMPATIBLE');
    return this.#journal.mutate(records=>{const prior=this.#state(records),next:Slot={...prior,manifest:journal.baselineManifest,boot:this.#boot(journal.baselineManifest,'passed',active.dataVersion),rollbacks:prior.rollbacks+1};return {record:next,result:next.boot};},this.options.fault);
  }
}
