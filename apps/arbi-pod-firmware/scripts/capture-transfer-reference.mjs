// Explicit native fixture benchmark, not camera/Wi-Fi/cloud bench acceptance.
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync,readFileSync,readdirSync,rmSync,statSync } from 'node:fs';
import { tmpdir,arch,cpus,platform,release } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { CaptureStore } from '../dist/capture-store.js';
import { CaptureTransfer } from '../dist/capture-transfer.js';
import { CaptureReceiver } from '../../arbi-edge-controller/dist/images/capture-receiver.js';
import { ApplicationMeter,TrafficSpool,stamp } from '@arbi/traffic';
const podRoot=mkdtempSync(join(tmpdir(),'arbi-pod-capture-')),edgeRoot=mkdtempSync(join(tmpdir(),'arbi-edge-captures-')),native=JSON.parse(readFileSync(new URL('../../arbi-edge-controller/fixtures/captured-png.json',import.meta.url),'utf8')),r=native.receipt,pod=r.metadata.source,edge={deviceId:'edge',bootId:'resource-edge',sessionId:'resource-session'},key=generateKeyPairSync('ed25519'),binding={realm:r.metadata.realm,siteId:r.metadata.siteId,deviceId:pod.deviceId};
let store,receiver,usage,sender;
try {
  store=new CaptureStore({root:podRoot,binding,maxRecords:128,maxBytes:1048576});receiver=new CaptureReceiver({root:edgeRoot,realm:binding.realm,siteId:binding.siteId,podDeviceId:pod.deviceId,edge,privateKey:key.privateKey,authorize:p=>p.deviceId===pod.deviceId&&p.bootId===pod.bootId&&p.sessionId===pod.sessionId,maxRecords:128,maxBytes:1048576});usage=new TrafficSpool({path:join(podRoot,'usage.sqlite'),binding:{...binding,executionMode:'simulation'},maxRecords:512,maxBytes:4194304,maxPages:2048,maxCounters:1});
  sender=new CaptureTransfer({store,source:pod,edge:()=>edge,publicKey:key.publicKey,meter:new ApplicationMeter(usage,()=>stamp(pod.bootId)),authorized:()=>true,now:()=>Math.floor(performance.now()),higherPriorityPending:()=>false,
    transport:{begin:async(m,p,s)=>{s.throwIfAborted();return receiver.begin(m,p);},chunk:async(id,d,o,b,h,p,s)=>{s.throwIfAborted();return receiver.chunk(id,d,o,b,h,p);},finish:async(id,d,p,s)=>{s.throwIfAborted();return receiver.finish(id,d,p);}}});
  const samples=[],cpu=process.cpuUsage(),start=performance.now(),baselineRss=process.memoryUsage.rss();let sampledPeakRss=baselineRss,logicalBytes=0;
  for(let n=0;n<64;n++) {
    const commandId=`resource-capture-${n}`,metadata=structuredClone(r.metadata);metadata.request.commandId=commandId;store.reserve({commandId,correlationId:r.correlationId,resourceId:r.resourceId,fingerprint:r.fingerprint});store.publish(commandId,Buffer.from(native.pngBase64,'base64'),32,24,metadata);
    const at=performance.now(),result=await sender.step(commandId);if(result.state!=='owned')throw new Error(result.reason??'RESOURCE_TRANSFER_FAILED');logicalBytes+=result.logicalBytes;store.releaseAcknowledged(commandId);samples.push(performance.now()-at);sampledPeakRss=Math.max(sampledPeakRss,process.memoryUsage.rss());
  }
  const elapsedMs=performance.now()-start,used=process.cpuUsage(cpu),disk=directory=>readdirSync(directory).reduce((sum,file)=>sum+statSync(join(directory,file)).size,0),build=JSON.parse(readFileSync(new URL('../dist/build-identity.json',import.meta.url),'utf8'));
  const attempts=usage.pending(64),attemptedPayloadBytes=attempts.reduce((sum,item)=>sum+Number(item.record.bytes),0);
  console.log(JSON.stringify({version:'arbi.capture-transfer-resource/1.0',build,host:{node:process.version,platform:platform(),arch:arch(),release:release(),cpuModel:cpus()[0].model,logicalCpus:cpus().length},fixtureCaptures:64,sourceResolution:[32,24],rawBytes:r.image.bytes,elapsedMs,cpuUserMs:used.user/1000,cpuSystemMs:used.system/1000,minimumTransferAndReleaseMs:Math.min(...samples),maximumTransferAndReleaseMs:Math.max(...samples),baselineRssBytes:baselineRss,sampledPeakRssBytes:sampledPeakRss,rssSampling:'after-each-fixture',podFileBytes:disk(podRoot),edgeFileBytes:disk(edgeRoot),podRetention:store.retentionStatus(),edgeRetention:receiver.status(),logicalBytes,attemptedPayloadBytes,usage:usage.status(),physicalWiFiMeasured:false,physicalPowerLossTested:false,selectedHostMeasured:false,cloudMetadataDelivered:false},null,2));
} finally {await sender?.stopAndDrain();store?.close();receiver?.close();usage?.close();rmSync(podRoot,{recursive:true,force:true});rmSync(edgeRoot,{recursive:true,force:true});}
