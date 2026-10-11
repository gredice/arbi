import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { constants, closeSync, fsyncSync, fstatSync, openSync, readFileSync, readSync, realpathSync, statSync, writeSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { compareReleaseVersions, configurationDigest, releaseVersionInRange, validateConfigurationRecord, verifyReleaseArtifact } from '@arbi/protocol';

const layout=JSON.parse(readFileSync(new URL('../update-layout.json',import.meta.url),'utf8'));
const parts=new Map(layout.partitions.map(p=>[p.name,p]));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u.test(v);
const reject=code=>{throw Object.assign(new Error(code),{code});};
const fields=(v,names)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==[...names].sort().join())reject('INVALID_RECORD');};
const time=v=>Number.isSafeInteger(v)&&v>=0;
const exact=(a,b)=>configurationDigest(a)===configurationDigest(b);
const MAGIC=Buffer.from('ARBI71V1');
const COMMIT=0x71c0a11d;
export const picoFlashLayout=()=>structuredClone(layout);
export const updateTransferMac=(request,key)=>createHmac('sha256',key).update('arbi.synthetic-pico-transfer/1.0\0').update(configurationDigest(request)).digest('hex');

/** Isolated regular-file model only. Never opens a serial/device path, writes
 * board flash/OTP, runs firmware, or provisions a hardware signing key. */
