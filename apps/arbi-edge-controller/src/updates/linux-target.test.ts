import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createPublicKey } from 'node:crypto';
import { mkdtempSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IsolatedLinuxUpdateTarget } from './linux-target.js';

import { createLinuxUpdateReference as fixture } from './linux-reference.js';

for(const kind of ['application','os'] as const)test(`actual native ${kind} A/B files retain persistent identity/configuration/capture and confirm without cloud health`,async()=>{
  const f=await fixture(kind);try{const id=await f.request(),result=await f.run(id);assert.equal(result.status,200);assert.equal(result.view.state,'healthy');f.preserve();
    for(const device of ['pod','edge']){const target=f.native.get(device)!,s=target.status;assert.equal(s.components[kind]!.slot,'b');assert.equal(s.manifest.artifact.kind,kind);assert.equal(s.boot.health,'passed');assert.equal(s.installations,1);assert.equal(s.physicalInstallationEnabled,false);assert.equal(s.secureBoot,'not-established');assert.equal(s.healthScope,'isolated-local-probes-not-hardware-boot');
      const stored=readFileSync(join(target.options.directory,'slots',`${kind}-b.image`));assert.equal(stored.length,4096);
      target.close();const restarted=new IsolatedLinuxUpdateTarget({...target.options,initial:undefined});f.native.set(device,restarted);f.r.orchestrator.options.targets.set(device,restarted);assert.equal(restarted.status.boot.recordId,s.boot.recordId);assert.equal(restarted.status.installations,1);}
    f.r.sourceMode('unavailable');assert.equal((await f.advance(id)).view.state,'healthy');assert.equal(f.native.get('pod')!.status.boot.health,'passed');f.preserve();
  }finally{await f.close();}
});
for(const kind of ['application','os'] as const)test(`failing native ${kind} trial restores signed known-good bytes and data and stops the canary`,async t=>{
  for(const device of ['pod','edge'])await t.test(device,async()=>{const f=await fixture(kind);try{f.fail.add(device);const id=await f.request(),result=await f.run(id);assert.equal(result.view.state,'rolled-back');const failed=f.native.get(device)!.status;assert.equal(failed.phase,'rolled-back');assert.equal(failed.boot.releaseId,`${device}-1.0.0`);assert.equal(failed.components[kind]!.slot,'a');assert.equal(failed.rollbacks,1);
    if(device==='pod')assert.equal(f.native.get('edge')!.status.installations,0);else assert.equal(f.native.get('pod')!.status.boot.health,'passed');
    assert.equal(f.r.dataStores.get(device)!.status.active.dataVersion,'1.0.0');f.preserve();assert.equal((await f.advance(id)).view.state,'rolled-back');assert.equal(f.native.get(device)!.status.rollbacks,1);
  }finally{await f.close();}});
});
test('native local owner excludes concurrent writers and rejects unsafe or contradictory image activation',async()=>{
  const f=await fixture();try{const target=f.native.get('pod')!;assert.throws(()=>new IsolatedLinuxUpdateTarget(target.options),/LINUX_TARGET_BUSY/);f.r.safety({manualControl:true});const id=await f.request(),result=await f.run(id);assert.equal(result.view.state,'blocked');assert.equal(f.native.get('pod')!.status.installations,0);f.preserve();
  }finally{await f.close();}
});
test('durable renamed image is adopted after interruption without automatic trial, then private preflight resumes the same identity',async()=>{
  const f=await fixture();try{f.faults.set('pod','image-rename');const id=await f.request(),result=await f.run(id);assert.equal(result.status,503);assert.equal(f.native.get('pod')!.status.phase,'write-intent');const prior=f.native.get('pod')!,journal=f.r.store.get(id).targets.find(t=>t.moduleId==='pod')!.journal;prior.close();f.faults.set('pod',null);
    const restarted=new IsolatedLinuxUpdateTarget({...prior.options,initial:undefined});f.native.set('pod',restarted);f.r.orchestrator.options.targets.set('pod',restarted);assert.equal(restarted.status.phase,'staged');assert.equal(restarted.status.boot.releaseId,'pod-1.0.0');assert.equal(restarted.observe(journal.request.operationId),null);assert.equal(restarted.status.installations,0);
    f.r.safety({manualControl:true});assert.throws(()=>restarted.resumeLocalTrial(journal),/MANUAL_CONTROL_ACTIVE/);f.r.safety({manualControl:false});restarted.resumeLocalTrial(journal);const recovered=await f.run(id);assert.equal(recovered.view.state,'healthy');assert.equal(restarted.status.installations,1);f.preserve();
  }finally{await f.close();}
});

