import { createPublicKey,verify,type KeyObject } from 'node:crypto';
import { canonical,digest } from '@arbi/audit';
import { inspectReleaseSet,releaseSigningBytes,validateReleaseRecord,verifyReleaseArtifact,updateUtcValid } from '@arbi/protocol';
import type { Realm,ReleaseManifest,ReleaseSet } from '@arbi/protocol';
import { isId,sameRealm } from '@arbi/gredice';
import { fields,plain,reject,UpdateSecurityJournal,UpdateSecurityError } from './journal.js';

export interface TrustPolicy {
  schemaVersion:'arbi.trust/1.0';realm:Realm;siteId:string;revision:number;previousDigest:string;
  issuedAtUtc:string;expiresAtUtc:string;
  keys:{id:string;spki:string;status:'active'|'revoked';notBeforeUtc:string;notAfterUtc:string}[];
  floors:{moduleId:string;minimumSecurityVersion:number}[];
  releases:{releaseId:string;moduleId:string;artifactDigest:string;securityVersion:number}[];
}
export interface SignedTrustPolicy {policy:TrustPolicy;rootId:string;signature:string}
export const trustSigningBytes=(policy:TrustPolicy)=>Buffer.from(`arbi.trust/1.0\n${canonical(policy)}`,'utf8');
const hex=(x:unknown):x is string=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const integer=(x:unknown):x is number=>Number.isSafeInteger(x)&&Number(x)>=0&&Number(x)<=0xffffffff;
function publicKey(spki:unknown):KeyObject{
  if(typeof spki!=='string'||spki.length>256||!/^[A-Za-z0-9+/]+={0,2}$/.test(spki))reject('INVALID_PUBLIC_KEY');
  try{const key=createPublicKey({key:Buffer.from(spki,'base64'),format:'der',type:'spki'});if(key.asymmetricKeyType!=='ed25519'||key.type!=='public'||key.export({format:'der',type:'spki'}).toString('base64')!==spki)reject('INVALID_PUBLIC_KEY');return key;}catch{reject('INVALID_PUBLIC_KEY');}
}
function policy(input:unknown,root:{id:string;publicKey:KeyObject},realm:Realm,siteId:string):SignedTrustPolicy{
  const envelope=plain(input);fields(envelope,['policy','rootId','signature']);fields(envelope.policy,['schemaVersion','realm','siteId','revision','previousDigest','issuedAtUtc','expiresAtUtc','keys','floors','releases']);
  const p=envelope.policy as unknown as TrustPolicy;fields(p.realm,['environment','namespaceId']);
  if(p.schemaVersion!=='arbi.trust/1.0'||!sameRealm(p.realm,realm)||p.siteId!==siteId||!integer(p.revision)||p.revision===0||!hex(p.previousDigest)||
    !updateUtcValid(p.issuedAtUtc)||!updateUtcValid(p.expiresAtUtc)||Date.parse(p.expiresAtUtc)<=Date.parse(p.issuedAtUtc)||Date.parse(p.expiresAtUtc)-Date.parse(p.issuedAtUtc)>366*86400000)reject('INVALID_POLICY');
  for(const list of [p.keys,p.floors,p.releases])if(!Array.isArray(list)||list.length<1||list.length>256)reject('INVALID_POLICY');
  if(p.keys.length>8||p.floors.length>32)reject('INVALID_POLICY');
  for(const k of p.keys){fields(k,['id','spki','status','notBeforeUtc','notAfterUtc']);if(!isId(k.id)||!['active','revoked'].includes(k.status)||!updateUtcValid(k.notBeforeUtc)||!updateUtcValid(k.notAfterUtc)||Date.parse(k.notAfterUtc)<=Date.parse(k.notBeforeUtc))reject('INVALID_POLICY');publicKey(k.spki);}
  for(const f of p.floors){fields(f,['moduleId','minimumSecurityVersion']);if(!isId(f.moduleId)||!integer(f.minimumSecurityVersion))reject('INVALID_POLICY');}
  for(const r of p.releases){fields(r,['releaseId','moduleId','artifactDigest','securityVersion']);if(!isId(r.releaseId)||!isId(r.moduleId)||!hex(r.artifactDigest)||!integer(r.securityVersion)||!p.floors.some(f=>f.moduleId===r.moduleId))reject('INVALID_POLICY');}
  if(new Set(p.keys.map(k=>k.id)).size!==p.keys.length||new Set(p.floors.map(f=>f.moduleId)).size!==p.floors.length||new Set(p.releases.map(r=>r.releaseId)).size!==p.releases.length)reject('INVALID_POLICY');
  if(envelope.rootId!==root.id||typeof envelope.signature!=='string'||!/^[a-f0-9]{128}$/.test(envelope.signature)||!verify(null,trustSigningBytes(p),root.publicKey,Buffer.from(envelope.signature,'hex')))reject('UNTRUSTED_POLICY');
  return envelope as unknown as SignedTrustPolicy;
}
interface RecordState {kind:'trust';envelope:SignedTrustPolicy;clockFloorMs:number;recoveryRecordId:string|null}
export class UpdateTrustStore {
  readonly #journal:UpdateSecurityJournal;
  constructor(readonly options:{path:string;realm:Realm;siteId:string;deviceId:string;rootId:string;rootPublicKey:KeyObject;provisioningReviewId:string;clock:()=>{utcMs:number;reliable:boolean}}){
    if(options.realm.environment!=='test'||!isId(options.siteId)||!isId(options.deviceId)||!isId(options.rootId)||!isId(options.provisioningReviewId)||options.rootPublicKey.type!=='public'||options.rootPublicKey.asymmetricKeyType!=='ed25519')reject('PROVISIONING_REQUIRED');
    this.options=Object.freeze({...options,realm:Object.freeze(structuredClone(options.realm))});
    this.#journal=new UpdateSecurityJournal(options.path,[options.realm,options.siteId,options.deviceId,options.rootId,options.rootPublicKey.export({format:'der',type:'spki'}).toString('base64'),options.provisioningReviewId]);
    try{this.#records();}catch(e){this.#journal.close();throw e;}
  }
  close(){this.#journal.close();}
  assertScope(realm:Realm,siteId:string,deviceId:string){if(!sameRealm(realm,this.options.realm)||siteId!==this.options.siteId||deviceId!==this.options.deviceId)reject('SCOPE_MISMATCH');}
  #records(){return this.#journal.verify().map(input=>{fields(input,['kind','envelope','clockFloorMs','recoveryRecordId']);if(input.kind!=='trust'||!Number.isSafeInteger(input.clockFloorMs)||input.recoveryRecordId!==null&&!isId(input.recoveryRecordId))reject('CORRUPT_JOURNAL');policy(input.envelope,{id:this.options.rootId,publicKey:this.options.rootPublicKey},this.options.realm,this.options.siteId);return input as unknown as RecordState;});}
  #clock(prior:RecordState|null){return this.#journal.checkpointClock(this.options.clock(),prior?.clockFloorMs??0);}
  accept(input:unknown,recoveryRecordId:string|null=null){
    if(recoveryRecordId!==null&&!isId(recoveryRecordId))reject('REVIEWED_RECOVERY_REQUIRED');
    const envelope=policy(input,{id:this.options.rootId,publicKey:this.options.rootPublicKey},this.options.realm,this.options.siteId);
    const now=this.#clock(this.#records().at(-1)??null);
    return this.#journal.mutate(raw=>{
      const previous=raw.at(-1) as RecordState|undefined,p=envelope.policy;
      if(now<(previous?.clockFloorMs??0))reject('CLOCK_UNCERTAIN');
      if(Date.parse(p.issuedAtUtc)>now||Date.parse(p.expiresAtUtc)<=now)reject('ROTATION_WINDOW_MISSED');
      if(p.revision<=(previous?.envelope.policy.revision??0))reject('POLICY_REPLAY');
      if(p.previousDigest!==(previous?digest(previous.envelope.policy):'0'.repeat(64))&&recoveryRecordId===null)reject('REVIEWED_RECOVERY_REQUIRED');
      if(previous){for(const f of previous.envelope.policy.floors)if((p.floors.find(n=>n.moduleId===f.moduleId)?.minimumSecurityVersion??-1)<f.minimumSecurityVersion)reject('SECURITY_FLOOR_REGRESSION');
        for(const k of previous.envelope.policy.keys){const next=p.keys.find(n=>n.id===k.id);if(!next||k.status==='revoked'&&next.status!=='revoked')reject('REVOCATION_REGRESSION');if(next&&next.spki!==k.spki)reject('KEY_ID_REBINDING');}
        for(const r of previous.envelope.policy.releases){const next=p.releases.find(n=>n.releaseId===r.releaseId);if(!next||canonical(next)!==canonical(r))reject('RELEASE_ID_REBINDING');}}
      return {record:{kind:'trust',envelope,clockFloorMs:now,recoveryRecordId},result:{revision:p.revision,motionAuthorized:false as const}};
    });
  }
  #current(){const record=this.#records().at(-1);if(!record)reject('TRUST_UNPROVISIONED');const now=this.#clock(record);if(Date.parse(record.envelope.policy.expiresAtUtc)<=now)reject('ROTATION_WINDOW_MISSED');return {p:record.envelope.policy,now};}
  #security(p:TrustPolicy,m:ReleaseManifest){const r=p.releases.find(r=>r.releaseId===m.releaseId&&r.moduleId===m.target.moduleId&&r.artifactDigest===m.artifact.sha256),floor=p.floors.find(f=>f.moduleId===m.target.moduleId);
    if(!r||!floor)reject('UNBOUND_SECURITY_VERSION');if(r.securityVersion<floor.minimumSecurityVersion)reject('SECURITY_DOWNGRADE_BLOCKED');return r.securityVersion;}
  verifyArtifact(input:unknown,bytes:Uint8Array){
    const parsed=validateReleaseRecord('manifest',plain(input));if(!parsed.ok)reject('INVALID_MANIFEST');const {p,now}=this.#current(),m=parsed.value;this.#security(p,m);
    const key=p.keys.find(k=>k.id===m.artifact.signature.keyId);if(!key||key.status!=='active')reject('REVOKED_OR_UNTRUSTED_KEY');if(Date.parse(key.notBeforeUtc)>now||Date.parse(key.notAfterUtc)<=now)reject('KEY_WINDOW_MISSED');
    const result=verifyReleaseArtifact(m,bytes,{keyId:key.id,publicKey:publicKey(key.spki)});if(!result.ok)reject(result.error.code);return result.value;
  }
  plan(input:unknown){const parsed=validateReleaseRecord('set',plain(input));if(!parsed.ok)reject(parsed.error.code);const report=inspectReleaseSet(parsed.value);if(!report.ok)reject(report.error.code);const {p,now}=this.#current();
    for(const selection of [...report.value.updateStates.flat(),...report.value.rollbackStates.flatMap(r=>r.states.flat())]){const m=parsed.value.manifests.find(m=>m.releaseId===selection.releaseId)!;this.#security(p,m);const key=p.keys.find(k=>k.id===m.artifact.signature.keyId);if(!key||key.status!=='active'||Date.parse(key.notBeforeUtc)>now||Date.parse(key.notAfterUtc)<=now)reject('NO_TRUSTED_RECOVERY_PATH');if(!verify(null,releaseSigningBytes(m),publicKey(key.spki),Buffer.from(m.artifact.signature.value,'hex')))reject('INVALID_SIGNATURE');}
    return {releaseSetId:parsed.value.releaseSetId,report:report.value,motionAuthorized:false as const};
  }
  get diagnostics(){try{const {p}=this.#current();return {state:'ready',revision:p.revision,expiresAtUtc:p.expiresAtUtc,motionAuthorized:false};}catch(e){return {state:'recovery-required',reason:e instanceof UpdateSecurityError&&['CLOCK_UNCERTAIN','TRUST_UNPROVISIONED','ROTATION_WINDOW_MISSED','CORRUPT_JOURNAL','RESOURCE_LIMIT','UNTRUSTED_POLICY','INVALID_POLICY','INVALID_RECORD'].includes(e.code)?e.code:'UNAVAILABLE',requiredAction:'private-owner-trust-or-clock-recovery',motionAuthorized:false};}}
}
