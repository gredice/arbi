import { chmodSync,closeSync,constants,existsSync,fstatSync,fsyncSync,lstatSync,mkdirSync,openSync,readSync,readdirSync,renameSync,statfsSync,unlinkSync,writeSync } from 'node:fs';
import { dirname,join,resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash,randomUUID } from 'node:crypto';
import { canonical,digest } from '@arbi/audit';
import { isId } from '@arbi/gredice';
import { recoverUpdate,validateReleaseRecord,validateUpdateRecord } from '@arbi/protocol';
import type { Realm,ReleaseManifest,UpdateBootObservation,UpdateJournal } from '@arbi/protocol';
import { fields,reject,UpdateSecurityJournal } from './journal.js';
import type { UpdateMigrationStore } from './migrations.js';
import type { UpdateTrustStore } from './trust.js';
import { updateSafety,type LocalUpdateSafety } from './safety.js';

export type LinuxProbeState='passed'|'failed'|'unknown'|'not-applicable';
export interface LinuxLocalHealth {provenance:'isolated-local-probe';agentStartup:LinuxProbeState;configuration:LinuxProbeState;durableState:LinuxProbeState;localInterfaces:LinuxProbeState;cameraInitialization:LinuxProbeState;gimbalConfiguration:LinuxProbeState;policyLoading:LinuxProbeState;osImageReadback:LinuxProbeState}
type Kind='application'|'os';
interface Image {slot:'a'|'b';manifest:ReleaseManifest}
interface Snapshot {manifest:ReleaseManifest;boot:UpdateBootObservation;components:Record<Kind,Image|null>}
interface State extends Snapshot {kind:'arbi.isolated-linux-slots/1.0';confirmationDeadlineMs:number|null;recoveryReviewId:string|null;operationId:string|null;phase:'confirmed'|'write-intent'|'staged'|'trial'|'rollback-intent'|'rolled-back';candidate:Image|null;baseline:Snapshot|null;persistentDigest:string;installations:number;rollbacks:number;localChecks:LinuxLocalHealth|null}
export type LinuxFaultPoint='write-intent'|'image-fsync'|'image-rename'|'staged'|'trial'|'health'|'confirmed'|'rollback-intent'|'rolled-back';
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
/** Actual private A/B files and SQLite intent, solely for isolated host integration.
 * No partition/bootloader writer, service switch, reboot or hardware enablement exists. */
