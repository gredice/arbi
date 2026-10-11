import { createServer } from 'node:http';
import { mkdirSync,readFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync,randomBytes,randomUUID,sign } from 'node:crypto';
import { digest } from '@arbi/audit';
import { produceRelease } from '@arbi/protocol';
import type { ReleaseInventory,ReleaseManifest,ReleaseSet,Identity,Realm } from '@arbi/protocol';
import { createIsolatedIdentityProvider } from '@arbi/gredice/testing';
import type { Role } from '@arbi/gredice';
import { TransferBudget,type TransferPolicy } from '../transfers/budget.js';
import { ArtifactCache } from '../transfers/artifacts.js';
import { UpdateTrustStore,trustSigningBytes,type TrustPolicy } from './trust.js';
import { UpdateMigrationStore } from './migrations.js';
import { UpdateOperationStore } from './operation-store.js';
import { IsolatedRangeSource } from './range-source.js';
import { SimulatedUpdateTarget } from './simulated-target.js';
import { UpdateOrchestrator } from './orchestrator.js';
import { UpdateServer } from './server.js';
import type { LocalUpdateSafety } from './safety.js';
/** Explicit private test recipe with ephemeral signing/provider secrets; ordinary startup never selects it. */
export async function createUpdateReference(directory:string,options:{initialUtcMs?:number;realm?:Realm;siteId?:string;payloadBytes?:number;linuxArtifactKind?:'application'|'os';allowanceBytes?:number;afterReservation?:()=>void;storeFault?:('before-commit'|'after-commit')|null}={}){
  mkdirSync(directory,{recursive:true,mode:0o700});
  const f=JSON.parse(readFileSync(new URL('../../../../packages/arbi-protocol/fixtures/releases.json',import.meta.url),'utf8')) as {inventory:ReleaseInventory;releaseSet:ReleaseSet};
  const realm=options.realm??{environment:'test' as const,namespaceId:'synthetic-update-operations'},siteId=options.siteId??'synthetic-site';if(realm.environment!=='test')throw Error('ISOLATED_REALM_REQUIRED');let now=options.initialUtcMs??Date.parse('2026-10-11T00:00:00.000Z');const clockStart=now;
  const root=generateKeyPairSync('ed25519'),key=generateKeyPairSync('ed25519');const bytes=new Map<string,Buffer>();
  const set=structuredClone(f.releaseSet);set.releaseSetId='synthetic-coordinator-last';set.manifests=set.manifests.map(input=>{const m=structuredClone(input);for(const d of m.dependencies)d.versions={min:'1.0.0',max:'1.1.0'};
    if(m.configuration.migration)m.configuration.migration.recordId='synthetic-reversible-migration';
    if(options.linuxArtifactKind&&m.target.moduleId!=='pico')m.artifact.kind=options.linuxArtifactKind;
    m.artifact.signature.keyId='synthetic-release-key';
    const payload=Buffer.alloc(m.build.version==='1.0.0'?128:options.payloadBytes??70000,42);payload.write(`synthetic:${m.releaseId}:no-actuation`);const r=produceRelease(m,payload,{keyId:'synthetic-release-key',privateKey:key.privateKey});if(!r.ok)throw Error(r.error.code);bytes.set(r.value.artifact.sha256,payload);return r.value;});
  set.steps=['pico','pod','edge'].map(id=>set.desired.find(s=>s.moduleId===id)!);set.order=set.steps.map((s,i)=>({moduleId:s.moduleId,after:set.steps.slice(0,i).map(p=>p.moduleId)}));
  set.rollbackPaths=[1,2,3].map(afterStep=>({afterStep,steps:set.steps.slice(0,afterStep).reverse().map(s=>set.initial.find(p=>p.moduleId===s.moduleId)!)}));
  const inventory={...structuredClone(f.inventory),realm,siteId};
  let policy:TrustPolicy={schemaVersion:'arbi.trust/1.0',realm,siteId,revision:1,previousDigest:'0'.repeat(64),issuedAtUtc:new Date(now).toISOString(),expiresAtUtc:new Date(now+86400000).toISOString(),keys:[{id:'synthetic-release-key',spki:key.publicKey.export({format:'der',type:'spki'}).toString('base64'),status:'active',notBeforeUtc:new Date(now).toISOString(),notAfterUtc:new Date(now+86400000).toISOString()}],floors:['pico','pod','edge'].map(moduleId=>({moduleId,minimumSecurityVersion:1})),releases:set.manifests.map(m=>({releaseId:m.releaseId,moduleId:m.target.moduleId,artifactDigest:m.artifact.sha256,securityVersion:m.build.version==='1.0.0'?1:2}))};
  const envelope=()=>({policy,rootId:'synthetic-offline-root',signature:sign(null,trustSigningBytes(policy),root.privateKey).toString('hex')});
  const trustStores=new Map<string,UpdateTrustStore>(),dataStores=new Map<string,UpdateMigrationStore>(),targets=new Map<string,SimulatedUpdateTarget>();
  const health=new Map<string,'passed'|'failed'|'unknown'>(),slotFault=new Map<string,'before-commit'|'after-commit'|null>();
  for(const deviceId of ['edge','pico','pod']){const trust=new UpdateTrustStore({path:join(directory,`${deviceId}-trust.sqlite`),realm,siteId,deviceId,rootId:'synthetic-offline-root',rootPublicKey:root.publicKey,provisioningReviewId:'synthetic-reviewed-provisioning',clock:()=>({utcMs:now,reliable:true})});trust.accept(envelope());trustStores.set(deviceId,trust);
    const baseline=set.manifests.find(m=>m.releaseId===`${deviceId}-1.0.0`)!;const data=new UpdateMigrationStore({path:join(directory,`${deviceId}-data.sqlite`),realm,siteId,deviceId,trust,initial:{data:{schemaVersion:'arbi.update-data/1.0',dataVersion:'1.0.0',configurationRevision:'synthetic-config',calibrationRevision:'synthetic-calibration',limits:{minimumVoltageV:20,maximumVoltageV:28,maxSpeedMmPerS:20}},manifest:baseline,artifact:bytes.get(baseline.artifact.sha256)!}});dataStores.set(deviceId,data);
    health.set(deviceId,'passed');targets.set(deviceId,new SimulatedUpdateTarget({path:join(directory,`${deviceId}-slots.sqlite`),realm,siteId,deviceId,trust,data,initial:{manifest:baseline,artifact:bytes.get(baseline.artifact.sha256)!},now:()=>now,health:()=>health.get(deviceId)!,baselineArtifact:d=>bytes.get(d)!,fault:point=>{if(slotFault.get(deviceId)===point)throw Error('synthetic-slot-interruption');}}));
  }
  const provider=createIsolatedIdentityProvider(realm,()=>now);provider.putSite(siteId,'synthetic-account');const actor={kind:'human' as const,id:'synthetic-update-operator'},roles=new Map<string,Role[]>();
  const putRoles=(id:string,value:Role[])=>{roles.set(id,value);provider.putPrincipal({actor:{kind:'human',id},accountId:'synthetic-account',member:true,sites:{[siteId]:{roles:value,serviceScopes:[],active:true,revision:randomUUID()}}});};putRoles(actor.id,['update-admin','engineer']);putRoles('synthetic-viewer',['viewer']);putRoles('synthetic-engineer',['engineer']);putRoles('synthetic-update-only',['update-admin']);
  const credential=await provider.issue(actor);
  const sourceAuthorization=`Bearer ${randomBytes(32).toString('base64url')}`;const requests:{offset:number;requestedBytes:number;sentPayloadBytes:number}[]=[];
  let sourceMode:'complete'|'interrupt-once'|'reject-once'|'corrupt-once'|'unavailable'='complete',onRange:(()=>void)|null=null;
  const listener=createServer((req,res)=>{if(req.headers.authorization!==sourceAuthorization){res.writeHead(403).end();return;}const artifact=bytes.get(req.url?.slice('/artifacts/'.length)??''),match=req.headers.range?.match(/^bytes=(\d+)-(\d+)$/);if(!req.url?.startsWith('/artifacts/')||!artifact||!match){res.writeHead(404).end();return;}
    const start=Number(match[1]),end=Number(match[2]),length=end-start+1;if(start<0||end>=artifact.length||length<1||length>65536){res.writeHead(416).end();return;}
    const record={offset:start,requestedBytes:length,sentPayloadBytes:0};requests.push(record);onRange?.();const mode=sourceMode;if(mode==='unavailable'){res.destroy();return;}if(mode!=='complete')sourceMode='complete';
    const sent=mode==='interrupt-once'?Math.min(4096,length):mode==='reject-once'?Math.min(8192,length):length;record.sentPayloadBytes=sent;
    res.writeHead(mode==='reject-once'?503:206,{'content-type':'application/octet-stream','content-length':mode==='reject-once'?sent:length,'content-range':`bytes ${start}-${end}/${artifact.length}`});
    if(mode==='interrupt-once'){res.write(artifact.subarray(start,start+sent));setTimeout(()=>res.destroy(),30);}else{const body=Buffer.from(artifact.subarray(start,start+sent));if(mode==='corrupt-once')body[0]=body[0]!^1;res.end(body);}
  });await new Promise<void>(resolve=>listener.listen(0,'127.0.0.1',resolve));const address=listener.address();if(!address||typeof address==='string')throw Error('SOURCE_UNAVAILABLE');
  const source=new IsolatedRangeSource({realm,baseURL:`http://127.0.0.1:${address.port}`,authorization:sourceAuthorization});
  const identity:Identity={deviceId:'edge',bootId:randomUUID(),sessionId:randomUUID()};
  let storeFault=options.storeFault??null;
  let store=new UpdateOperationStore({path:join(directory,'operations.sqlite'),realm,siteId,source:identity,clock:()=>({utcMs:now,monotonicMs:now-clockStart,uncertaintyMs:1,reliable:true}),fault:point=>{if(point===storeFault)throw Error('synthetic-store-interruption');}});
  const transferPolicy:TransferPolicy={revision:'synthetic-update-budget',allowanceBytes:options.allowanceBytes??1048576,essentialBytes:65536,maxTransferBytes:1048576,bytesPerSecond:1048576,essentialBytesPerSecond:65536,concurrency:1,essentialConcurrency:1,unknownCoverage:'defer',maxAttempts:32,uploadWindows:[],stream:{maxBitrate:65536,maxDurationMs:10000,idleMs:1000}};
  const budget=new TransferBudget({path:join(directory,'transfers.sqlite'),realm,siteId,source:{deviceId:'edge-update-budget',bootId:identity.bootId,sessionId:identity.sessionId},policy:transferPolicy,clock:()=>({epoch:identity.bootId,utcMs:now,monotonicMs:now-clockStart,reliable:true}),authorize:a=>a.kind==='human'&&!!roles.get(a.id)?.includes('engineer')&&!!roles.get(a.id)?.includes('update-admin')});
  budget.checkpoint({period:'synthetic-day',startUtcMs:now,endUtcMs:now+86400000,revision:1,usedBytes:0,coverage:'complete',observedUtcMs:now,maxAgeMs:3600000,coveredCharges:[]});
  const safetyFlags:Partial<LocalUpdateSafety>={};let metered=true;
  const composition={store,trust:trustStores.get('edge')!,inventory,sets:[set],targets,budget,cache:new ArtifactCache(budget,join(directory,'artifacts')),source,metered:()=>metered,safety:()=>({recordId:'synthetic-restraint-procedure',observedUtcMs:now,expiresUtcMs:now+30000,independentProtectionOwnerId:'synthetic-independent-retention',activeMotion:false,manualControl:false,maintenanceConflict:false,mode:'update-safe' as const,retentionValidated:true,lineClearanceValidated:true,stablePower:true,localInterlock:true,targetProcedureValidated:true,provenance:'declared-isolated-procedure' as const,...safetyFlags}),afterReservation:options.afterReservation};
  let orchestrator=new UpdateOrchestrator(composition),server=new UpdateServer({identity:provider.adapter,resolveResource:provider.resolveResource,browserOrigins:['http://localhost']},orchestrator);
  const request=(action:string,input?:unknown,token=credential.token,query='')=>{now+=1000;return server.handle(new Request(`http://localhost/sites/${siteId}/updates/${action}${query}`,{method:['available','status','audit'].includes(action)?'GET':'POST',headers:{authorization:`Bearer ${token}`,origin:'http://localhost','x-arbi-request':'1','content-type':'application/json'},...(['available','status','audit'].includes(action)?{}:{body:JSON.stringify(input??{})})}),siteId,action);};
  return {realm,siteId,set,inventory,identity,now:()=>now,provider,credential,actor,targets,budget,dataStores,composition,requests,request,get store(){return store;},get orchestrator(){return orchestrator;},
    sourceMode(mode:typeof sourceMode){sourceMode=mode;},onRange(fn:(()=>void)|null){onRange=fn;},safety(flags:Partial<LocalUpdateSafety>){Object.assign(safetyFlags,flags);},metered(value:boolean){metered=value;},health(moduleId:string,value:'passed'|'failed'|'unknown'){health.set(moduleId,value);},slotFault(moduleId:string,point:'before-commit'|'after-commit'|null){slotFault.set(moduleId,point);},storeFault(point:typeof storeFault){storeFault=point;},roles:putRoles,
    advanceClock(ms:number){now+=ms;},
    restart(){store.close();const next={...composition.store.options,source:{...identity,bootId:randomUUID(),sessionId:randomUUID()}};store=new UpdateOperationStore(next);composition.store=store;orchestrator=new UpdateOrchestrator(composition);server=new UpdateServer({identity:provider.adapter,resolveResource:provider.resolveResource,browserOrigins:['http://localhost']},orchestrator);},
    raiseFloor(moduleId:string){policy={...policy,revision:policy.revision+1,previousDigest:digest(policy),floors:policy.floors.map(f=>f.moduleId===moduleId?{...f,minimumSecurityVersion:2}:f)};for(const trust of trustStores.values())trust.accept(envelope());},
    async close(){store.close();budget.close();for(const target of targets.values())target.close();for(const data of dataStores.values())data.close();for(const trust of trustStores.values())trust.close();listener.closeAllConnections();await new Promise<void>(resolve=>listener.close(()=>resolve()));}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==4||process.argv[2]!=='--directory'){console.error('ISOLATED_DIRECTORY_REQUIRED');process.exitCode=2;}else{const r=await createUpdateReference(resolve(process.argv[3]));try{const admitted=await r.request('request',{key:'synthetic-cli-update',releaseSetId:r.set.releaseSetId,targets:['pico','pod','edge'],allowMetered:true});if(admitted.status!==202)throw Error('ADMISSION_FAILED');const op=await admitted.json() as {operationId:string};let result;for(let i=0;i<24;i++){const response=await r.request('advance',{operationId:op.operationId});if(response.status!==200)throw Error('UPDATE_FAILED');result=await response.json() as {state:string};if(result.state==='healthy')break;}console.log(JSON.stringify(result));if(result?.state!=='healthy')process.exitCode=1;}finally{await r.close();}}
}
