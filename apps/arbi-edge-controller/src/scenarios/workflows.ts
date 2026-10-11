import assert from 'node:assert/strict';
import { mkdirSync,readdirSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest,missingRanges,canonical } from '@arbi/audit';
import type { AuditEvent } from '@arbi/protocol';
import { createJobReference } from '../jobs/reference.js';
import { createUpdateReference } from '../updates/reference.js';

export interface WorkflowTrace {
  version:'arbi.fault-workflow/1.0';id:string;seed:number;injectedAtMs:number|null;
  expected:{state:string;reason?:string;bandwidth:string;audit:string};
  observed:{state:string;reason:string|null;dispatches:number;applicationPayloadBytes:number|null};
  trace:unknown[];semanticDigest:string;physicalAcceptance:false;
}
export function workflowTrace(input:Omit<WorkflowTrace,'version'|'semanticDigest'|'physicalAcceptance'>):WorkflowTrace {
  if(!Number.isSafeInteger(input.seed)||input.seed<0||input.seed>4294967295||!input.id||input.trace.length>256)throw Error('INVALID_SCENARIO');
  return {...input,version:'arbi.fault-workflow/1.0',semanticDigest:digest(input),physicalAcceptance:false};
}
/** Stable semantic projection; original signed journals remain in the private experiment directory. */
export function auditTrace(events:AuditEvent[]){const correlations=new Map<string,number>();return events.map(e=>{if(!correlations.has(e.links.correlationId))correlations.set(e.links.correlationId,correlations.size+1);return {action:e.action,evidence:e.evidence,outcome:e.outcome,reason:e.reason,actor:e.actor.id,correlation:correlations.get(e.links.correlationId),
  intentEventIndex:e.links.intentEventId?events.findIndex(root=>root.eventId===e.links.intentEventId):null,commandId:e.links.commandId?.startsWith('fault-')?e.links.commandId:null,phase:e.metadata.updatePhase??null,bytes:e.metadata.byteCount??null};});}
