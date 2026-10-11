import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, openSync, closeSync, writeSync, statSync,writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { configurationDigest, produceRelease } from '@arbi/protocol';
import { SignedPicoFlashModel, picoFlashLayout, updateTransferMac } from './flash-model.mjs';
const configuration=JSON.parse(readFileSync(new URL('../../../packages/arbi-protocol/fixtures/configuration.json',import.meta.url),'utf8')).valid.configuration;
const releases=JSON.parse(readFileSync(new URL('../../../packages/arbi-protocol/fixtures/releases.json',import.meta.url),'utf8')).releaseSet.manifests;
const baseline=releases.find(m=>m.target.moduleId==='pico'&&m.build.version==='1.0.0');
function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'arbi-pico-flash-')),key=generateKeyPairSync('ed25519'),transferKey=Buffer.alloc(32,0x71),bytes=Buffer.alloc(20000,0x71);
  let now=0,cut=null,model,sequence=0n;
  const sign=(input,payload=bytes,signer=key)=>{const m=structuredClone(input);m.artifact.signature.keyId='synthetic-test-key';const r=produceRelease(m,payload,{keyId:'synthetic-test-key',privateKey:signer.privateKey});assert.ok(r.ok);return r.value;};
  const initial=sign(baseline),next=structuredClone(baseline);next.releaseId='pico-1.0.1';next.build.version='1.0.1';next.build.buildId='synthetic-next-build';const candidate=sign(next);
  const options={root,moduleId:'pico',configuration,dataVersion:'1.0.0',trust:{keyId:'synthetic-test-key',publicKey:key.publicKey},transferKey,
    peer:{deviceId:'edge',bootId:'edge-boot-1',sessionId:'edge-session-1'},peers:{edge:'1.1.0'},now:()=>now,fault:point=>{if(cut===point){cut=null;throw Object.assign(new Error('SIMULATED_POWER_CUT'),{code:'SIMULATED_POWER_CUT'});}}};
  model=new SignedPicoFlashModel({...options,initial:{manifest:initial,bytes}});t.after(()=>{model?.close();rmSync(root,{recursive:true,force:true});});
  const request=(action,manifest=candidate,override={})=>{
    const r={version:'arbi.synthetic-pico-transfer/1.0',action,commandId:`update-${++sequence}`,correlationId:'update-chain',source:options.peer,target:model.identity,sequence:String(sequence),expiresMonotonicMs:now+1000,manifestDigest:configurationDigest(manifest),
      preflight:{origin:'simulated',fixtureRecord:'synthetic-restraint-71',controllerPhase:'inhibited',manualAuthority:false,isolatedOutputs:true},...override};return {request:r,mac:updateTransferMac(r,transferKey)};
  };
  const reopen=()=>{model.close();model=new SignedPicoFlashModel(options);sequence=0n;return model;};
  const activate=()=>{const result=model.activate(request('activate'));sequence=0n;return result;};
  const health=()=>({origin:'simulated',fixtureRecord:'synthetic-local-health-71',bootId:model.identity.bootId,configurationDigest:configurationDigest(configuration),configurationHealthy:true,interfaceHealthy:true,outputsInhibited:true});
  return {root,key,bytes,initial,candidate,sign,options,request,reopen,activate,health,get model(){return model;},clock:value=>{now=value;},cut:point=>{cut=point;}};
}
test('signed inactive image stages, gets a fresh local trial and confirms without Internet or physical readiness',t=>{
  const f=fixture(t),old=f.model.identity,layout=picoFlashLayout();assert.equal(layout.flashBytes,4194304);assert.equal(statSync(join(f.root,'flash.bin')).size,layout.flashBytes);
  assert.ok(layout.partitions.every((p,i)=>p.offset%4096===0&&p.bytes%4096===0&&p.offset===(i?layout.partitions[i-1].offset+layout.partitions[i-1].bytes:0)));
  assert.equal(layout.partitions.at(-1).offset+layout.partitions.at(-1).bytes,layout.flashBytes);
  const before=readFileSync(join(f.root,'flash.bin')),a=layout.partitions.find(p=>p.name==='A');
  assert.equal(f.model.stage(f.request('stage'),f.candidate,f.bytes).phase,'staged');assert.ok(readFileSync(join(f.root,'flash.bin')).subarray(a.offset,a.offset+a.bytes).equals(before.subarray(a.offset,a.offset+a.bytes)));
  assert.equal(f.activate().phase,'trial');assert.notEqual(f.model.identity.bootId,old.bootId);f.clock(7999);
  const status=f.model.confirm(f.health());assert.equal(status.phase,'confirmed');assert.equal(status.installed.releaseId,f.candidate.releaseId);assert.equal(status.slot,'B');
  assert.equal(status.firmwareExecuted,false);assert.equal(status.actuationInhibited,true);assert.equal(status.physicalInstallationEnabled,false);assert.equal(status.remoteHardwareInstallationSupported,false);
  assert.ok(readFileSync(join(f.root,'flash.bin')).subarray(a.offset,a.offset+4096).every(x=>x===0xff));
  assert.equal(f.reopen().status.installed.releaseId,f.candidate.releaseId);assert.equal(f.model.status.configurationDigest,configurationDigest(configuration));
  assert.equal(readFileSync(join(f.root,'flash.bin')).includes(f.key.privateKey.export({format:'der',type:'pkcs8'})),false);
});
test('bad signatures/digests, size, target, compatibility, authority, expiry and replay fail before active-slot writes',t=>{
  const f=fixture(t),path=join(f.root,'flash.bin'),original=readFileSync(path);
  const invalid=[{manifest:f.sign(f.candidate,f.bytes,generateKeyPairSync('ed25519')),bytes:f.bytes,code:'INVALID_SIGNATURE'},
    {manifest:f.candidate,bytes:Buffer.from('truncated'),code:'ARTIFACT_MISMATCH'},
    {manifest:f.sign({...f.candidate,target:{...f.candidate.target,boardId:'wrong-board'}}),bytes:f.bytes,code:'TARGET_MISMATCH'},
    {manifest:f.sign({...f.candidate,minimumBootloader:'9.0.0'}),bytes:f.bytes,code:'INCOMPATIBLE'},
    {manifest:f.sign({...f.candidate,configuration:{...f.candidate.configuration,dataRange:{min:'2.0.0',max:'2.0.0'}}}),bytes:f.bytes,code:'INCOMPATIBLE'},
    {manifest:f.candidate,bytes:Buffer.alloc(1572864),code:'IMAGE_TOO_LARGE'}];
  for(const v of invalid){assert.throws(()=>f.model.stage(f.request('stage',v.manifest),v.manifest,v.bytes),{code:v.code});assert.ok(readFileSync(path).equals(original));}
  const tampered=f.request('stage');tampered.mac='0'.repeat(64);assert.throws(()=>f.model.stage(tampered,f.candidate,f.bytes),{code:'NOT_AUTHORIZED'});
  const expired=f.request('stage',f.candidate,{expiresMonotonicMs:0});assert.throws(()=>f.model.stage(expired,f.candidate,f.bytes),{code:'EPOCH_OR_SEQUENCE_MISMATCH'});
  // Reopen starts a new transport epoch and removes gaps made by rejected frames.
  f.reopen();assert.throws(()=>f.model.stage(f.request('stage',f.candidate,{expiresMonotonicMs:0}),f.candidate,f.bytes),{code:'DEADLINE_EXPIRED'});
  f.reopen();const moving=f.request('stage');moving.request.preflight.controllerPhase='moving';moving.mac=updateTransferMac(moving.request,f.options.transferKey);assert.throws(()=>f.model.stage(moving,f.candidate,f.bytes),{code:'PREFLIGHT_REQUIRED'});
  f.reopen();const valid=f.request('stage');f.model.stage(valid,f.candidate,f.bytes);assert.throws(()=>f.model.stage(valid,f.candidate,f.bytes),{code:'EPOCH_OR_SEQUENCE_MISMATCH'});
});
test('failed, expired, clock-invalid and restarted trials return to a verified old image with new inhibited epochs',t=>{
  for(const scenario of ['failed','timeout','clock','restart']) {
    const f=fixture(t);f.model.stage(f.request('stage'),f.candidate,f.bytes);f.activate();const trial=f.model.identity;
    if(scenario==='failed')assert.throws(()=>f.model.confirm({...f.health(),interfaceHealthy:false}),{code:'LOCAL_HEALTH_FAILED'});
    if(scenario==='timeout'){f.clock(8000);f.model.tick();assert.throws(()=>f.model.confirm(f.health()),{code:'INVALID_LOCAL_HEALTH'});}
    if(scenario==='clock'){f.clock(10);f.model.tick();f.clock(9);assert.throws(()=>f.model.tick(),{code:'CLOCK_INVALID'});}
    if(scenario==='restart')assert.notEqual(f.reopen().identity.bootId,trial.bootId);
    assert.equal(f.model.status.phase,'rolled-back');assert.equal(f.model.status.installed.releaseId,f.initial.releaseId);assert.equal(f.model.status.actuationInhibited,true);
  }
});
test('cuts across erase/program/journal/trial/confirmation preserve an authentic boot choice and protected configuration',t=>{
  for(const point of ['after-inactive-erase','after-image-chunk','after-image-header','after-journal-erase','before-journal-commit','after-journal-commit','before-trial-entry','after-confirmation','after-old-image-invalidation']) {
    const f=fixture(t);const config=picoFlashLayout().partitions.find(p=>p.name==='configuration'),before=readFileSync(join(f.root,'flash.bin')).subarray(config.offset,config.offset+config.bytes);
    if(['before-trial-entry','after-confirmation','after-old-image-invalidation'].includes(point)){f.model.stage(f.request('stage'),f.candidate,f.bytes);if(point!=='before-trial-entry')f.activate();}
    f.cut(point);assert.throws(()=>point==='before-trial-entry'?f.activate():point.startsWith('after-confirm')||point==='after-old-image-invalidation'?f.model.confirm(f.health()):f.model.stage(f.request('stage'),f.candidate,f.bytes),{code:'SIMULATED_POWER_CUT'});
    const status=f.reopen().status;assert.ok([f.initial.releaseId,f.candidate.releaseId].includes(status.installed.releaseId));assert.notEqual(status.phase,'trial');assert.equal(status.actuationInhibited,true);
    assert.ok(readFileSync(join(f.root,'flash.bin')).subarray(config.offset,config.offset+config.bytes).equals(before));
  }
});
test('exclusive native lock prevents simultaneous installers and corrupted signed slot/configuration requires service',t=>{
  const f=fixture(t);assert.throws(()=>new SignedPicoFlashModel(f.options),{code:'LOCAL_BUSY'});
  const path=join(f.root,'flash.bin'),config=picoFlashLayout().partitions.find(p=>p.name==='configuration');f.model.close();
  const fd=openSync(path,'r+');writeSync(fd,Buffer.from([0]),0,1,config.offset);closeSync(fd);
  assert.throws(()=>f.reopen(),{code:'CONFIGURATION_MISMATCH'});
});
test('an actually killed native process leaves a durable trial that restarts on the verified old image',async t=>{
  const f=fixture(t);f.model.stage(f.request('stage'),f.candidate,f.bytes);f.model.close();
  const path=join(f.root,'child-fixture.json');writeFileSync(path,JSON.stringify({root:f.root,configuration,manifest:f.candidate,publicKey:f.key.publicKey.export({format:'der',type:'spki'}).toString('base64')}),{mode:0o600});
  const child=spawn(process.execPath,[new URL('./flash-model-child.mjs',import.meta.url).pathname,path],{stdio:['pipe','pipe','pipe']});
  t.after(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');});
  let text='',stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});
  const started=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Synthetic child startup timeout')),10000);child.once('error',reject);child.once('exit',code=>{if(!text.includes('\n')){clearTimeout(timer);reject(Error(`Child exited ${code}: ${stderr}`));}});child.stdout.on('data',chunk=>{text+=chunk;if(text.includes('\n')){clearTimeout(timer);resolve(JSON.parse(text.split('\n')[0]));}});});
  assert.equal(started.phase,'trial');const exited=once(child,'exit');child.kill('SIGKILL');await exited;
  const status=f.reopen().status;assert.equal(status.phase,'rolled-back');assert.equal(status.installed.releaseId,f.initial.releaseId);assert.notEqual(status.identity.bootId,started.bootId);assert.equal(status.actuationInhibited,true);
});
