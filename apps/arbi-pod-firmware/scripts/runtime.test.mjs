import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from 'node:tls';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { generateKeyPairSync,randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { PodRuntime } from '../dist/runtime.js';
import { CaptureStore } from '../dist/capture-store.js';
import { CaptureTransfer } from '../dist/capture-transfer.js';
import { ApplicationMeter,TrafficSpool,stamp } from '@arbi/traffic';
import { FrameDecoder,frame,TRANSPORT_VERSION } from '@arbi/protocol/local';
import { PROTOCOL_VERSION,parseMessage,validateAuditEvent } from '@arbi/protocol';
import { createSyntheticCredentials,syntheticAppliedConfiguration } from '../../arbi-edge-controller/dist/simulation.js';
import { ModuleAdapter } from '../../arbi-edge-controller/dist/adapter.js';
const io={origin:'simulated',temperature:async()=> '40000',flags:async()=> 'throttled=0x0',freeBytes:async()=> 1e9,network:async()=> true};
function fixture(){
  const credentials=createSyntheticCredentials(),applied=syntheticAppliedConfiguration();
  const settings={schemaVersion:'arbi.pod-runtime/1.0',executionMode:'simulation',healthPort:0,modulePort:0,storageDirectory:credentials.directory,
    tls:{caFile:credentials.caFile,certFile:credentials.modules.pod.certFile,keyFile:credentials.modules.pod.keyFile,edgeCertificateSha256:credentials.edgePin},
    applied,acceptedConfigurationDigest:applied.configurationDigest};
  const state={inhibits:0,initializes:0,shutdowns:0};
  const adapters={camera:{initialize:async()=>{state.initializes++;return {ready:true,origin:'simulated'};},shutdown:async()=>{state.shutdowns++;}},gimbal:{inhibit:()=>state.inhibits++}};
  return {credentials,settings,state,adapters,remove:()=>rmSync(credentials.directory,{recursive:true,force:true})};
}
const waitFor=async(predicate)=>{
  const until=performance.now()+5000;
  while(performance.now()<until){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error('WAIT_TIMEOUT');
};
test('runtime stop inhibits first and drains attached bounded media/cursor owners before storage closure',async()=>{
  const f=fixture(),root=mkdtempSync(join(tmpdir(),'arbi-pod-capture-')),runtime=new PodRuntime(f.settings,f.adapters,io),c=f.settings.applied.request.configuration,key=generateKeyPairSync('ed25519'),edge={deviceId:'edge',bootId:'recovery-edge',sessionId:'recovery-session'};
  const binding={realm:c.realm,siteId:c.siteId,deviceId:'pod'},store=new CaptureStore({root,binding}),usage=new TrafficSpool({path:join(root,'usage.sqlite'),binding:{...binding,executionMode:'simulation'},maxRecords:32,maxBytes:262144,maxPages:256,maxCounters:1});
  try {
    const native=JSON.parse(readFileSync(new URL('../../arbi-edge-controller/fixtures/captured-png.json',import.meta.url),'utf8')),r=native.receipt;store.reserve({commandId:r.commandId,correlationId:r.correlationId,resourceId:r.resourceId,fingerprint:r.fingerprint});store.publish(r.commandId,Buffer.from(native.pngBase64,'base64'),32,24,r.metadata);
    const transfer=new CaptureTransfer({store,source:runtime.source,edge:()=>edge,publicKey:key.publicKey,meter:new ApplicationMeter(usage,()=>stamp(runtime.source.bootId)),authorized:()=>true,now:()=>Math.floor(performance.now()),higherPriorityPending:()=>false,transport:{begin:async()=>new Promise(()=>{}),chunk:async()=>{throw new Error('NOT_REACHED');},finish:async()=>{throw new Error('NOT_REACHED');}},policy:{timeoutMs:30}});runtime.connectCaptureTransfer(transfer);
    await runtime.start();const recovery=runtime.connectRecovery({edge:()=>edge,publicKey:key.publicKey,authorized:()=>true});assert.equal(recovery.status().cloudCommitted,false);
    const pending=transfer.step(r.commandId);await waitFor(()=>transfer.status.busy);const inhibits=f.state.inhibits,at=performance.now();await runtime.stop();assert.ok(f.state.inhibits>inhibits);assert.equal(transfer.status.closed,true);assert.equal(transfer.status.busy,false);assert.equal(recovery.status().closed,true);assert.ok(performance.now()-at<1000);await pending;
    assert.equal(store.delivery(r.commandId),null);assert.ok(store.readImage(store.get(r.commandId)).length>0);assert.equal(runtime.status.camera.captureEnabled,false);
  } finally {await runtime.stop();store.close();usage.close();rmSync(root,{recursive:true,force:true});f.remove();}
});
async function peer(f,port,patch={}) {
  const source={deviceId:'edge',bootId:randomUUID(),sessionId:randomUUID()},messages=[];
  const socket=connect({host:'127.0.0.1',port,servername:'pod.sim.arbi.test',ca:readFileSync(f.credentials.caFile),
    cert:readFileSync(f.credentials.edgeCertFile),key:readFileSync(f.credentials.edgeKeyFile),minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ALPNProtocols:[TRANSPORT_VERSION]});
  socket.on('error',()=>{});const decoder=new FrameDecoder();socket.on('data',chunk=>decoder.push(chunk,v=>messages.push(v)));
  await once(socket,'secureConnect');const c=f.settings.applied.request.configuration;
  socket.write(frame({transport:TRANSPORT_VERSION,kind:'discover',challenge:randomUUID(),source,protocol:PROTOCOL_VERSION,realm:c.realm,siteId:c.siteId,
    executionMode:'simulation',configurationDigest:f.settings.acceptedConfigurationDigest,...patch}));
  return {source,messages,socket};
}
function command(f,p,sequence=1,patch={}) {
  const source=p.messages[0].source,c=f.settings.applied.request.configuration,id=randomUUID();
  return {protocol:PROTOCOL_VERSION,messageId:randomUUID(),source:p.source,sequence:String(sequence),realm:c.realm,siteId:c.siteId,executionMode:'simulation',
    sourceTime:{utc:null,uncertaintyMs:null,monotonicMs:Math.floor(performance.now())},ingestTime:null,kind:'command',body:{type:'state.resync',cursor:null,committedCursor:null},
    command:{commandId:id,correlationId:id,idempotencyKey:id,actor:{kind:'service',id:'simulation-diagnostics'},target:source,
      deadline:{bootId:source.bootId,sessionId:source.sessionId,expiresMonotonicMs:p.messages[1].sourceTime.monotonicMs+1000},lease:null,configRevision:c.revision},...patch};
}
test('unconfigured executable exposes not-ready health without secrets or a camera',async()=>{
  const runtime=new PodRuntime(null,undefined,io);try{
    const ports=await runtime.start(),response=await fetch(`http://127.0.0.1:${ports.healthPort}/health`),h=await response.json();
    assert.equal(response.status,503);assert.equal(h.reason,'CONFIG_MISSING');assert.equal(h.actuationInhibited,true);assert.equal(h.physicalAcceptance,false);
    assert.equal(h.configurationDigest,null);assert.equal(h.camera.captureEnabled,false);assert.equal(h.resetReason.quality,'unavailable');assert.equal(ports.modulePort,null);
  }finally{await runtime.stop();}
});
test('shutdown during pending camera initialization cancels startup without opening a listener',async()=>{
  const f=fixture();let release;
  f.adapters.camera.initialize=()=>new Promise(resolve=>{release=()=>resolve({ready:true,origin:'simulated'});});
  const runtime=new PodRuntime(f.settings,f.adapters,io);
  try{
    const starting=runtime.start();const rejected=assert.rejects(starting,/STARTUP_FAILED/u);
    await waitFor(()=>typeof release==='function');await runtime.stop();release();await rejected;
    assert.equal(runtime.status.ready,false);assert.equal(runtime.status.actuationInhibited,true);
    await assert.rejects(runtime.start(),/INVALID_LIFECYCLE/u);
  }finally{await runtime.stop();f.remove();}
});
test('real edge adapter negotiates actual pod TLS listener and durable correlated diagnostic records',async()=>{
  const f=fixture(),runtime=new PodRuntime(f.settings,f.adapters,io);let edge;
  try {
    const ports=await runtime.start(),c=f.settings.applied.request.configuration;
    const enrollment={deviceId:'pod',role:'pod',host:'127.0.0.1',port:ports.modulePort,serverName:'pod.sim.arbi.test',certificateSha256:f.credentials.modules.pod.pin};
    const settings={serviceId:'edge',applied:f.settings.applied,acceptedConfigurationDigest:f.settings.acceptedConfigurationDigest};
    edge=new ModuleAdapter(settings,enrollment,{deviceId:'edge',bootId:randomUUID(),sessionId:randomUUID()},
      {ca:readFileSync(f.credentials.caFile),cert:readFileSync(f.credentials.edgeCertFile),key:readFileSync(f.credentials.edgeKeyFile)});
    edge.start();await waitFor(()=>edge.status.ready);const grant=edge.authorizeDiagnostics({kind:'service',id:'simulation-diagnostics'});
    assert.ok(grant);assert.equal(edge.resync(grant),true);await waitFor(()=>runtime.status.diagnosticRequests===1);
    const local=runtime.pendingDiagnostics();assert.equal(local.length,1);assert.equal(local[0].code,'DIAGNOSTIC_ACCEPTED');assert.equal(local[0].correlationId,grant.id);
    assert.equal(runtime.pendingAudit().length,0);assert.equal(validateAuditEvent(edge.diagnosticAudit.records[0]).ok,true);
    const usage=runtime.pendingUsage();assert.ok(usage.length>0);assert.ok(JSON.stringify(usage).includes('lan'));
    assert.equal(runtime.status.ready,true);assert.equal(runtime.status.actuationInhibited,true);assert.equal(c.executionMode,'simulation');
  }finally{edge?.stop();await runtime.stop();f.remove();}
});
test('duplicates do not redispatch; delayed, incompatible and malformed input disconnects',async()=>{
  const f=fixture(),runtime=new PodRuntime(f.settings,f.adapters,io);const peers=[];
  try {
    const ports=await runtime.start();let p=await peer(f,ports.modulePort);peers.push(p);await waitFor(()=>p.messages.length>=2);
    assert.equal(parseMessage(JSON.stringify(p.messages[1])).ok,true);const m=command(f,p);
    p.socket.write(Buffer.concat([frame(m),frame(m)]));await waitFor(()=>runtime.status.diagnosticRequests===1);
    assert.equal(runtime.pendingDiagnostics().length,1);p.socket.destroy();await waitFor(()=>p.socket.closed);
    p=await peer(f,ports.modulePort);peers.push(p);await waitFor(()=>p.messages.length>=2);
    const stale=command(f,p);stale.command.target=m.command.target;stale.command.deadline.bootId=m.command.target.bootId;stale.command.deadline.sessionId=m.command.target.sessionId;
    p.socket.write(frame(stale));await waitFor(()=>p.socket.closed);
    assert.equal(runtime.status.diagnosticRequests,1);assert.equal(runtime.pendingDiagnostics().at(-1).code,'COMMAND_REJECTED');
    p=await peer(f,ports.modulePort,{configurationDigest:'0'.repeat(64)});peers.push(p);await waitFor(()=>p.socket.closed);assert.equal(p.messages.length,0);
    p=await peer(f,ports.modulePort);peers.push(p);await waitFor(()=>p.messages.length>=2);const large=Buffer.alloc(4);large.writeUInt32BE(16385);p.socket.write(large);await waitFor(()=>p.socket.closed);
    assert.ok(f.state.inhibits>=4);assert.ok(!JSON.stringify(runtime.logs.snapshot()).includes('-----BEGIN'));
  }finally{peers.forEach(p=>p.socket.destroy());await runtime.stop();f.remove();}
});
test('restart retains bounded diagnostics/usage but creates a fresh inhibited epoch without effect replay',async()=>{
  const f=fixture();let runtime=new PodRuntime(f.settings,f.adapters,io),p;
  try {
    let ports=await runtime.start();p=await peer(f,ports.modulePort);await waitFor(()=>p.messages.length>=2);p.socket.write(frame(command(f,p)));await waitFor(()=>runtime.status.diagnosticRequests===1);
    const boot=runtime.source.bootId,first=runtime.pendingDiagnostics()[0];p.socket.destroy();await runtime.stop();
    runtime=new PodRuntime(f.settings,f.adapters,io);ports=await runtime.start();
    assert.notEqual(runtime.source.bootId,boot);assert.equal(runtime.status.diagnosticRequests,0);assert.equal(runtime.status.actuationInhibited,true);
    assert.equal(runtime.pendingDiagnostics()[0].correlationId,first.correlationId);assert.ok(runtime.pendingUsage().length>0);assert.equal(f.state.initializes,2);
  }finally{p?.socket.destroy();await runtime.stop();f.remove();}
});
test('unenrolled certificates, actuator commands, malformed JSON and stalled frames are rejected',async()=>{
  const f=fixture(),runtime=new PodRuntime(f.settings,f.adapters,io);const peers=[];
  try{
    const ports=await runtime.start();
    const alien=connect({host:'127.0.0.1',port:ports.modulePort,servername:'pod.sim.arbi.test',ca:readFileSync(f.credentials.caFile),
      cert:readFileSync(f.credentials.modules.pico.certFile),key:readFileSync(f.credentials.modules.pico.keyFile),ALPNProtocols:[TRANSPORT_VERSION],minVersion:'TLSv1.3',maxVersion:'TLSv1.3'});
    alien.on('error',()=>{});await waitFor(()=>alien.closed);assert.equal(runtime.status.diagnosticRequests,0);
    let p=await peer(f,ports.modulePort);peers.push(p);await waitFor(()=>p.messages.length>=2);
    const move=command(f,p);move.body={type:'camera.gimbal',panDeg:0,tiltDeg:0,frame:{name:'pod-gimbal',revision:'gimbal-1'},maxDurationMs:500};
    assert.equal(parseMessage(JSON.stringify(move)).ok,true);
    p.socket.write(frame(move));await waitFor(()=>p.socket.closed);assert.equal(runtime.status.diagnosticRequests,0);
    p=await peer(f,ports.modulePort);peers.push(p);await waitFor(()=>p.messages.length>=2);
    const body=Buffer.from('{"secret":"PRIVATE KEY",');const prefix=Buffer.alloc(4);prefix.writeUInt32BE(body.length);
    p.socket.write(Buffer.concat([prefix,body]));await waitFor(()=>p.socket.closed);
    assert.ok(!JSON.stringify(runtime.logs.snapshot()).includes('PRIVATE KEY'));assert.ok(!JSON.stringify(runtime.pendingDiagnostics()).includes('PRIVATE KEY'));
    p=await peer(f,ports.modulePort);peers.push(p);await waitFor(()=>p.messages.length>=2);prefix.writeUInt32BE(128);
    p.socket.write(Buffer.concat([prefix,Buffer.from('{')]));await waitFor(()=>p.socket.closed);
  }finally{peers.forEach(p=>p.socket.destroy());await runtime.stop();f.remove();}
});
async function startChild(){
  const child=spawn(process.execPath,['--max-old-space-size=64','dist/cli.js','--health-port','0'],{cwd:new URL('../',import.meta.url),stdio:['ignore','pipe','pipe']});let line='';
  child.stderr.on('data',()=>{});child.stdout.on('data',chunk=>{line+=chunk.toString();});
  await waitFor(()=>line.includes('\n'));return {child,started:JSON.parse(line.split('\n')[0])};
}
test('actual process crash/restart changes boot identity and never restores actuator readiness',async()=>{
  let a,b;try{
    a=await startChild();const h=await (await fetch(`http://127.0.0.1:${a.started.ports.healthPort}/health`)).json();assert.equal(h.ready,false);
    const exit=once(a.child,'exit');a.child.kill('SIGKILL');await exit;
    b=await startChild();assert.notEqual(b.started.source.bootId,a.started.source.bootId);
    const next=await (await fetch(`http://127.0.0.1:${b.started.ports.healthPort}/health`)).json();assert.equal(next.ready,false);assert.equal(next.diagnosticRequests,0);
    const ended=once(b.child,'exit');b.child.kill('SIGTERM');const [code]=await ended;assert.equal(code,0);
  }finally{a?.child.kill('SIGKILL');b?.child.kill('SIGKILL');}
});