test('unknown local first-boot health stays pending; losing the cloud source cannot roll back an otherwise healthy local boot',async()=>{
  const f=await fixture();try{f.unknown.add('pod');const id=await f.request(),pending=await f.run(id);assert.equal(pending.view.state,'recovery-required');assert.equal(pending.view.reason,'TARGET_HEALTH_PENDING');assert.equal(f.native.get('pod')!.status.boot.health,'unknown');
    f.r.sourceMode('unavailable');f.unknown.delete('pod');await f.advance(id);assert.equal(f.native.get('pod')!.status.boot.health,'passed');assert.equal(f.native.get('pod')!.status.rollbacks,0);f.preserve();f.r.sourceMode('complete');assert.equal((await f.run(id)).view.state,'healthy');
  }finally{await f.close();}
});
test('corrupt bytes, changed signature and native slot pressure leave the selected signed image and persistent files intact',async()=>{
  const f=await fixture('application',24576);try{
    f.r.orchestrator.options.afterReservation=()=>{const operation=f.r.store.list()[0]!;if(operation.targets[operation.index]!.moduleId==='pod')throw Error('isolated-before-native-dispatch');};
    const id=await f.request();assert.equal((await f.run(id)).status,503);const target=f.native.get('pod')!,journal=f.r.store.get(id).targets.find(t=>t.moduleId==='pod')!.journal,bytes=f.artifacts.get(journal.request.manifest.artifact.sha256)!;
    const wrong=Buffer.from(bytes);wrong[0]=wrong[0]!^1;assert.throws(()=>target.install(journal,wrong));assert.equal(target.status.installations,0);assert.equal(target.status.phase,'confirmed');
    const forged=structuredClone(journal);forged.request.manifest.artifact.signature.value='0'.repeat(128);assert.throws(()=>target.install(forged,bytes));assert.equal(target.status.boot.releaseId,'pod-1.0.0');
    for(const name of ['application-b.image','os-a.image','os-b.image'])writeFileSync(join(target.options.directory,'slots',name),Buffer.alloc(8192),{mode:0o600});
    assert.throws(()=>target.install(journal,bytes),/INSUFFICIENT_STORAGE/);assert.equal(target.status.boot.releaseId,'pod-1.0.0');assert.equal(target.status.installations,0);assert.equal(target.status.phase,'write-intent');f.preserve();
  }finally{await f.close();}
});

