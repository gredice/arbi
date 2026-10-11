import assert from 'node:assert/strict';
import { generateKeyPairSync,sign } from 'node:crypto';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { digest } from '@arbi/audit';
import { produceRelease } from '@arbi/protocol';
import type { ReleaseManifest,ReleaseSet } from '@arbi/protocol';
import { UpdateTrustStore,trustSigningBytes,type TrustPolicy } from './trust.js';
import { UpdateMigrationStore,type MigrationData } from './migrations.js';
import { UpdateSecurityJournal,plain } from './journal.js';
const fixtures=JSON.parse(readFileSync(new URL('../../../../packages/arbi-protocol/fixtures/releases.json',import.meta.url),'utf8'));
const realm={environment:'test' as const,namespaceId:'synthetic-trust'},siteId='synthetic-site',day=86400000,start=Date.parse('2026-10-11T00:00:00.000Z');
const utc=(ms:number)=>new Date(ms).toISOString();
function fixture(){
  const dir=mkdtempSync(join(tmpdir(),'arbi-update-security-')),root=generateKeyPairSync('ed25519'),old=generateKeyPairSync('ed25519'),next=generateKeyPairSync('ed25519');
  let now=start;const payload=Buffer.from('synthetic signed device payload; no actuator');
  const signManifest=(input:ReleaseManifest,key=old,id='old-key')=>{
    const m=structuredClone(input);m.artifact.signature.keyId=id;const result=produceRelease(m,payload,{keyId:id,privateKey:key.privateKey});assert.ok(result.ok);return result.value;
  };
  const set:ReleaseSet=structuredClone(fixtures.releaseSet);set.manifests=set.manifests.map(m=>signManifest(m));
  const pub=(key:typeof old)=>key.publicKey.export({format:'der',type:'spki'}).toString('base64');
  const p:TrustPolicy={schemaVersion:'arbi.trust/1.0',realm,siteId,revision:1,previousDigest:'0'.repeat(64),issuedAtUtc:utc(start),expiresAtUtc:utc(start+day),
    keys:[{id:'old-key',spki:pub(old),status:'active',notBeforeUtc:utc(start),notAfterUtc:utc(start+10*day)}],
    floors:['edge','pico','pod'].map(moduleId=>({moduleId,minimumSecurityVersion:1})),
    releases:set.manifests.map(m=>({releaseId:m.releaseId,moduleId:m.target.moduleId,artifactDigest:m.artifact.sha256,securityVersion:m.build.version==='1.0.0'?1:2}))};
  const signed=(policy:TrustPolicy,signer=root)=>({policy,rootId:'offline-root',signature:sign(null,trustSigningBytes(policy),signer.privateKey).toString('hex')});
  const options={path:join(dir,'trust.sqlite'),realm,siteId,deviceId:'edge',rootId:'offline-root',rootPublicKey:root.publicKey,provisioningReviewId:'synthetic-provisioning-review',clock:()=>({utcMs:now,reliable:true})};
  const trust=new UpdateTrustStore(options);trust.accept(signed(p));
  return {dir,root,old,next,p,set,payload,trust,options,signed,signManifest,pub,clock:(value:number)=>{now=value;}};
}
test('persisted test device rotates release keys, rejects revocation/untrusted content, and requires reviewed offline recovery',t=>{
  const f=fixture();let trust=f.trust;t.after(()=>{trust.close();rmSync(f.dir,{recursive:true,force:true});});
  const old=f.set.manifests[0]!;assert.equal(trust.verifyArtifact(old,f.payload).releaseId,old.releaseId);
  assert.throws(()=>trust.verifyArtifact(f.signManifest(old,f.next,'old-key'),f.payload),{code:'INVALID_SIGNATURE'});
  assert.throws(()=>trust.accept({...f.signed(f.p),privateKey:'synthetic-forbidden-field'}),{code:'INVALID_RECORD'});
  assert.throws(()=>trust.accept(f.signed({...f.p,siteId:'foreign-site'})),{code:'INVALID_POLICY'});
  const next=f.signManifest(f.set.manifests[3]!,f.next,'new-key');
  const p2:TrustPolicy={...structuredClone(f.p),revision:2,previousDigest:digest(f.p),expiresAtUtc:utc(start+2*day),keys:[...f.p.keys,{id:'new-key',spki:f.pub(f.next),status:'active',notBeforeUtc:utc(start),notAfterUtc:utc(start+10*day)}]};
  trust.accept(f.signed(p2));assert.equal(trust.verifyArtifact(next,f.payload).releaseId,next.releaseId);
  assert.throws(()=>trust.verifyArtifact(next,Buffer.from('corrupt')),{code:'ARTIFACT_MISMATCH'});
  const p3:TrustPolicy={...structuredClone(p2),revision:3,previousDigest:digest(p2),expiresAtUtc:utc(start+3*day),keys:p2.keys.map(k=>({...k,status:k.id==='old-key'?'revoked':'active'}))};
  trust.accept(f.signed(p3));assert.throws(()=>trust.verifyArtifact(old,f.payload),{code:'REVOKED_OR_UNTRUSTED_KEY'});
  trust.close();trust=new UpdateTrustStore(f.options);assert.equal(trust.verifyArtifact(next,f.payload).releaseId,next.releaseId);
  assert.throws(()=>trust.accept(f.signed({...p3,revision:4,previousDigest:digest(p3),keys:p3.keys.filter(k=>k.id!=='old-key')})),{code:'REVOCATION_REGRESSION'});
  const p5:TrustPolicy={...structuredClone(p3),revision:5,previousDigest:'f'.repeat(64),issuedAtUtc:utc(start+4*day),expiresAtUtc:utc(start+6*day)};
  f.clock(start+4*day);assert.equal(trust.diagnostics.state,'recovery-required');
  assert.throws(()=>trust.accept(f.signed(p5)),{code:'REVIEWED_RECOVERY_REQUIRED'});
  assert.throws(()=>trust.accept(f.signed(p5,generateKeyPairSync('ed25519')),'reviewed-offline-recovery'),{code:'UNTRUSTED_POLICY'});
  trust.accept(f.signed(p5),'synthetic-reviewed-offline-recovery');assert.equal(trust.verifyArtifact(next,f.payload).releaseId,next.releaseId);
  f.clock(start);assert.throws(()=>trust.verifyArtifact(next,f.payload),{code:'CLOCK_UNCERTAIN'});
  trust.close();trust=new UpdateTrustStore(f.options);assert.throws(()=>trust.verifyArtifact(next,f.payload),{code:'CLOCK_UNCERTAIN'});
  assert.throws(()=>new UpdateTrustStore({...f.options,path:join(f.dir,'invalid.sqlite'),rootPublicKey:f.root.privateKey}),{code:'PROVISIONING_REQUIRED'});
  trust.close();trust=new UpdateTrustStore({...f.options,clock:()=>{throw Error('synthetic-secret-that-must-not-appear');}});assert.equal(trust.diagnostics.reason,'UNAVAILABLE');
  for(const bytes of [readFileSync(f.options.path),Buffer.from(JSON.stringify(trust.diagnostics)),f.payload,Buffer.from(JSON.stringify(p5))]){
    assert.equal(bytes.includes(f.root.privateKey.export({format:'der',type:'pkcs8'}) as Buffer),false);
    assert.equal(bytes.includes(f.next.privateKey.export({format:'der',type:'pkcs8'}) as Buffer),false);
    assert.equal(bytes.includes(Buffer.from('PRIVATE KEY')),false);
  }
});
test('compatibility planner accepts the declared bridge and rejects incompatible ordering and unsafe security rollback',t=>{
  const f=fixture();t.after(()=>{f.trust.close();rmSync(f.dir,{recursive:true,force:true});});
  assert.equal(f.trust.plan(f.set).report.updateStates.length,4);
  const bad=structuredClone(f.set);bad.steps=[bad.steps[1]!,bad.steps[0]!,bad.steps[2]!];bad.order=[{moduleId:'pico',after:[]},{moduleId:'edge',after:['pico']},{moduleId:'pod',after:['pico','edge']}];assert.throws(()=>f.trust.plan(bad),{code:'INCOMPATIBLE'});
  const forged=structuredClone(f.set);forged.manifests[4]!.dependencies=[];assert.throws(()=>f.trust.plan(forged),{code:'INVALID_SIGNATURE'});
  const floor={...structuredClone(f.p),revision:2,previousDigest:digest(f.p),floors:f.p.floors.map(x=>({...x,minimumSecurityVersion:2}))};f.trust.accept(f.signed(floor));
  assert.throws(()=>f.trust.plan(f.set),{code:'SECURITY_DOWNGRADE_BLOCKED'});
  assert.throws(()=>f.trust.verifyArtifact(f.set.manifests[0],f.payload),{code:'SECURITY_DOWNGRADE_BLOCKED'});
  assert.equal(f.trust.verifyArtifact(f.set.manifests[3],f.payload).build.version,'1.1.0');
  const replacementBytes=Buffer.from('synthetic compatible replacement at security version 2');
  const replacements=f.set.manifests.slice(3).map(input=>{
    const m=structuredClone(input);m.releaseId=`${m.target.moduleId}-compatible-replacement`;m.build.buildId=`${m.target.moduleId}-replacement-build`;
    const signed=produceRelease(m,replacementBytes,{keyId:'old-key',privateKey:f.old.privateKey});assert.ok(signed.ok);return signed.value;
  });
  const p3={...structuredClone(floor),revision:3,previousDigest:digest(floor),releases:[...floor.releases,...replacements.map(m=>({releaseId:m.releaseId,moduleId:m.target.moduleId,artifactDigest:m.artifact.sha256,securityVersion:2}))]};f.trust.accept(f.signed(p3));
  const replacementSet:ReleaseSet={...structuredClone(f.set),releaseSetId:'synthetic-compatible-replacement-set',manifests:[...f.set.manifests.slice(3),...replacements],initial:structuredClone(f.set.desired),desired:f.set.desired.map(s=>({...s,releaseId:`${s.moduleId}-compatible-replacement`}))};
  replacementSet.steps=structuredClone(replacementSet.desired);replacementSet.rollbackPaths=[1,2,3].map(afterStep=>({afterStep,steps:replacementSet.initial.slice(0,afterStep).reverse()}));
  assert.equal(f.trust.plan(replacementSet).report.updateStates.length,4);assert.equal(f.trust.verifyArtifact(replacements[0],replacementBytes).releaseId,'edge-compatible-replacement');
  const lowered={...structuredClone(p3),revision:4,previousDigest:digest(p3),floors:f.p.floors};assert.throws(()=>f.trust.accept(f.signed(lowered)),{code:'SECURITY_FLOOR_REGRESSION'});
});
test('migration snapshots survive lost acknowledgement/restart, restore prior data, and block missing migration or unsafe downgrade',t=>{
  const f=fixture();let migration:UpdateMigrationStore|undefined;t.after(()=>{migration?.close();f.trust.close();rmSync(f.dir,{recursive:true,force:true});});
  const initial:MigrationData={schemaVersion:'arbi.update-data/1.0',dataVersion:'1.0.0',configurationRevision:'synthetic-config',calibrationRevision:'synthetic-calibration',limits:{minimumVoltageV:20,maximumVoltageV:28,maxSpeedMmPerS:20}};
  let crash:'before-commit'|'after-commit'|null=null;
  const options={path:join(f.dir,'data.sqlite'),realm,siteId,deviceId:'edge',trust:f.trust,initial:{data:initial,manifest:f.set.manifests[0]!,artifact:f.payload},fault:(point:'before-commit'|'after-commit')=>{if(point===crash)throw Error('synthetic interruption');}};
  assert.throws(()=>new UpdateMigrationStore({...options,siteId:'foreign-site',path:join(f.dir,'foreign.sqlite')}),{code:'SCOPE_MISMATCH'});
  migration=new UpdateMigrationStore(options);crash='before-commit';assert.throws(()=>migration!.prepare('migration-1',f.set.manifests[3],f.payload));assert.deepEqual(migration.status.active,initial);
  crash='after-commit';assert.throws(()=>migration!.prepare('migration-1',f.set.manifests[3],f.payload));migration.close();crash=null;migration=new UpdateMigrationStore(options);
  assert.equal(migration.status.state,'prepared');assert.deepEqual(migration.status.active,initial);assert.equal(migration.status.motionAuthorized,false);
  assert.equal(migration.apply('migration-1',f.payload).active.limits.maxSpeedMmPerS,10);migration.close();migration=new UpdateMigrationStore(options);assert.equal(migration.status.active.dataVersion,'1.1.0');
  assert.deepEqual(migration.rollback('migration-1',f.set.manifests[0],f.payload).active,initial);
  migration.prepare('migration-real-crash',f.set.manifests[3],f.payload);migration.close();
  const childCode=`import {createPublicKey} from 'node:crypto';import {UpdateTrustStore} from ${JSON.stringify(new URL('./trust.js',import.meta.url).href)};import {UpdateMigrationStore} from ${JSON.stringify(new URL('./migrations.js',import.meta.url).href)};
    const trust=new UpdateTrustStore({path:${JSON.stringify(f.options.path)},realm:${JSON.stringify(realm)},siteId:${JSON.stringify(siteId)},deviceId:'edge',rootId:'offline-root',rootPublicKey:createPublicKey({key:Buffer.from(${JSON.stringify(f.pub(f.root))},'base64'),format:'der',type:'spki'}),provisioningReviewId:'synthetic-provisioning-review',clock:()=>({utcMs:${start},reliable:true})});
    const store=new UpdateMigrationStore({path:${JSON.stringify(options.path)},realm:${JSON.stringify(realm)},siteId:${JSON.stringify(siteId)},deviceId:'edge',trust,fault:()=>process.exit(32)});store.apply('migration-real-crash',Buffer.from(${JSON.stringify(f.payload.toString('base64'))},'base64'));`;
  const killed=spawnSync(process.execPath,['--input-type=module','-e',childCode],{encoding:'utf8'});assert.equal(killed.status,32);
  migration=new UpdateMigrationStore(options);assert.equal(migration.status.state,'prepared');assert.deepEqual(migration.status.active,initial);
  migration.rollback('migration-real-crash',f.set.manifests[0],f.payload);
  const unknown=structuredClone(f.set.manifests[3]!);unknown.releaseId='edge-unknown-migration';unknown.configuration.migration!.recordId='unimplemented-migration';const signed=f.signManifest(unknown);
  const p2={...structuredClone(f.p),revision:2,previousDigest:digest(f.p),releases:[...f.p.releases,{releaseId:signed.releaseId,moduleId:'edge',artifactDigest:signed.artifact.sha256,securityVersion:2}]};f.trust.accept(f.signed(p2));
  migration.prepare('migration-2',signed,f.payload);assert.equal(migration.apply('migration-2',f.payload).state,'recovery-required');assert.deepEqual(migration.status.active,initial);
  migration.rollback('migration-2',f.set.manifests[0],f.payload);migration.prepare('migration-3',f.set.manifests[3],f.payload);migration.apply('migration-3',f.payload);
  const p3={...structuredClone(p2),revision:3,previousDigest:digest(p2),floors:p2.floors.map(x=>({...x,minimumSecurityVersion:2}))};f.trust.accept(f.signed(p3));
  assert.throws(()=>migration!.rollback('migration-3',f.set.manifests[0],f.payload),{code:'SECURITY_DOWNGRADE_BLOCKED'});assert.equal(migration.status.active.dataVersion,'1.1.0');assert.deepEqual(migration.status.prior,initial);
});
test('actual process termination before SQLite commit preserves prior journal; plain records reject credential fields/accessors/cycles',t=>{
  const dir=mkdtempSync(join(tmpdir(),'arbi-update-crash-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'journal.sqlite');
  const journal=new UpdateSecurityJournal(path,['test','crash']);journal.mutate(()=>({record:{state:'prior'},result:null}));journal.close();
  const child=spawnSync(process.execPath,['--input-type=module','-e',`import {UpdateSecurityJournal} from ${JSON.stringify(new URL('./journal.js',import.meta.url).href)};const j=new UpdateSecurityJournal(${JSON.stringify(path)},['test','crash']);j.mutate(()=>({record:{state:'new'},result:null}),()=>process.exit(31));`],{encoding:'utf8'});
  assert.equal(child.status,31);const reopened=new UpdateSecurityJournal(path,['test','crash']);assert.deepEqual(reopened.verify(),[{state:'prior'}]);reopened.close();
  const cyclic:any={};cyclic.self=cyclic;assert.throws(()=>plain(cyclic),{code:'INVALID_RECORD'});let called=false;assert.throws(()=>plain({get privateKey(){called=true;return 'x';}}),{code:'INVALID_RECORD'});assert.equal(called,false);
});