export async function runLocalFaultWorkflows(directory:string,seed:number):Promise<WorkflowTrace[]> {
  if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('INVALID_SEED');mkdirSync(directory,{recursive:true,mode:0o700});if(readdirSync(directory).length)throw Error('EMPTY_ISOLATED_DIRECTORY_REQUIRED');
  let random=seed>>>0;const draw=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random;},traces:WorkflowTrace[]=[];
  const faults=['driver-alarm','lost-reference','sensor-disagreement','pod-reset','power-instability','command-timeout','edge-restart','cloud-outage'] as const;
  for(const fault of faults){const path=join(directory,fault);let r=createJobReference(path),priorDispatches=0;const at=1050+(draw()%3)*50;
    try{const command=r.command;command.command.commandId=`fault-${fault}`;command.command.idempotencyKey=`fault-${fault}`;command.messageId=`message-${fault}`;
      const admitted=r.consumer.receive(command);assert.equal(admitted.outcome,'accepted');r.advance(1000);
      if(fault==='edge-restart'){priorDispatches=r.adapter.dispatches.length;r.close();r=createJobReference(path);}
      else{
        if(fault==='driver-alarm')r.adapter.modules.disturb({kind:'driver-fault',active:true,atMs:at,order:0});
        if(fault==='lost-reference')r.authority.conditions.reference.value='unknown';
        if(fault==='sensor-disagreement')r.authority.conditions.protection.value='unknown';
        if(fault==='pod-reset')r.authority.modules.pod.source.bootId='synthetic-replaced-pod-boot';
        if(fault==='power-instability')r.adapter.modules.disturb({kind:'power',available:true,voltageV:39,atMs:at,order:0});
        if(fault==='command-timeout')r.authority.gate.nowMonotonicMs=10000;
        if(fault==='cloud-outage'){r.authority.cloudConnected=false;r.authority.conditions.fault.value='deny';}
        if(fault==='command-timeout')r.advance(10000);else r.advance(at);
      }
      const reason=fault==='pod-reset'?'RESYNC_REQUIRED':fault==='edge-restart'?'INTERRUPTED':fault==='command-timeout'?'DEADLINE_EXPIRED':fault==='cloud-outage'?'LEASE_EXPIRED':'FAULT_INHIBITED';
      const result=r.journal.get(command.command.commandId)!;assert.equal(result.error,reason);assert.equal(result.outcome,'failed');assert.equal(result.state,'Fault');assert.equal(r.consumer.status.recoveryRequired,true);
      const dispatches=r.adapter.dispatches.length;assert.equal(r.consumer.receive(command).event.messageId,result.event.messageId);assert.equal(r.consumer.tick(),null);assert.equal(r.adapter.dispatches.length,dispatches);
      const records=r.journal.records(command.command.commandId),events=r.relay.pendingSpools().flatMap(spool=>spool.pending(64));
      // Preserve historical producer streams across restart; event IDs remain unique.
      const audit=[...new Map(events.map(e=>[e.eventId,e])).values()];assert.ok(audit.some(e=>e.evidence==='intent'));assert.ok(audit.some(e=>e.evidence==='connection-loss'&&e.outcome==='interrupted'));
      assert.ok(audit.every(e=>e.actor.id===command.command.actor.id));
      traces.push(workflowTrace({id:fault,seed,injectedAtMs:fault==='command-timeout'?10000:fault==='edge-restart'?1000:at,expected:{state:'Fault/recovery-required',reason,bandwidth:'local-stop-independent-of-optional-transfer',audit:'attributed-intent-and-interrupted-unknown-effect'},
        observed:{state:result.state,reason:result.error,dispatches:priorDispatches+dispatches,applicationPayloadBytes:null},
        trace:[...records.map(x=>({outcome:x.outcome,state:x.state,phase:x.phase,error:x.error,commandId:x.command.command.commandId,sequence:x.event.sequence})),...auditTrace(audit)]}));
    }finally{r.close();}
  }
  for(const fault of ['interrupted-download','failed-canary','incompatible-release','corrupt-artifact'] as const){const f=await createUpdateReference(join(directory,fault),{payloadBytes:70000,allowanceBytes:70000});
    try{const body={key:`fault-${fault}`,releaseSetId:f.set.releaseSetId,targets:fault==='failed-canary'?['pico','pod','edge']:['pico'],allowMetered:true};
      if(fault==='incompatible-release'){f.composition.sets[0]!.manifests.find(m=>m.releaseId==='pico-1.1.0')!.artifact.signature.value='0'.repeat(128);const response=await f.request('request',body);assert.equal(response.status,409);assert.equal(f.store.list().length,0);assert.equal(f.requests.length,0);
        traces.push(workflowTrace({id:fault,seed,injectedAtMs:0,expected:{state:'rejected',bandwidth:'zero-artifact-bytes',audit:'attributed-current-authorization-without-installation'},observed:{state:'rejected',reason:(await response.json()).error,dispatches:0,applicationPayloadBytes:0},trace:auditTrace(f.store.audit())}));continue;}
      if(fault==='interrupted-download')f.sourceMode('interrupt-once');if(fault==='failed-canary')f.health('pico','failed');if(fault==='corrupt-artifact')f.sourceMode('corrupt-once');
      const admitted=await f.request('request',body);assert.equal(admitted.status,202);let view=await admitted.json() as ReturnType<typeof f.orchestrator.view>;
      for(let i=0;i<4;i++){const response=await f.request('advance',{operationId:view.operationId});assert.equal(response.status,200);view=await response.json();if(i===0&&fault==='interrupted-download'){assert.equal(view.targets[0]!.transfer?.offset,4096);f.restart();assert.equal(f.store.get(view.operationId).id,view.operationId);}if(['healthy','rolled-back','blocked','failed','recovery-required'].includes(view.state)||view.reason==='DIGEST_MISMATCH')break;}
      assert.equal(view.state,fault==='failed-canary'?'rolled-back':fault==='corrupt-artifact'?'paused':'healthy');
      if(fault==='failed-canary')assert.equal(f.targets.get('pod')!.status.installations,0);if(fault==='corrupt-artifact')assert.equal(f.targets.get('pico')!.status.installations,0);
      const charged=view.targets.flatMap(t=>t.usageCharges).reduce((n,c)=>n+c.bytes,0);assert.equal(charged,70000);assert.equal(charged,f.requests.reduce((n,r)=>n+r.sentPayloadBytes,0));assert.equal(f.budget.status.remainingBytes,0);
      // Essential traffic has an independent reservation/concurrency/rate pool after discretionary exhaustion.
      f.budget.start({id:'required-health',class:'essential',direction:'upload',expectedBytes:64,artifactDigest:null,stream:false,bitrate:null,overrideId:null});const grant=f.budget.grant('required-health',64);f.budget.settle('required-health',grant.id,64,64);f.budget.finish('required-health');
      assert.throws(()=>{f.budget.start({id:'blocked-optional',class:'media',direction:'upload',expectedBytes:64,artifactDigest:null,stream:false,bitrate:null,overrideId:null});f.budget.grant('blocked-optional',64);},/QUOTA/);
      const audit=f.store.audit();for(const source of new Set(audit.map(e=>canonical(e.source))))assert.deepEqual(missingRanges(audit.filter(e=>canonical(e.source)===source).map(e=>e.sequence)),[]);
      assert.ok(audit.filter(e=>e.evidence==='update-observation'||e.evidence==='device-outcome').every(e=>e.actor.id===f.actor.id&&e.links.sessionId===f.credential.sessionId));
      traces.push(workflowTrace({id:fault,seed,injectedAtMs:0,expected:{state:fault==='failed-canary'?'rolled-back':fault==='corrupt-artifact'?'paused':'healthy',bandwidth:'70000-payload-bytes-including-retry;essential-health-allowed;optional-media-denied',audit:'original-actor-session-and-terminal-or-policy-outcome'},
        observed:{state:view.state,reason:view.reason,dispatches:[...f.targets.values()].reduce((n,t)=>n+t.status.installations,0),applicationPayloadBytes:charged},
        trace:[{class:'essential',simulatedHealthPayloadBytes:64,transport:'not-executed',optionalMedia:'QUOTA_EXHAUSTED'},...f.requests.map(r=>({offset:r.offset,requestedBytes:r.requestedBytes,sentPayloadBytes:r.sentPayloadBytes})),...view.targets.map(t=>({module:t.moduleId,phase:t.phase,installed:t.status.installed.releaseId,confirmed:t.status.confirmed.releaseId})),...auditTrace(audit)]}));
    }finally{await f.close();}
  }
  return traces;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==6||process.argv[2]!=='--seed'||process.argv[4]!=='--directory'){process.stderr.write('ISOLATED_SEED_AND_DIRECTORY_REQUIRED\n');process.exitCode=2;}
  else try{process.stdout.write(JSON.stringify(await runLocalFaultWorkflows(resolve(process.argv[5]!),Number(process.argv[3])),null,2)+'\n');}catch{process.stderr.write('FAULT_WORKFLOW_FAILED\n');process.exitCode=1;}
}