export class IsolatedLinuxUpdateTarget {
  readonly #journal!:UpdateSecurityJournal;readonly #root:string;readonly #lock:DatabaseSync;#closed=false;
  constructor(readonly options:{directory:string;realm:Realm;siteId:string;deviceId:'pod'|'edge';trust:UpdateTrustStore;data:UpdateMigrationStore;maximumImageBytes:number;maximumSlotBytes:number;
    preflight:()=>LocalUpdateSafety|null;initial?:{manifest:ReleaseManifest;artifact:Uint8Array};now:()=>number;health:(query:{imagePath:string;manifest:ReleaseManifest;kind:Kind})=>LinuxLocalHealth;fault?:(point:LinuxFaultPoint)=>void}){
    options.trust.assertScope(options.realm,options.siteId,options.deviceId);
    if(options.realm.environment!=='test'||!['pod','edge'].includes(options.deviceId)||!Number.isSafeInteger(options.maximumImageBytes)||options.maximumImageBytes<1||options.maximumImageBytes>1048576||!Number.isSafeInteger(options.maximumSlotBytes)||options.maximumSlotBytes<3*options.maximumImageBytes||options.maximumSlotBytes>8388608)reject('ISOLATED_LAYOUT_REQUIRED');
    this.options=Object.freeze({...options,realm:Object.freeze(structuredClone(options.realm))});
    this.#root=resolve(options.directory);this.#privateDirectory(this.#root);this.#privateDirectory(join(this.#root,'slots'));this.#privateDirectory(join(this.#root,'persistent'));
    for(const name of ['linux-slots.sqlite','linux-owner.sqlite']){const path=join(this.#root,name),info=lstatSync(path,{throwIfNoEntry:false});if(info&&(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||(info.mode&0o077)!==0||info.size>16777216))reject('PRIVATE_FILE_REQUIRED');}
    this.#lock=new DatabaseSync(join(this.#root,'linux-owner.sqlite'));try{chmodSync(join(this.#root,'linux-owner.sqlite'),0o600);this.#lock.exec('PRAGMA busy_timeout=0;CREATE TABLE IF NOT EXISTS owner(id INTEGER PRIMARY KEY);BEGIN EXCLUSIVE');}catch{this.#lock.close();reject('LINUX_TARGET_BUSY');}
    try{
      this.#journal=new UpdateSecurityJournal(join(this.#root,'linux-slots.sqlite'),[options.realm,options.siteId,options.deviceId,'arbi.isolated-linux-slots/1.0',options.maximumImageBytes,options.maximumSlotBytes]);
      if(!this.#journal.verify().length){if(!options.initial)reject('BASELINE_REQUIRED');const manifest=this.#verified(options.initial.manifest,options.initial.artifact);const image:Image={slot:'a',manifest};this.#write(image,options.initial.artifact,false);
        const components:State['components']={application:null,os:null};components[this.#kind(manifest)]=image;
        const checks=this.#probe(image);if(this.#health(checks,this.#kind(manifest))!=='passed')reject('BASELINE_NOT_HEALTHY');
        this.#commit({kind:'arbi.isolated-linux-slots/1.0',confirmationDeadlineMs:null,recoveryReviewId:null,operationId:null,phase:'confirmed',manifest,boot:this.#boot(manifest,'passed'),components,candidate:null,baseline:null,persistentDigest:this.#persistent(),installations:0,rollbacks:0,localChecks:checks});
      }
      const state=this.#state();this.#active(state);
      // A durable write intent can adopt an exact read-back image, but never start a trial automatically.
      if(state.phase==='write-intent'&&state.candidate){const image=state.candidate,path=this.#path(image),part=`${path}.part`;
        if(!this.#matches(path,image)&&this.#matches(part,image)){renameSync(part,path);this.#sync(join(this.#root,'slots'));}
        if(this.#matches(path,image))this.#commit({...state,phase:'staged'});
      }
    }catch(e){this.#journal?.close();try{this.#lock.exec('ROLLBACK');}catch{}this.#lock.close();throw e;}
  }
  close(){if(this.#closed)return;this.#closed=true;this.#journal.close();try{this.#lock.exec('ROLLBACK');}catch{}this.#lock.close();}
  #privateDirectory(path:string){if(!existsSync(path))mkdirSync(path,{mode:0o700});const s=lstatSync(path);if(!s.isDirectory()||s.isSymbolicLink()||s.isFile()&&s.nlink!==1||(s.mode&0o077)!==0)reject('PRIVATE_DIRECTORY_REQUIRED');}
  #kind(m:ReleaseManifest):Kind{if(m.artifact.kind!=='application'&&m.artifact.kind!=='os')reject('LINUX_IMAGE_KIND_REQUIRED');return m.artifact.kind;}
  #path(image:Image){return join(this.#root,'slots',`${this.#kind(image.manifest)}-${image.slot}.image`);}
  #sync(path:string){const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{fsyncSync(fd);}finally{closeSync(fd);}}
  #verified(input:unknown,bytes:Uint8Array){const m=this.options.trust.verifyArtifact(input,bytes);this.#kind(m);if(m.target.moduleId!==this.options.deviceId||m.target.targetClass!==(this.options.deviceId==='pod'?'pi-pod':'linux-edge')||m.artifact.sizeBytes>this.options.maximumImageBytes)reject('TARGET_OR_IMAGE_LIMIT');return m;}
  #bytes(path:string,maximum:number){const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const info=fstatSync(fd);if(!info.isFile()||info.nlink!==1||(info.mode&0o077)!==0||info.size>maximum)reject('PRIVATE_FILE_REQUIRED');const bytes=Buffer.alloc(info.size);let offset=0;while(offset<bytes.length){const count=readSync(fd,bytes,offset,Math.min(65536,bytes.length-offset),null);if(count<=0)reject('IMAGE_READBACK_FAILED');offset+=count;}if(fstatSync(fd).size!==bytes.length)reject('IMAGE_READBACK_FAILED');return bytes;}finally{closeSync(fd);}}
  #matches(path:string,image:Image){try{const bytes=this.#bytes(path,this.options.maximumImageBytes);return bytes.length===image.manifest.artifact.sizeBytes&&hash(bytes)===image.manifest.artifact.sha256;}catch{return false;}}
  #read(image:Image){const bytes=this.#bytes(this.#path(image),this.options.maximumImageBytes);this.#verified(image.manifest,bytes);return bytes;}
  #write(image:Image,bytes:Uint8Array,inject=true){const path=this.#path(image),part=`${path}.part`;let used=0;
    for(const name of readdirSync(join(this.#root,'slots'))){if(!/^(application|os)-[ab]\.image(?:\.part)?$/.test(name))reject('UNKNOWN_SLOT_FILE');const s=lstatSync(join(this.#root,'slots',name));if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||(s.mode&0o077)!==0)reject('PRIVATE_FILE_REQUIRED');used+=s.size;}
    const space=statfsSync(this.#root,{bigint:true});if(used+(existsSync(part)?0:bytes.length)>this.options.maximumSlotBytes||space.bavail*space.bsize<BigInt((existsSync(part)?0:bytes.length)+65536))reject('INSUFFICIENT_STORAGE');
    if(existsSync(part)){if(!this.#matches(part,image))reject('PARTIAL_IMAGE_REQUIRES_LOCAL_RECOVERY');}else{
      const fd=openSync(part,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{let offset=0;while(offset<bytes.length){const count=writeSync(fd,bytes,offset,Math.min(65536,bytes.length-offset));if(count<=0)reject('IMAGE_WRITE_FAILED');offset+=count;}fsyncSync(fd);}finally{closeSync(fd);}if(inject)this.options.fault?.('image-fsync');}
    if(!this.#matches(part,image))reject('IMAGE_READBACK_FAILED');renameSync(part,path);this.#sync(dirname(path));if(inject)this.options.fault?.('image-rename');
  }
  #persistent(){let nodes=0;const root=join(this.#root,'persistent'),entries:{path:string;hash:string;size:number}[]=[];let total=0;
    const walk=(dir:string,relative:string)=>{for(const name of readdirSync(dir).sort()){if(++nodes>256)reject('PERSISTENT_LIMIT');const path=join(dir,name),local=relative?`${relative}/${name}`:name,s=lstatSync(path);if(s.isSymbolicLink()||s.isFile()&&s.nlink!==1||(s.mode&0o077)!==0)reject('PERSISTENT_LAYOUT_INVALID');if(s.isDirectory()){if(local.split('/').length>8)reject('PERSISTENT_LIMIT');walk(path,local);}else{if(!s.isFile()||s.size>1048576||entries.length>=128||(total+=s.size)>8388608)reject('PERSISTENT_LIMIT');const bytes=this.#bytes(path,1048576);if(bytes.length!==s.size)reject('PERSISTENT_STATE_CHANGED');entries.push({path:local,hash:hash(bytes),size:bytes.length});}}};
    walk(root,'');return digest(entries);
  }
  #boot(m:ReleaseManifest,health:UpdateBootObservation['health']):UpdateBootObservation{return {schemaVersion:'arbi.update/1.0',source:{deviceId:this.options.deviceId,bootId:randomUUID(),sessionId:randomUUID()},observedAt:new Date(this.options.now()).toISOString(),provenance:'local-boot-observation',releaseId:m.releaseId,build:m.build,artifactDigest:m.artifact.sha256,configurationDataVersion:this.options.data.status.active.dataVersion,health,recordId:randomUUID()};}
  #commit(state:State){this.#journal.mutate(()=>({record:state,result:null}));}
  #state():State{const records=this.#journal.verify();for(const raw of records){fields(raw,['kind','confirmationDeadlineMs','recoveryReviewId','operationId','phase','manifest','boot','components','candidate','baseline','persistentDigest','installations','rollbacks','localChecks']);
      const s=raw as unknown as State;if(s.kind!=='arbi.isolated-linux-slots/1.0'||s.confirmationDeadlineMs!==null&&(!Number.isSafeInteger(s.confirmationDeadlineMs)||s.confirmationDeadlineMs<0)||s.recoveryReviewId!==null&&!isId(s.recoveryReviewId)||!['confirmed','write-intent','staged','trial','rollback-intent','rolled-back'].includes(s.phase)||s.operationId!==null&&!isId(s.operationId)||!validateReleaseRecord('manifest',s.manifest).ok||!validateUpdateRecord('boot',s.boot).ok||s.boot.source.deviceId!==this.options.deviceId||s.boot.releaseId!==s.manifest.releaseId||s.boot.artifactDigest!==s.manifest.artifact.sha256||!Number.isSafeInteger(s.installations)||s.installations<0||!Number.isSafeInteger(s.rollbacks)||s.rollbacks<0||!/^[a-f0-9]{64}$/.test(s.persistentDigest))reject('CORRUPT_JOURNAL');
      fields(s.components,['application','os']);for(const [kind,image]of Object.entries(s.components))if(image){fields(image,['slot','manifest']);if(this.#kind(image.manifest)!==kind||!['a','b'].includes(image.slot)||!validateReleaseRecord('manifest',image.manifest).ok)reject('CORRUPT_JOURNAL');}
      if(s.candidate){fields(s.candidate,['slot','manifest']);if(!['a','b'].includes(s.candidate.slot)||!validateReleaseRecord('manifest',s.candidate.manifest).ok)reject('CORRUPT_JOURNAL');}
      if(s.baseline){fields(s.baseline,['manifest','boot','components']);if(!validateReleaseRecord('manifest',s.baseline.manifest).ok||!validateUpdateRecord('boot',s.baseline.boot).ok)reject('CORRUPT_JOURNAL');}
      if(s.localChecks)this.#health(s.localChecks,this.#kind(s.manifest));
    }const state=records.at(-1);if(!state)reject('BASELINE_REQUIRED');return structuredClone(state) as State;}
  #active(state:State){for(const image of Object.values(state.components))if(image)this.#read(image);}
  #probe(image:Image){this.#read(image);const checks=this.options.health({imagePath:this.#path(image),manifest:structuredClone(image.manifest),kind:this.#kind(image.manifest)});this.#health(checks,this.#kind(image.manifest));return structuredClone(checks);}
  #health(h:LinuxLocalHealth,kind:Kind):UpdateBootObservation['health']{fields(h,['provenance','agentStartup','configuration','durableState','localInterfaces','cameraInitialization','gimbalConfiguration','policyLoading','osImageReadback']);if(h.provenance!=='isolated-local-probe'||Object.entries(h).some(([key,value])=>key!=='provenance'&&(typeof value!=='string'||!['passed','failed','unknown','not-applicable'].includes(value))))reject('LOCAL_HEALTH_INVALID');
    const required:LinuxProbeState[]=[h.agentStartup,h.configuration,h.durableState,h.localInterfaces,...(this.options.deviceId==='pod'?[h.cameraInitialization,h.gimbalConfiguration]:[h.policyLoading]),...(kind==='os'?[h.osImageReadback]:[])];if(required.includes('failed'))return 'failed';return required.every(v=>v==='passed')?'passed':'unknown';}
  get status(){const s=this.#state();this.#active(s);return {...s,provenance:'isolated-native-files' as const,physicalInstallationEnabled:false as const,healthScope:'isolated-local-probes-not-hardware-boot',secureBoot:'not-established',requiredAction:s.phase==='rollback-intent'?'review-and-resume-local-rollback':['write-intent','staged'].includes(s.phase)?'review-and-resume-staged-local-trial':null};}
  #safe(){const result=updateSafety(this.options.preflight(),this.options.deviceId,this.options.now());if(!result.ok)reject(result.reason);}
  #request(journal:UpdateJournal){const parsed=validateUpdateRecord('journal',journal);if(!parsed.ok)reject('INVALID_UPDATE_JOURNAL');const state=recoverUpdate(journal);if(!state.ok||!state.value.status.installationReserved||journal.request.scope.executionMode!=='simulation'||canonical(journal.request.scope.realm)!==canonical(this.options.realm)||journal.request.scope.siteId!==this.options.siteId||journal.request.manifest.target.moduleId!==this.options.deviceId)reject('INSTALLATION_NOT_RESERVED');return journal.request;}
  install(journal:UpdateJournal,bytes:Uint8Array){const request=this.#request(journal),state=this.#state();this.#safe();if(state.operationId===request.operationId){if(digest(state.candidate?.manifest??state.manifest)!==digest(request.manifest))reject('IDEMPOTENCY_CONFLICT');return state.phase==='trial'||state.phase==='confirmed'?state.boot:null;}
    if(this.options.now()>=Date.parse(request.startDeadline))reject('START_DEADLINE_EXPIRED');
    if(!['confirmed','rolled-back'].includes(state.phase)||state.boot.releaseId!==request.expectedInstalledReleaseId)reject('INSTALLATION_CONFLICT');
    const manifest=this.#verified(request.manifest,bytes);if(canonical(manifest.target)!==canonical(state.manifest.target))reject('TARGET_MISMATCH');const kind=this.#kind(manifest),candidate:Image={slot:state.components[kind]?.slot==='a'?'b':'a',manifest},persistentDigest=this.#persistent();
    const next:State={...state,operationId:request.operationId,confirmationDeadlineMs:Date.parse(request.confirmationDeadline),phase:'write-intent',candidate,baseline:{manifest:state.manifest,boot:state.boot,components:state.components},persistentDigest,localChecks:null};this.#commit(next);this.options.fault?.('write-intent');this.#write(candidate,bytes);this.#commit({...next,phase:'staged'});this.options.fault?.('staged');return this.resumeLocalTrial(journal);
  }
  /** Private owner retry after reviewed local preflight; never automatic on reconnect/restart. */
  resumeLocalTrial(journal:UpdateJournal){const r=this.#request(journal),s=this.#state();if(s.operationId!==r.operationId||!s.candidate||digest(s.candidate.manifest)!==digest(r.manifest))reject('IDEMPOTENCY_CONFLICT');if(s.phase==='trial'||s.phase==='confirmed')return s.boot;if(s.phase!=='staged')reject('IMAGE_NOT_STAGED');if(s.confirmationDeadlineMs===null||this.options.now()>=s.confirmationDeadlineMs)reject('CONFIRMATION_DEADLINE_EXPIRED');this.#safe();this.#read(s.candidate);if(this.#persistent()!==s.persistentDigest)reject('PERSISTENT_STATE_CHANGED');
    let active=this.options.data.status.active;if(active.dataVersion!==r.configurationDataVersion){const bytes=this.#read(s.candidate);this.options.data.prepare(r.operationId,s.candidate.manifest,bytes);const migrated=this.options.data.apply(r.operationId,bytes);if(migrated.state!=='committed')reject('MIGRATION_RECOVERY_REQUIRED');active=migrated.active;}if(active.dataVersion!==r.configurationDataVersion)reject('DATA_VERSION_MISMATCH');
    this.#safe();const next:State={...s,phase:'trial',manifest:s.candidate.manifest,boot:this.#boot(s.candidate.manifest,'unknown'),components:{...s.components,[this.#kind(s.candidate.manifest)]:s.candidate},installations:s.installations+1};this.#commit(next);this.options.fault?.('trial');return next.boot;
  }
  observe(operationId:string){const s=this.#state();if(s.operationId!==operationId||!['trial','confirmed','rolled-back'].includes(s.phase))return null;this.#active(s);if(s.boot.health!=='unknown')return s.boot;if(s.confirmationDeadlineMs===null||this.options.now()>=s.confirmationDeadlineMs)reject('CONFIRMATION_DEADLINE_EXPIRED');if(this.#persistent()!==s.persistentDigest)reject('PERSISTENT_STATE_CHANGED');const image=s.components[this.#kind(s.manifest)]!,checks=this.#probe(image),health=this.#health(checks,this.#kind(s.manifest));this.options.fault?.('health');if(health==='unknown')return s.boot;
    const next:State={...s,phase:health==='passed'?'confirmed':'trial',boot:{...s.boot,health,observedAt:new Date(this.options.now()).toISOString(),recordId:randomUUID()},localChecks:checks};this.#commit(next);if(health==='passed')this.options.fault?.('confirmed');return next.boot;
  }
  rollback(journal:UpdateJournal){const r=this.#request(journal),s=this.#state();this.#safe();if(s.operationId!==r.operationId||!s.baseline)reject('ROLLBACK_TARGET_MISMATCH');if(s.phase==='rolled-back')return s.boot;if(s.baseline.manifest.releaseId!==journal.baselineManifest.releaseId||this.#persistent()!==s.persistentDigest)reject('ROLLBACK_BASELINE_MISMATCH');for(const image of Object.values(s.baseline.components))if(image)this.#read(image);
    if(s.phase!=='rollback-intent'){this.#commit({...s,phase:'rollback-intent'});this.options.fault?.('rollback-intent');}
    const bytes=this.#read(s.baseline.components[this.#kind(s.baseline.manifest)]!),data=this.options.data.status;if(data.operationId===r.operationId&&data.prior)this.options.data.rollback(r.operationId,s.baseline.manifest,bytes);if(this.options.data.status.active.dataVersion!==journal.baseline.configurationDataVersion)reject('ROLLBACK_DATA_INCOMPATIBLE');
    const image=s.baseline.components[this.#kind(s.baseline.manifest)]!,checks=this.#probe(image);if(this.#health(checks,this.#kind(s.baseline.manifest))!=='passed')reject('BASELINE_HEALTH_UNAVAILABLE');const next:State={...s,...s.baseline,phase:'rolled-back',boot:this.#boot(s.baseline.manifest,'passed'),localChecks:checks,rollbacks:s.rollbacks+1};this.#commit(next);this.options.fault?.('rolled-back');return next.boot;
  }
  /** Private reviewed retry finishes staging; it does not activate a trial. */
  resumeStaging(journal:UpdateJournal,bytes:Uint8Array,reviewRecordId:string){if(!isId(reviewRecordId))reject('REVIEW_REQUIRED');const r=this.#request(journal),s=this.#state();this.#safe();if(s.phase!=='write-intent'||s.operationId!==r.operationId||!s.candidate||digest(s.candidate.manifest)!==digest(r.manifest))reject('NO_PARTIAL_RECOVERY');this.#verified(s.candidate.manifest,bytes);this.#active(s);if(this.#persistent()!==s.persistentDigest)reject('PERSISTENT_STATE_CHANGED');
    const next={...s,recoveryReviewId:reviewRecordId};this.#commit(next);const part=`${this.#path(s.candidate)}.part`;if(existsSync(part)&&!this.#matches(part,s.candidate)){const info=lstatSync(part);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1)reject('PRIVATE_FILE_REQUIRED');unlinkSync(part);this.#sync(dirname(part));}this.#write(s.candidate,bytes);this.#commit({...next,phase:'staged'});return this.status;
  }
}
