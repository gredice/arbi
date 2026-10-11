import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configurationDigest,produceRelease } from '@arbi/protocol';
import { SignedPicoFlashModel } from './flash-model.mjs';
import { ControllerPicoUpdateModel } from './controller-update-model.mjs';
const configuration=JSON.parse(readFileSync(new URL('../../../packages/arbi-protocol/fixtures/configuration.json',import.meta.url),'utf8')).valid.configuration;
const baseline=JSON.parse(readFileSync(new URL('../../../packages/arbi-protocol/fixtures/releases.json',import.meta.url),'utf8')).releaseSet.manifests.find(m=>m.target.moduleId==='pico'&&m.build.version==='1.0.0');
function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'arbi-pico-flash-')),key=generateKeyPairSync('ed25519'),transferKey=Buffer.alloc(32,0x72),bytes=Buffer.alloc(20000,0x72);
  let now=0,locked=false,alter=()=>{},reserve=true;
  const sign=(input,payload=bytes,signer=key)=>{const m=structuredClone(input);m.artifact.signature.keyId='synthetic-test-key';const r=produceRelease(m,payload,{keyId:'synthetic-test-key',privateKey:signer.privateKey});assert.ok(r.ok);return r.value;};
  const initial=sign(baseline),candidate=sign({...baseline,releaseId:'pico-1.0.1',build:{...baseline.build,version:'1.0.1',buildId:'synthetic-next'}});
  const peer={deviceId:'edge',bootId:'edge-boot-1',sessionId:'edge-session-1'};
  const flash=new SignedPicoFlashModel({root,moduleId:'pico',configuration,dataVersion:'1.0.0',trust:{keyId:'synthetic-test-key',publicKey:key.publicKey},transferKey,
    peer,peers:{edge:'1.1.0'},now:()=>now,initial:{manifest:initial,bytes}});
  // Named trusted synthetic owner, not the actual C/MCU/GPIO adapter. C owner
  // reservation is separately exercised by the shared-core host test.
  const owner={read:()=>{const e={version:'arbi.controller-update-owner/1.0',origin:'simulated',recordId:'owner-fixture',identity:flash.identity,
    configurationDigest:configurationDigest(configuration),sampledMs:now,mode:'update-safe',activeMotion:false,manualLease:false,outputsInhibited:true,updateLocked:locked,
    protection:{fixtureRecord:'synthetic-restraint-72',independentOwner:'independent-fixture',outputsIsolated:true,restraint:true,lineClearance:true,stablePower:true}};alter(e);return e;},
    reserve:()=>{if(!reserve)return false;locked=true;return true;}};
  const model=new ControllerPicoUpdateModel({flash,owner,peer,transferKey,now:()=>now});t.after(()=>{model.close();flash.close();rmSync(root,{recursive:true,force:true});});
  const health=()=>({origin:'simulated',fixtureRecord:'synthetic-local-health-71',bootId:flash.identity.bootId,configurationDigest:configurationDigest(configuration),configurationHealthy:true,interfaceHealthy:true,outputsInhibited:true});
  return {flash,model,root,key,bytes,candidate,sign,health,clock:n=>{now=n;},alter:fn=>{alter=fn;},reserve:v=>{reserve=v;}};
}
test('controller integration consumes signed flash stage/trial, reports version and keeps commissioning/service gates',t=>{
  const f=fixture(t),old=f.flash.identity;const staged=f.model.stage(f.candidate,f.bytes,'stage-1','update-chain');assert.equal(staged.staged.releaseId,f.candidate.releaseId);
  assert.equal(staged.verifiedHostSlot.releaseId,baseline.releaseId);assert.equal(f.model.activate(f.candidate,'activate-1','update-chain').phase,'trial');assert.notEqual(f.flash.identity.bootId,old.bootId);
  f.clock(7999);const i=f.model.confirm(f.health());assert.equal(i.phase,'confirmed');assert.equal(i.verifiedHostSlot.releaseId,f.candidate.releaseId);assert.equal(i.staged,null);
  assert.equal(i.firmwareExecuted,false);assert.equal(i.remoteActivationSupported,false);assert.equal(i.requiresLocalService,true);assert.equal(i.actuationInhibited,true);
  assert.equal(i.commissioningReconciliationRequired,true);assert.equal(i.retainedMovingIntent,false);assert.equal(i.bootselRecoveryRehearsed,false);
});
test('moving, leased, Parked-only, stale, malformed and dependent protection cannot reserve or write a slot',t=>{
  const variants=[e=>{e.activeMotion=true;},e=>{e.manualLease=true;},e=>{e.mode='parked';},e=>{e.sampledMs=100;},
    e=>{e.identity.bootId='old-boot';},e=>{e.configurationDigest='0'.repeat(64);},e=>{e.protection.independentOwner='pico';},
    e=>{e.protection.lineClearance=null;},e=>{e.protection.restraint=false;},e=>{e.protection.stablePower=false;},e=>{e.outputsInhibited=false;},e=>{e.browserSafe=true;}];
  for(const alter of variants){const f=fixture(t),before=readFileSync(join(f.root,'flash.bin'));f.alter(alter);assert.throws(()=>f.model.stage(f.candidate,f.bytes,'stage-1','chain'));assert.ok(readFileSync(join(f.root,'flash.bin')).equals(before));}
  const f=fixture(t);f.reserve(false);assert.throws(()=>f.model.stage(f.candidate,f.bytes,'stage-1','chain'),{code:'OWNER_RESERVATION_REFUSED'});
});
test('actual artifact authenticity, target and compatibility checks precede activation; a failed stage retains the owner lock',t=>{
  const variants=[f=>({manifest:f.sign(f.candidate,f.bytes,generateKeyPairSync('ed25519')),bytes:f.bytes}),
    f=>({manifest:f.candidate,bytes:Buffer.from('truncated')}),f=>({manifest:f.sign({...f.candidate,target:{...f.candidate.target,boardId:'wrong-board'}}),bytes:f.bytes}),
    f=>({manifest:f.sign({...f.candidate,minimumUpdater:'9.0.0'}),bytes:f.bytes})];
  for(const input of variants){const f=fixture(t),v=input(f),before=readFileSync(join(f.root,'flash.bin'));assert.throws(()=>f.model.stage(v.manifest,v.bytes,'stage-1','chain'));
    assert.ok(readFileSync(join(f.root,'flash.bin')).equals(before));assert.equal(f.model.inventory.phase,'confirmed');assert.throws(()=>f.model.stage(f.candidate,f.bytes,'stage-2','chain'),{code:'NEW_BOOT_REQUIRED'});}
});
test('protection is rechecked at activation/confirmation and local timeout needs no cloud or ready claim',t=>{
  const f=fixture(t);f.model.stage(f.candidate,f.bytes,'stage-1','chain');f.alter(e=>{e.manualLease=true;});assert.throws(()=>f.model.activate(f.candidate,'activate-1','chain'),{code:'MANUAL_CONTROL_ACTIVE'});
  assert.equal(f.flash.status.phase,'staged');f.alter(()=>{});f.model.activate(f.candidate,'activate-2','chain');
  f.alter(e=>{e.protection.outputsIsolated=false;});assert.throws(()=>f.model.confirm(f.health()),{code:'UPDATE_SAFE_PROTECTION_REQUIRED'});f.clock(8000);
  const i=f.model.tick();assert.equal(i.phase,'rolled-back');assert.equal(i.verifiedHostSlot.releaseId,baseline.releaseId);assert.equal(i.actuationInhibited,true);
});