export class SignedPicoFlashModel {
  #fd;#lock;#state;#journalIndex;#options;#configuration;#key;#transferKey;#sequence=0n;#boot;#session;#trialStart=null;#resetReason='host-model-open';#lastNow=0;#clockFault=false;
  constructor(options) {
    this.#options={...options,peer:structuredClone(options.peer),peers:structuredClone(options.peers)};
    const config=validateConfigurationRecord(options.configuration,'configuration');
    if(!config.ok||config.value.realm.environment!=='test'||config.value.executionMode!=='simulation')reject('SIMULATION_REQUIRED');
    this.#configuration=config.value;
    if(typeof options.dataVersion!=='string'||!/^\d{1,6}\.\d{1,6}\.\d{1,6}$/u.test(options.dataVersion))reject('CONFIGURATION_VERSION_REQUIRED');
    const component=config.value.components.find(c=>c.id===options.moduleId&&c.kind==='module'&&c.role==='pico');
    if(!component||options.trust?.publicKey?.type!=='public'||options.trust.publicKey.asymmetricKeyType!=='ed25519'||!id(options.trust.keyId)
      ||!Buffer.isBuffer(options.transferKey)||options.transferKey.length!==32||!options.transferKey.some(x=>x)||!id(options.peer?.deviceId)||!id(options.peer?.bootId)||!id(options.peer?.sessionId))reject('TRUST_REQUIRED');
    this.#options.component=component;this.#key={keyId:options.trust.keyId,publicKey:options.trust.publicKey};this.#transferKey=Buffer.from(options.transferKey);
    const root=realpathSync(options.root),temp=realpathSync(tmpdir());
    if(dirname(root)!==temp||!basename(root).startsWith('arbi-pico-flash-')||!statSync(root).isDirectory()||(statSync(root).mode&0o077))reject('ISOLATED_DIRECTORY_REQUIRED');
    try {
      this.#lock=new DatabaseSync(join(root,'model-lock.sqlite'));this.#lock.exec('PRAGMA busy_timeout=0; CREATE TABLE IF NOT EXISTS model_lock(id INTEGER PRIMARY KEY); BEGIN EXCLUSIVE');
      const path=join(root,'flash.bin');
      try{this.#fd=openSync(path,constants.O_RDWR|constants.O_NOFOLLOW);}catch(e){if(e.code!=='ENOENT'||!options.initial)throw e;this.#fd=openSync(path,constants.O_RDWR|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);this.#initialize(options.initial);}
      const info=fstatSync(this.#fd);if(!info.isFile()||info.size!==layout.flashBytes||info.nlink!==1||(info.mode&0o077))reject('INVALID_FLASH_MODEL');
      this.#readConfiguration();this.#loadState();this.#boot=randomUUID();this.#session=randomUUID();
      // Opening a new model process cannot resume a tentative image/lease.
      if(this.#state.phase==='trial')this.#rollback('simulated-reset-before-confirmation');
      else {const m=this.#image(this.#state.confirmedSlot);if(m.releaseId!==this.#state.releaseId||m.artifact.sha256!==this.#state.artifactDigest)reject('CORRUPT_JOURNAL');}
    } catch(e) {this.close();if(e.code==='ERR_SQLITE_ERROR'&&/locked|busy/u.test(e.message))reject('LOCAL_BUSY');throw e;}
  }
  close(){if(this.#fd!==undefined){closeSync(this.#fd);this.#fd=undefined;}if(this.#lock){try{this.#lock.exec('ROLLBACK');}catch{}this.#lock.close();this.#lock=undefined;}this.#transferKey?.fill(0);}
  #cut(point){this.#options.fault?.(point);}
  #now(){const n=this.#options.now();if(!time(n)||n<this.#lastNow||this.#clockFault){this.#clockFault=true;reject('CLOCK_INVALID');}this.#lastNow=n;return n;}
  #read(offset,bytes){if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(bytes)||offset<0||bytes<0||offset+bytes>layout.flashBytes)reject('FLASH_BOUNDS');const out=Buffer.alloc(bytes);if(readSync(this.#fd,out,0,bytes,offset)!==bytes)reject('TRUNCATED_FLASH');return out;}
  #raw(offset,bytes){let written=0;while(written<bytes.length){const n=writeSync(this.#fd,bytes,written,bytes.length-written,offset+written);if(!n)reject('FLASH_WRITE_FAILED');written+=n;}fsyncSync(this.#fd);}
  #erase(part){if(part.offset%4096||part.bytes%4096)reject('FLASH_ALIGNMENT');const erased=Buffer.alloc(4096,0xff);for(let n=0;n<part.bytes;n+=4096)this.#raw(part.offset+n,erased);}
  #program(offset,bytes){if(offset%256||bytes.length%256||offset+bytes.length>layout.flashBytes)reject('FLASH_ALIGNMENT');const old=this.#read(offset,bytes.length);for(let i=0;i<bytes.length;i++)if((old[i]&bytes[i])!==bytes[i])reject('FLASH_REQUIRES_ERASE');this.#raw(offset,bytes);}
  #pack(value,size,committed=true){const text=Buffer.from(JSON.stringify(value));if(text.length>size-48)reject('METADATA_TOO_LARGE');const out=Buffer.alloc(size,0xff);MAGIC.copy(out);out.writeUInt32LE(text.length,8);Buffer.from(hash(text),'hex').copy(out,12);text.copy(out,44);if(committed)out.writeUInt32LE(COMMIT,size-4);return out;}
  #unpack(bytes){if(!bytes.subarray(0,8).equals(MAGIC)||bytes.readUInt32LE(bytes.length-4)!==COMMIT)return null;const n=bytes.readUInt32LE(8);if(n>bytes.length-48)return null;const text=bytes.subarray(44,44+n);if(hash(text)!==bytes.subarray(12,44).toString('hex'))return null;try{return JSON.parse(text);}catch{return null;}}
  #verify(manifest,bytes) {
    if(!Buffer.isBuffer(bytes)||bytes.length>parts.get('A').bytes-layout.imageHeaderBytes)reject('IMAGE_TOO_LARGE');
    const v=verifyReleaseArtifact(manifest,bytes,this.#key);if(!v.ok)reject(v.error.code);const m=v.value,c=this.#options.component;
    if(m.target.moduleId!==c.id||m.target.targetClass!=='pico-motion'||m.target.boardId!==layout.boardId||['hardwareId','hardwareRevision','assemblyId','assemblyRevision'].some(k=>m.target[k]!==c[k]))reject('TARGET_MISMATCH');
    if(!releaseVersionInRange(this.#options.dataVersion,m.configuration.dataRange)||m.configuration.migration!==null
      ||compareReleaseVersions(m.minimumUpdater,'1.0.0')>0||compareReleaseVersions(m.minimumBootloader,'1.0.0')>0
      ||m.dependencies.some(d=>!this.#options.peers[d.moduleId]||!releaseVersionInRange(this.#options.peers[d.moduleId],d.versions)))reject('INCOMPATIBLE');
    return m;
  }
  #writeImage(slot,manifest,bytes) {
    const part=parts.get(slot);if(!part||!['A','B','rescue'].includes(slot)||bytes.length>part.bytes-layout.imageHeaderBytes)reject('IMAGE_TOO_LARGE');
    const header=this.#pack({version:'arbi.synthetic-pico-image/1.0',manifest},layout.imageHeaderBytes);this.#erase(part);this.#cut('after-inactive-erase');
    for(let n=0;n<bytes.length;n+=4096){const chunk=Buffer.alloc(Math.ceil(Math.min(4096,bytes.length-n)/256)*256,0xff);bytes.copy(chunk,0,n,n+4096);this.#program(part.offset+layout.imageHeaderBytes+n,chunk);this.#cut('after-image-chunk');}
    this.#program(part.offset,header);this.#cut('after-image-header');this.#image(slot);
  }
  #image(slot) {
    const part=parts.get(slot);if(!part||!['A','B','rescue'].includes(slot))reject('INVALID_SLOT');
    const header=this.#unpack(this.#read(part.offset,layout.imageHeaderBytes));if(!header)reject('INVALID_IMAGE_HEADER');fields(header,['version','manifest']);
    const size=header.manifest?.artifact?.sizeBytes;if(header.version!=='arbi.synthetic-pico-image/1.0'||!Number.isSafeInteger(size)||size<1||size>part.bytes-layout.imageHeaderBytes)reject('IMAGE_TOO_LARGE');
    return this.#verify(header.manifest,this.#read(part.offset+layout.imageHeaderBytes,size));
  }
  #initialize(initial) {
    const m=this.#verify(initial.manifest,initial.bytes);if(initial.bytes.length>parts.get('rescue').bytes-layout.imageHeaderBytes)reject('RESCUE_IMAGE_TOO_LARGE');
    const erased=Buffer.alloc(4096,0xff);for(let n=0;n<layout.flashBytes;n+=4096)this.#raw(n,erased);
    this.#writeImage('rescue',m,initial.bytes);this.#writeImage('A',m,initial.bytes);
    const p=parts.get('configuration');this.#program(p.offset,this.#pack({version:'arbi.synthetic-pico-config/1.0',configuration:this.#configuration,dataVersion:this.#options.dataVersion},p.bytes));
    this.#journalIndex=1;this.#state={generation:0,phase:'confirmed',confirmedSlot:'A',candidateSlot:null,releaseId:m.releaseId,artifactDigest:m.artifact.sha256,configurationDigest:configurationDigest(this.#configuration),reason:'initial-synthetic-provisioning'};
    this.#commit(this.#state);
  }
  #readConfiguration(){const p=parts.get('configuration'),v=this.#unpack(this.#read(p.offset,p.bytes));if(!v||v.version!=='arbi.synthetic-pico-config/1.0'||v.dataVersion!==this.#options.dataVersion||!exact(v.configuration,this.#configuration))reject('CONFIGURATION_MISMATCH');}
  #loadState(){const valid=[0,1].map(index=>({index,value:this.#unpack(this.#read(parts.get(`journal-${index}`).offset,4096))})).filter(x=>x.value);
    for(const {value:v} of valid){fields(v,['generation','phase','confirmedSlot','candidateSlot','releaseId','artifactDigest','configurationDigest','reason']);if(!time(v.generation)||!['confirmed','staged','trial','rolled-back'].includes(v.phase)||!['A','B','rescue'].includes(v.confirmedSlot)||v.candidateSlot!==null&&!['A','B'].includes(v.candidateSlot)||!id(v.releaseId)||!/^[a-f0-9]{64}$/u.test(v.artifactDigest)||v.configurationDigest!==configurationDigest(this.#configuration)
      ||(['staged','trial'].includes(v.phase)?v.candidateSlot===null||v.candidateSlot===v.confirmedSlot:v.candidateSlot!==null))reject('CORRUPT_JOURNAL');}
    valid.sort((a,b)=>b.value.generation-a.value.generation);if(!valid.length||valid.length===2&&valid[0].value.generation===valid[1].value.generation&&!exact(valid[0].value,valid[1].value))reject('LOCAL_SERVICE_REQUIRED');
    this.#state=valid[0].value;this.#journalIndex=valid[0].index;
  }
  #commit(next) {
    if(this.#state.generation===Number.MAX_SAFE_INTEGER)reject('JOURNAL_EXHAUSTED');const index=1-this.#journalIndex,part=parts.get(`journal-${index}`),value={...next,generation:this.#state.generation+1};
    const page=this.#pack(value,4096,false);this.#erase(part);this.#cut('after-journal-erase');this.#program(part.offset,page);this.#cut('before-journal-commit');
    const tail=Buffer.from(page.subarray(3840));tail.writeUInt32LE(COMMIT,252);this.#program(part.offset+3840,tail);this.#cut('after-journal-commit');this.#state=value;this.#journalIndex=index;
  }
  #authorize(envelope,action,manifest) {
    fields(envelope,['request','mac']);const r=envelope.request;fields(r,['version','action','commandId','correlationId','source','target','sequence','expiresMonotonicMs','manifestDigest','preflight']);
    if(Buffer.byteLength(JSON.stringify(r))>4096)reject('REQUEST_TOO_LARGE');
    if(typeof envelope.mac!=='string'||!/^[a-f0-9]{64}$/u.test(envelope.mac)||!timingSafeEqual(Buffer.from(envelope.mac,'hex'),Buffer.from(updateTransferMac(r,this.#transferKey),'hex')))reject('NOT_AUTHORIZED');
    if(r.version!=='arbi.synthetic-pico-transfer/1.0'||r.action!==action||!id(r.commandId)||!id(r.correlationId)||!exact(r.source,this.#options.peer)||!exact(r.target,this.identity)||r.manifestDigest!==configurationDigest(manifest)
      ||typeof r.sequence!=='string'||!/^[1-9][0-9]{0,19}$/u.test(r.sequence)||BigInt(r.sequence)>18446744073709551615n||BigInt(r.sequence)!==this.#sequence+1n)reject('EPOCH_OR_SEQUENCE_MISMATCH');
    const now=this.#now();if(!time(r.expiresMonotonicMs)||r.expiresMonotonicMs<=now||r.expiresMonotonicMs-now>1000)reject('DEADLINE_EXPIRED');
    fields(r.preflight,['origin','fixtureRecord','controllerPhase','manualAuthority','isolatedOutputs']);
    if(r.preflight.origin!=='simulated'||r.preflight.fixtureRecord!=='synthetic-restraint-71'||r.preflight.controllerPhase!=='inhibited'||r.preflight.manualAuthority!==false||r.preflight.isolatedOutputs!==true)reject('PREFLIGHT_REQUIRED');
    this.#sequence=BigInt(r.sequence);
  }
  get identity(){return {deviceId:this.#options.moduleId,bootId:this.#boot,sessionId:this.#session};}
  get status(){const slot=this.#state.phase==='trial'?this.#state.candidateSlot:this.#state.confirmedSlot,m=this.#image(slot);return {origin:'simulated',phase:this.#state.phase,slot,confirmedSlot:this.#state.confirmedSlot,candidateSlot:this.#state.candidateSlot,
    installed:{releaseId:m.releaseId,build:m.build,artifactDigest:m.artifact.sha256,provenance:'verified-host-slot'},
    staged:this.#state.candidateSlot===null?null:(()=>{const candidate=this.#image(this.#state.candidateSlot);return {releaseId:candidate.releaseId,build:candidate.build,artifactDigest:candidate.artifact.sha256,slot:this.#state.candidateSlot,provenance:'verified-host-slot'};})(),identity:this.identity,reason:this.#resetReason,
    operationReason:this.#state.reason,localTrialDeadlineMs:this.#trialStart===null?null:this.#trialStart+layout.localTrialBudgetMs,configurationDigest:this.#state.configurationDigest,
    firmwareExecuted:false,actuationInhibited:true,physicalInstallationEnabled:false,remoteHardwareInstallationSupported:false,bootselRecoveryRehearsed:false,swdRecoveryRehearsed:false};}
  stage(envelope,manifest,bytes){this.#authorize(envelope,'stage',manifest);if(!['confirmed','rolled-back'].includes(this.#state.phase)||this.#state.confirmedSlot==='rescue')reject('INVALID_STATE');
    const m=this.#verify(manifest,bytes);if(compareReleaseVersions(m.build.version,this.#image(this.#state.confirmedSlot).build.version)<0)reject('DOWNGRADE_REQUIRES_REVIEWED_RECOVERY');
    const slot=this.#state.confirmedSlot==='A'?'B':'A';this.#writeImage(slot,m,bytes);this.#commit({...this.#state,phase:'staged',candidateSlot:slot,reason:'signed-image-staged'});return this.status;}
  activate(envelope){const m=this.#image(this.#state.candidateSlot);this.#authorize(envelope,'activate',m);if(this.#state.phase!=='staged')reject('INVALID_STATE');
    this.#commit({...this.#state,phase:'trial',reason:'synthetic-trial-start'});this.#cut('before-trial-entry');this.#boot=randomUUID();this.#session=randomUUID();this.#sequence=0n;this.#trialStart=this.#now();return this.status;}
  #rollback(reason){let slot=this.#state.confirmedSlot;try{this.#image(slot);}catch{slot='rescue';this.#image(slot);}
    const m=this.#image(slot);this.#commit({...this.#state,phase:'rolled-back',confirmedSlot:slot,candidateSlot:null,releaseId:m.releaseId,artifactDigest:m.artifact.sha256,reason});this.#trialStart=null;this.#resetReason=reason;}
  tick(){if(this.#state.phase==='trial'){let now;try{now=this.#now();}catch(e){this.#rollback('synthetic-clock-invalid');throw e;}if(this.#trialStart===null||now-this.#trialStart>=layout.localTrialBudgetMs)this.#rollback('synthetic-trial-timeout');}return this.status;}
  confirm(health){fields(health,['origin','fixtureRecord','bootId','configurationDigest','configurationHealthy','interfaceHealthy','outputsInhibited']);this.tick();
    if(this.#state.phase!=='trial'||health.origin!=='simulated'||health.fixtureRecord!=='synthetic-local-health-71'||health.bootId!==this.#boot||health.configurationDigest!==this.#state.configurationDigest
      ||['configurationHealthy','interfaceHealthy','outputsInhibited'].some(k=>typeof health[k]!=='boolean'))reject('INVALID_LOCAL_HEALTH');
    if(!health.configurationHealthy||!health.interfaceHealthy||!health.outputsInhibited){this.#rollback('synthetic-local-health-failed');reject('LOCAL_HEALTH_FAILED');}
    const old=this.#state.confirmedSlot,slot=this.#state.candidateSlot,m=this.#image(slot);this.#commit({...this.#state,phase:'confirmed',confirmedSlot:slot,candidateSlot:null,releaseId:m.releaseId,artifactDigest:m.artifact.sha256,reason:'synthetic-local-confirmation'});
    this.#trialStart=null;this.#cut('after-confirmation');
    // Model the documented loss of the old A/B header after explicit buy. An
    // independently signed rescue copy remains, but real ROM recovery is unproved.
    this.#erase({offset:parts.get(old).offset,bytes:4096});this.#cut('after-old-image-invalidation');return this.status;
  }
}
