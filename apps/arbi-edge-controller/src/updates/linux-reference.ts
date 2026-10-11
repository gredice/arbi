import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IsolatedLinuxUpdateTarget,type LinuxLocalHealth,type LinuxFaultPoint } from './linux-target.js';
import { createUpdateReference } from './reference.js';

/** Explicit synthetic probe recipe for native file/owner integration; not a deployed Linux bootloader. */
export async function createLinuxUpdateReference(kind:'application'|'os'='application',slotBytes=65536,rootDirectory?:string,onFault?:(deviceId:string,point:LinuxFaultPoint)=>void){
  const root=rootDirectory??mkdtempSync(join(tmpdir(),'arbi-linux-slots-')),r=await createUpdateReference(root,{payloadBytes:4096,linuxArtifactKind:kind}),native=new Map<string,IsolatedLinuxUpdateTarget>();
  const artifacts=new Map(r.set.manifests.map(m=>[m.artifact.sha256,r.targets.get(m.target.moduleId)!.options.baselineArtifact(m.artifact.sha256)]));
  const faults=new Map<string,LinuxFaultPoint|null>(),fail=new Set<string>(),unknown=new Set<string>();
  for(const id of ['pod','edge'] as const){const original=r.targets.get(id)!,directory=join(root,`${id}-native`);mkdirSync(directory,{mode:0o700});mkdirSync(join(directory,'persistent'),{mode:0o700});
    for(const name of ['identity','calibration','configuration','pending-capture'])writeFileSync(join(directory,'persistent',name),`synthetic-${id}-${name}-immutable`,{mode:0o600});
    const options={directory,realm:r.realm,siteId:r.siteId,deviceId:id,trust:original.options.trust,data:original.options.data,maximumImageBytes:8192,maximumSlotBytes:slotBytes,initial:original.options.initial!,now:r.now,preflight:()=>r.composition.safety(),
      health:({manifest}:{manifest:{build:{version:string}}}):LinuxLocalHealth=>({provenance:'isolated-local-probe',agentStartup:manifest.build.version==='1.1.0'&&fail.has(id)?'failed':manifest.build.version==='1.1.0'&&unknown.has(id)?'unknown':'passed',configuration:'passed',durableState:'passed',localInterfaces:'passed',cameraInitialization:id==='pod'?'passed':'not-applicable',gimbalConfiguration:id==='pod'?'passed':'not-applicable',policyLoading:id==='edge'?'passed':'not-applicable',osImageReadback:kind==='os'?'passed':'not-applicable'}),fault:(point:LinuxFaultPoint)=>{onFault?.(id,point);if(faults.get(id)===point)throw Error(`isolated-interruption-${point}`);}};
    original.close();const target=new IsolatedLinuxUpdateTarget(options);native.set(id,target);r.orchestrator.options.targets.set(id,target);
  }
  const request=async()=>{const response=await r.request('request',{key:'synthetic-linux-operation',releaseSetId:r.set.releaseSetId,targets:['pico','pod','edge'],allowMetered:true});assert.equal(response.status,202);return (await response.json() as {operationId:string}).operationId;};
  const advance=async(id:string)=>{const response=await r.request('advance',{operationId:id});return {status:response.status,view:await response.json() as {state:string;reason:string|null}};};
  const run=async(id:string)=>{let last;for(let i=0;i<30;i++){last=await advance(id);if(last.status>=500||['healthy','rolled-back','blocked','recovery-required'].includes(last.view.state))return last;}throw Error('OPERATION_DID_NOT_SETTLE');};
  const preserve=()=>{for(const id of ['pod','edge'])for(const name of ['identity','calibration','configuration','pending-capture'])assert.equal(readFileSync(join(root,`${id}-native`,'persistent',name),'utf8'),`synthetic-${id}-${name}-immutable`);};
  return {root,r,native,artifacts,faults,fail,unknown,request,advance,run,preserve,async close(){await r.close();rmSync(root,{recursive:true,force:true});}};
}

