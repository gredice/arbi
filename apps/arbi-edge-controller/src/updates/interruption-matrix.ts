import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {canonical,missingRanges} from '@arbi/audit';
import {correlateAuditEvent} from '@arbi/protocol';
import {createUpdateReference} from './reference.js';
import {createLinuxUpdateReference} from './linux-reference.js';
import {runLinuxCrashReference} from './linux-crash-reference.js';
import type {UpdateOrchestrator} from './orchestrator.js';
type View=ReturnType<UpdateOrchestrator['view']>;
type Reference=Awaited<ReturnType<typeof createUpdateReference>>;
export const updateFaultScenarios=['ordered-success','truncated-download','rejected-retry','corrupt-artifact','lost-target-ack','unobserved-reservation','failed-pod-canary','mixed-version-floor','operation-write-interruption'] as const;
type Scenario=typeof updateFaultScenarios[number];
async function step(r:Reference,id:string,expectedStatus=200){const response=await r.request('advance',{operationId:id});assert.equal(response.status,expectedStatus);return response.json() as Promise<View>;}
async function finish(r:Reference,id:string){let view:View|undefined;for(let n=0;n<24;n++){view=await step(r,id);if(['healthy','rolled-back','recovery-required','blocked','failed'].includes(view.state))return view;}assert.fail('matrix operation did not settle');}
async function scenario(id:Scenario){
  const began=performance.now(),directory=mkdtempSync(join(tmpdir(),'arbi-update-matrix-')),native=id==='ordered-success'||id==='failed-pod-canary'?await createLinuxUpdateReference('application',65536,directory):null;
  const r=native?.r??await createUpdateReference(directory,{payloadBytes:['truncated-download','rejected-retry'].includes(id)?70000:256,afterReservation:id==='unobserved-reservation'?()=>{throw Error('isolated-reservation-interruption');}:undefined});
  try{
    if(id==='truncated-download')r.sourceMode('interrupt-once');if(id==='rejected-retry')r.sourceMode('reject-once');if(id==='corrupt-artifact')r.sourceMode('corrupt-once');if(id==='failed-pod-canary')native!.fail.add('pod');if(id==='mixed-version-floor')r.health('pico','unknown');
    const response=await r.request('request',{key:'matrix-'+id,releaseSetId:r.set.releaseSetId,targets:native?['pico','pod','edge']:['pico'],allowMetered:true});assert.equal(response.status,202);const admitted=await response.json() as View;
    let view:View;
    if(id==='lost-target-ack'){r.slotFault('pico','after-commit');await step(r,admitted.operationId,503);assert.equal(r.targets.get('pico')!.status.installations,1);r.slotFault('pico',null);r.restart();view=await finish(r,admitted.operationId);}
    else if(id==='unobserved-reservation'){await step(r,admitted.operationId,503);r.restart();view=await step(r,admitted.operationId);assert.equal(view.reason,'RESERVED_INSTALLATION_UNOBSERVED_NO_RESEND');}
    else if(id==='operation-write-interruption'){r.storeFault('before-commit');await step(r,admitted.operationId,503);r.storeFault(null);r.restart();view=await finish(r,admitted.operationId);}
    else if(id==='mixed-version-floor'){view=await step(r,admitted.operationId);assert.equal(view.reason,'TARGET_HEALTH_PENDING');r.raiseFloor('pico');r.health('pico','failed');view=await step(r,admitted.operationId);}
    else if(id==='corrupt-artifact')view=await step(r,admitted.operationId);
    else if(['truncated-download','rejected-retry'].includes(id)){const first=await step(r,admitted.operationId);assert.equal(first.targets[0]!.transfer!.offset,id==='truncated-download'?4096:0);r.restart();view=await finish(r,admitted.operationId);}
    else view=await finish(r,admitted.operationId);
    const expected=id==='failed-pod-canary'?'rolled-back':['unobserved-reservation','mixed-version-floor'].includes(id)?'recovery-required':id==='corrupt-artifact'?'paused':'healthy';assert.equal(view.state,expected,id+': '+view.reason);
    if(id==='corrupt-artifact')assert.equal(view.reason,'DIGEST_MISMATCH');if(id==='mixed-version-floor')assert.equal(view.reason,'SECURITY_DOWNGRADE_BLOCKED');
    const targets=view.targets.map(t=>{const target=native?.native.get(t.moduleId)??r.targets.get(t.moduleId)!;return {moduleId:t.moduleId,installed:t.status.installed.releaseId,confirmed:t.status.confirmed.releaseId,installations:target.status.installations,rollbacks:target.status.rollbacks,storage:native?.native.has(t.moduleId)?'native-signed-files':'sqlite-slot-model'};});
    if(['corrupt-artifact','unobserved-reservation'].includes(id))assert.equal(targets[0]!.installations,0);
    if(id==='failed-pod-canary'){assert.equal(targets[1]!.rollbacks,1);assert.equal(targets[2]!.installations,0);assert.equal(targets[2]!.installed,'edge-1.0.0');native!.preserve();}
    assert.ok(targets.every(t=>t.installations<=1));assert.equal(view.physicalInstallationEnabled,false);
    const audit=r.store.audit(),streams=new Map<string,string[]>();for(const e of audit){const key=canonical(e.source),values=streams.get(key)??[];values.push(e.sequence);streams.set(key,values);
      if(e.evidence==='update-observation'||e.evidence==='device-outcome'){const root=audit.find(a=>a.eventId===e.links.intentEventId)!;assert.ok(root);assert.equal(correlateAuditEvent(root,e).ok,true);assert.deepEqual(e.actor,r.actor);assert.equal(e.links.sessionId,r.credential.sessionId);}
    }
    for(const sequences of streams.values())assert.deepEqual(missingRanges(sequences),[]);
    const sentPayloadBytes=r.requests.reduce((sum,q)=>sum+q.sentPayloadBytes,0),chargedPayloadBytes=view.targets.flatMap(t=>t.usageCharges).reduce((sum,c)=>sum+c.bytes,0),unreconciledPayloadBytes=view.targets.reduce((sum,t)=>sum+t.receiptCoverage.unreconciledPayloadBytes,0),missingReceipts=view.targets.reduce((sum,t)=>sum+t.receiptCoverage.missingChargeIds.length,0);
    assert.equal(missingReceipts,0);assert.equal(unreconciledPayloadBytes,0);assert.equal(chargedPayloadBytes,sentPayloadBytes);assert.equal(audit.filter(e=>e.metadata.byteCount).reduce((sum,e)=>sum+e.metadata.byteCount!,0),chargedPayloadBytes);
    if(id==='truncated-download')assert.equal(sentPayloadBytes,70000);if(id==='rejected-retry')assert.equal(sentPayloadBytes,78192);
    return {id,result:'passed' as const,durationMs:performance.now()-began,state:view.state,reason:view.reason,targets,artifactIdentities:view.targets.map(t=>({moduleId:t.moduleId,releaseId:t.status.desired.releaseId,sha256:r.store.get(admitted.operationId).targets.find(x=>x.moduleId===t.moduleId)!.manifest.artifact.sha256})),
      traffic:{boundary:'localhost-artifact-http',layer:'application-payload',coverage:'complete-fixture-interval',sentPayloadBytes,chargedPayloadBytes,retryRequests:r.requests.length,wireBytes:null,carrierBytes:null},audit:{events:audit.length,sequenceGaps:0,missingReceipts,unreconciledPayloadBytes},physicalAcceptance:false as const};
  }finally{if(native)await native.close();else{await r.close();rmSync(directory,{recursive:true,force:true});}}
}
/** Opt-in reproducible host matrix. It supplies evidence, never rollout authority. */
export async function runUpdateInterruptionMatrix(){
  const cases=[];for(const id of updateFaultScenarios)cases.push(await scenario(id));
  const crashes=[];for(const point of ['image-fsync','image-rename','trial','confirmed'] as const)crashes.push(await runLinuxCrashReference(point));
  const build=JSON.parse(readFileSync(new URL('../build-identity.json',import.meta.url),'utf8')) as {sourceDigest:string};assert.match(build.sourceDigest,/^[a-f0-9]{64}$/);
  return {version:'arbi.update-interruption-evidence/1.0',sourceDigest:build.sourceDigest,setup:{node:process.version,platform:process.platform,architecture:process.arch,health:'declared-isolated-probes',bootloader:'unselected',actuatorOutput:'not-connected'},cases,crashes,
    canaryPolicy:{order:['pico','pod','edge'],failedCanary:'halt-later-targets',retry:'explicit-current-authority',fieldRolloutEnabled:false},
    physicalGates:[{id:'pico-board-power-interruption',issue:71,status:'blocked'},{id:'linux-real-boot-and-brownout',issue:44,status:'blocked'},{id:'retention-line-clearance-power-loss',issue:76,status:'blocked'},{id:'secured-frame-and-installed-recovery',issue:79,status:'blocked'}],physicalAcceptance:false,publicOperationReady:false};
}