test('actual SIGKILL releases native file ownership; fresh owner adopts fsynced bytes and never repeats trial or confirmation',async t=>{
  const {UpdateTrustStore}=await import('./trust.js'),{UpdateMigrationStore}=await import('./migrations.js');
  for(const point of ['image-fsync','image-rename','trial','confirmed'])await t.test(point,async()=>{
    const root=mkdtempSync(join(tmpdir(),'arbi-linux-kill-'));let target:IsolatedLinuxUpdateTarget|undefined,trust:InstanceType<typeof UpdateTrustStore>|undefined,data:InstanceType<typeof UpdateMigrationStore>|undefined;
    const child=spawn(process.execPath,[new URL('./linux-crash-child.js',import.meta.url).pathname,root,point],{stdio:['ignore','ignore','pipe']});let output='';child.stderr.on('data',chunk=>{output+=String(chunk).slice(0,2048-output.length);});let timedOut=false;const ended=once(child,'exit'),timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},20000);
    try{const [code,signal]=await ended;clearTimeout(timer);assert.equal(timedOut,false,'isolated child deadline');assert.equal(code,null,output);assert.equal(signal,'SIGKILL');const record=JSON.parse(readFileSync(join(root,'crash-readback.json'),'utf8'));assert.equal(record.version,'arbi.isolated-linux-crash/1.0');
      trust=new UpdateTrustStore({path:record.trust.path,realm:record.realm,siteId:record.siteId,deviceId:'pod',rootId:record.trust.rootId,rootPublicKey:createPublicKey({key:Buffer.from(record.trust.spki,'base64'),format:'der',type:'spki'}),provisioningReviewId:record.trust.provisioningReviewId,clock:()=>({utcMs:record.now,reliable:true})});
      data=new UpdateMigrationStore({path:record.dataPath,realm:record.realm,siteId:record.siteId,deviceId:'pod',trust});
      target=new IsolatedLinuxUpdateTarget({directory:record.directory,realm:record.realm,siteId:record.siteId,deviceId:'pod',trust,data,maximumImageBytes:record.maximumImageBytes,maximumSlotBytes:record.maximumSlotBytes,now:()=>record.now,
        preflight:()=>({recordId:'synthetic-reviewed-crash-recovery',observedUtcMs:record.now,expiresUtcMs:record.now+30000,independentProtectionOwnerId:'synthetic-independent-retention',activeMotion:false,manualControl:false,maintenanceConflict:false,mode:'update-safe',retentionValidated:true,lineClearanceValidated:true,stablePower:true,localInterlock:true,targetProcedureValidated:true,provenance:'declared-isolated-procedure'}),
        health:()=>({provenance:'isolated-local-probe',agentStartup:'passed',configuration:'passed',durableState:'passed',localInterfaces:'passed',cameraInitialization:'passed',gimbalConfiguration:'passed',policyLoading:'not-applicable',osImageReadback:'not-applicable'})});
      if(['image-fsync','image-rename'].includes(point)){assert.equal(target.status.phase,'staged');assert.equal(target.status.installations,0);assert.equal(target.status.boot.releaseId,'pod-1.0.0');assert.equal(target.observe(record.journal.request.operationId),null);target.resumeLocalTrial(record.journal);}
      else{assert.equal(target.status.installations,1);assert.equal(target.status.phase,point==='trial'?'trial':'confirmed');}
      const before=target.status,boot=target.observe(record.journal.request.operationId)!;assert.equal(boot.health,'passed');assert.equal(target.status.installations,1);assert.equal(target.status.rollbacks,0);if(point==='confirmed')assert.equal(boot.recordId,before.boot.recordId);
      for(const name of ['identity','calibration','configuration','pending-capture'])assert.equal(readFileSync(join(record.directory,'persistent',name),'utf8'),`synthetic-pod-${name}-immutable`);
      assert.equal(readFileSync(join(record.directory,'slots','application-b.image')).length,4096);assert.equal(data.status.active.dataVersion,record.journal.request.configurationDataVersion);assert.equal(target.status.physicalInstallationEnabled,false);
    }finally{clearTimeout(timer);if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await ended;}target?.close();data?.close();trust?.close();rmSync(root,{recursive:true,force:true});}
  });
});

test('an unconfirmed local trial cannot become healthy after its original confirmation deadline',async()=>{
  const f=await fixture();try{f.unknown.add('pod');const id=await f.request();assert.equal((await f.run(id)).view.reason,'TARGET_HEALTH_PENDING');f.unknown.delete('pod');f.r.advanceClock(310000);const target=f.native.get('pod')!,journal=f.r.store.get(id).targets.find(t=>t.moduleId==='pod')!.journal;assert.throws(()=>target.observe(journal.request.operationId),/CONFIRMATION_DEADLINE_EXPIRED/);assert.equal(target.status.phase,'trial');assert.equal(target.status.boot.health,'unknown');assert.equal(target.status.installations,1);f.preserve();
  }finally{await f.close();}
});
