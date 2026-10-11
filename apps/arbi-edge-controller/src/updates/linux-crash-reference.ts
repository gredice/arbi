import assert from 'node:assert/strict';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {createPublicKey} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {IsolatedLinuxUpdateTarget} from './linux-target.js';
import {UpdateTrustStore} from './trust.js';
import {UpdateMigrationStore} from './migrations.js';
/** Native process/file recovery reference. Declared local probes; no real boot. */
export async function runLinuxCrashReference(point:'image-fsync'|'image-rename'|'trial'|'confirmed'){
  const began=performance.now();
    const root=mkdtempSync(join(tmpdir(),'arbi-linux-kill-'));let target:IsolatedLinuxUpdateTarget|undefined,trust:InstanceType<typeof UpdateTrustStore>|undefined,data:InstanceType<typeof UpdateMigrationStore>|undefined;
    const child=spawn(process.execPath,[fileURLToPath(new URL('./linux-crash-child.js',import.meta.url)),root,point],{stdio:['ignore','ignore','pipe']});let output='';child.stderr.on('data',chunk=>{output+=String(chunk).slice(0,2048-output.length);});let timedOut=false;const ended=once(child,'exit'),timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},20000);
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
      return {point,durationMs:performance.now()-began,signal:'SIGKILL' as const,installations:target.status.installations,releaseId:boot.releaseId,artifactSha256:record.journal.request.manifest.artifact.sha256,preservedFiles:4,physicalInstallationEnabled:false as const};
    }finally{clearTimeout(timer);if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await ended;}target?.close();data?.close();trust?.close();rmSync(root,{recursive:true,force:true});}
}
