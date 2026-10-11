import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { configurationDigest } from '@arbi/protocol';
import { manifestDigest,ownerReceipt,payloadDigest,verifyOwnerReceipt } from '@arbi/protocol/capture-transfer';
import { ApplicationMeter,TrafficSpool,stamp } from '@arbi/traffic';
import { SqliteAuditSpool } from '@arbi/audit';
import { PodCursorRecovery } from './cursor-recovery.js';
import { DiagnosticBuffer } from './diagnostic-buffer.js';
import { CaptureReceiver } from '../../arbi-edge-controller/dist/images/capture-receiver.js';
import { CaptureStore } from './capture-store.js';
import { CaptureTransfer } from './capture-transfer.js';
import type { CaptureTransport } from './capture-transfer.js';
const native=JSON.parse(readFileSync(new URL('../../arbi-edge-controller/fixtures/captured-png.json',import.meta.url),'utf8'));
function fixture(t:TestContext,policy:{chunkBytes?:number;maxAttempts?:number;bytesPerSecond?:number;timeoutMs?:number;maxBytes?:number;maxRecords?:number}={}) {
  const podRoot=mkdtempSync(join(tmpdir(),'arbi-pod-capture-')),edgeRoot=mkdtempSync(join(tmpdir(),'arbi-edge-captures-')),receipt=structuredClone(native.receipt),key=generateKeyPairSync('ed25519');
  let source=structuredClone(receipt.metadata.source),edge={deviceId:'edge',bootId:'edge-recovery-1',sessionId:'edge-recovery-session'},now=0,allowed=true,priority=false,edgeCut:string|null=null,podCut:string|null=null;
  const podOptions={root:podRoot,binding:{realm:receipt.metadata.realm,siteId:receipt.metadata.siteId,deviceId:source.deviceId},maxBytes:policy.maxBytes,maxRecords:policy.maxRecords,fault:(point:string)=>{if(podCut===point){podCut=null;throw new Error('SIMULATED_PROCESS_CUT');}}};let store=new CaptureStore(podOptions);
  const publish=(commandId=receipt.commandId)=>{const metadata=structuredClone(receipt.metadata);metadata.request.commandId=commandId;store.reserve({commandId,correlationId:receipt.correlationId,resourceId:receipt.resourceId,fingerprint:receipt.fingerprint});return store.publish(commandId,Buffer.from(native.pngBase64,'base64'),32,24,metadata);};const captured=publish();
  const edgeOptions={root:edgeRoot,realm:receipt.metadata.realm,siteId:receipt.metadata.siteId,podDeviceId:source.deviceId,edge,privateKey:key.privateKey,authorize:(pod:typeof source)=>allowed&&configurationDigest(pod)===configurationDigest(source),maxBytes:policy.maxBytes,maxRecords:policy.maxRecords,fault:(point:string)=>{if(edgeCut===point){edgeCut=null;throw new Error('SIMULATED_PROCESS_CUT');}}};let receiver=new CaptureReceiver(edgeOptions);
  const usage=new TrafficSpool({path:join(podRoot,'usage.sqlite'),binding:{...podOptions.binding,executionMode:'simulation'},maxRecords:512,maxBytes:4194304,maxPages:2048,maxCounters:1}),meter=new ApplicationMeter(usage,()=>stamp(source.bootId));
  const transport:CaptureTransport={begin:async(m,p,s)=>{s.throwIfAborted();return receiver.begin(m,p);},chunk:async(id,d,o,b,h,p,s)=>{s.throwIfAborted();return receiver.chunk(id,d,o,b,h,p);},finish:async(id,d,p,s)=>{s.throwIfAborted();return receiver.finish(id,d,p);}};
  const senderOptions=()=>({store,source,edge:()=>edge,publicKey:key.publicKey,meter,authorized:()=>allowed,now:()=>now,higherPriorityPending:()=>priority,transport,policy:{chunkBytes:policy.chunkBytes??32,maxAttempts:policy.maxAttempts??64,bytesPerSecond:policy.bytesPerSecond??65536,timeoutMs:policy.timeoutMs??100}});
  let sender=new CaptureTransfer(senderOptions());t.after(async()=>{await sender.stopAndDrain();store.close();receiver.close();usage.close();rmSync(podRoot,{recursive:true,force:true});rmSync(edgeRoot,{recursive:true,force:true});});
  return {podRoot,edgeRoot,key,captured,publish,transport,meter,usage,senderOptions,edgeOptions,podOptions,
    get store(){return store;},get receiver(){return receiver;},get sender(){return sender;},clock:(v:number)=>{now=v;},allow:(v:boolean)=>{allowed=v;},priority:(v:boolean)=>{priority=v;},edgeCut:(point:string)=>{edgeCut=point;},podCut:(point:string)=>{podCut=point;},
    restartEdge:()=>{receiver.close();edge={...edge,bootId:'edge-recovery-2'};receiver=new CaptureReceiver({...edgeOptions,edge});return receiver;},
    restartPod:async()=>{await sender.stopAndDrain();store.close();source={...source,bootId:'pod-recovery-2'};store=new CaptureStore(podOptions);sender=new CaptureTransfer(senderOptions());return sender;},
    reopenStore:()=>{store.close();store=new CaptureStore(podOptions);return store;},advance:()=>{now+=1000;},edge:()=>edge,source:()=>source};
}
async function complete(f:ReturnType<typeof fixture>) {let logical=0;for(let n=0;n<64;n++){const result=await f.sender.step(f.captured.commandId);logical+=result.logicalBytes;if(result.state==='owned')return {result,logical};f.advance();}throw new Error('TRANSFER_NOT_FINISHED');}
test('actual native chunks and Ed25519 owner receipt preserve raw traceability and charge one logical capture',async t=>{
  const f=fixture(t),m=f.store.manifest(f.captured.commandId),done=await complete(f);assert.equal(done.result.state,'owned');assert.equal(done.logical,m.image.bytes);
  const owned=f.receiver.readOwned(m.image.id);assert.equal(payloadDigest(owned.bytes),m.image.sha256);assert.deepEqual(owned.manifest,m);assert.deepEqual(owned.manifest.metadata.processing,{state:'not-processed',derivedIds:[]});assert.equal(f.receiver.status().wanUploadState,'not-uploaded');
  const receipt=f.store.delivery(m.commandId)!.receipt;verifyOwnerReceipt(receipt,m,f.edge(),f.key.publicKey);assert.equal((await f.sender.step(m.commandId)).logicalBytes,0);assert.equal(f.receiver.status().owned,1);assert.equal(f.store.retentionStatus().retainedBytes,m.image.bytes);
  const attempts=f.usage.pending(64);assert.equal(attempts.reduce((n,x)=>n+Number((x.record as {bytes:string}).bytes),0),m.image.bytes);assert.ok(attempts.every(x=>x.record.kind==='transfer'&&x.record.spec.scope.boundary==='lan'));assert.equal(f.sender.status.wanBytes,null);
  f.store.releaseAcknowledged(m.commandId);assert.equal(f.store.retentionStatus().retainedBytes,0);assert.throws(()=>f.store.readImage(f.captured),{code:'RAW_IMAGE_TRANSFERRED'});assert.equal(f.receiver.readOwned(m.image.id).bytes.length,m.image.bytes);
});
test('lost chunk/ownership acknowledgements reconnect without duplicate identity while retransmissions remain traffic',async t=>{
  const f=fixture(t),chunk=f.transport.chunk,finish=f.transport.finish;let lost=true,lostOwner=true;
  f.transport.chunk=async(...args)=>{const r=await chunk(...args);if(lost){lost=false;throw new Error('ACK_LOST');}return r;};
  f.transport.finish=async(...args)=>{const r=await finish(...args);if(lostOwner){lostOwner=false;throw new Error('OWNER_ACK_LOST');}return r;};
  const first=await f.sender.step(f.captured.commandId);assert.equal(first.state,'paused');assert.equal(f.store.delivery(f.captured.commandId),null);f.advance();
  await complete(f);assert.equal(f.receiver.status().owned,1);const m=f.store.manifest(f.captured.commandId),rows=f.usage.pending(64);assert.equal(rows.reduce((n,x)=>n+Number((x.record as {bytes:string}).bytes),0),m.image.bytes);
  // Explicit duplicate data is still an attempted payload, though receiver
  // logical ownership and byte offset remain unchanged.
  const data=f.store.readImage(f.captured).subarray(0,32),before=rows.length;
  await f.meter.upload({scope:{realm:m.realm,siteId:m.siteId,executionMode:'simulation',source:f.source(),boundary:'lan',linkId:'retry-model'},direction:'upload',category:'still',includes:['payload','retries'],maxAgeMs:60000,retryOf:null,media:null},(async function*(){yield data;})(),async bytes=>{assert.equal(f.receiver.chunk(m.image.id,manifestDigest(m),0,bytes,payloadDigest(bytes),f.source()).duplicate,true);});
  assert.equal(f.usage.pending(64).length,before+1);assert.equal(f.usage.pending(64).reduce((n,x)=>n+Number((x.record as {bytes:string}).bytes),0),m.image.bytes+32);
});
test('missing ownership, wrong signer/scope/epoch, corrupt payload and duplicate conflicts cannot release raw data',async t=>{
  const f=fixture(t),m=f.store.manifest(f.captured.commandId);assert.throws(()=>f.store.releaseAcknowledged(m.commandId),{code:'CAPTURE_OWNERSHIP_REQUIRED'});
  const wrong=generateKeyPairSync('ed25519'),fake=ownerReceipt(m,f.edge(),'fake-owner',wrong.privateKey);assert.throws(()=>f.store.acknowledgeTransfer(m.commandId,fake,f.edge(),f.key.publicKey),{code:'TRANSFER_ACK_INVALID'});
  const mismatch=structuredClone(m);mismatch.siteId='other-site';assert.throws(()=>f.receiver.begin(mismatch,f.source()));f.receiver.begin(m,f.source());
  const bytes=f.store.readImage(f.captured),bad=Buffer.from(bytes.subarray(0,32));bad[0]^=1;assert.throws(()=>f.receiver.chunk(m.image.id,manifestDigest(m),0,bad,payloadDigest(bytes.subarray(0,32)),f.source()),{code:'TRANSFER_CHUNK_INVALID'});
  f.receiver.chunk(m.image.id,manifestDigest(m),0,bytes.subarray(0,32),payloadDigest(bytes.subarray(0,32)),f.source());assert.throws(()=>f.receiver.chunk(m.image.id,manifestDigest(m),0,bad,payloadDigest(bad),f.source()),{code:'TRANSFER_CHUNK_CONFLICT'});
  await complete(f);const receipt=structuredClone(f.store.delivery(m.commandId)!.receipt);receipt.edge.bootId='stale';assert.throws(()=>verifyOwnerReceipt(receipt,m,f.edge(),f.key.publicKey),{code:'TRANSFER_ACK_INVALID'});assert.ok(f.store.readImage(f.captured).length>0);
});
test('storage pressure never deletes unacknowledged data and verified retention frees payload capacity',async t=>{
  const size=Buffer.from(native.pngBase64,'base64').length,f=fixture(t,{maxBytes:size,maxRecords:3});
  assert.throws(()=>f.publish('second-capture'),{code:'CAPTURE_STORAGE_FULL'});assert.equal(f.store.retentionStatus().retainedBytes,size);await complete(f);f.store.releaseAcknowledged(f.captured.commandId);
  const next=f.publish('third-capture');assert.equal(next.state,'captured');assert.equal(f.store.retentionStatus().retainedBytes,size);assert.throws(()=>f.receiver.begin(f.store.manifest(next.commandId),f.source()),{code:'TRANSFER_STORAGE_FULL'});
  assert.throws(()=>new CaptureReceiver(f.edgeOptions),{code:'TRANSFER_STORE_BUSY'});assert.throws(()=>new CaptureStore(f.podOptions),{code:'CAPTURE_STORE_BUSY'});
});
test('cuts across chunk write/commit, ownership rename/commit and pod acknowledgement recover conservatively',async t=>{
  for(const point of ['after-transfer-reservation','after-chunk-write','after-chunk-commit','after-transfer-rename','after-owner-commit']) {
    const f=fixture(t,{chunkBytes:65536});f.edgeCut(point);await assert.rejects(f.sender.step(f.captured.commandId),{message:'SIMULATED_PROCESS_CUT'});assert.equal(f.store.delivery(f.captured.commandId),null);f.restartEdge();f.advance();await complete(f);assert.equal(f.receiver.status().owned,1);assert.equal(f.store.retentionStatus().released,0);
  }
  const f=fixture(t,{chunkBytes:65536});f.podCut('after-transfer-ack');await assert.rejects(f.sender.step(f.captured.commandId),{message:'SIMULATED_PROCESS_CUT'});assert.equal(f.store.delivery(f.captured.commandId)!.state,'acknowledged');assert.ok(f.reopenStore().readImage(f.captured).length>0);
});
test('retention intent/unlink/commit cuts keep durable owner evidence and never recreate a camera artifact',async t=>{
  for(const point of ['after-release-intent','after-release-unlink','after-release-finalize']) {const f=fixture(t,{chunkBytes:65536});await complete(f);f.podCut(point);assert.throws(()=>f.store.releaseAcknowledged(f.captured.commandId),{message:'SIMULATED_PROCESS_CUT'});f.reopenStore();assert.equal(f.store.delivery(f.captured.commandId)!.state,'released');assert.equal(f.store.retentionStatus().retainedBytes,0);assert.equal(f.store.records().length,1);assert.equal(f.receiver.readOwned(f.captured.image!.id).bytes.length,f.captured.image!.bytes);}
});
test('fresh pod/edge epochs resume the immutable image, while old peers/clock/revoked authority are rejected',async t=>{
  const f=fixture(t),old=f.source();await f.sender.step(f.captured.commandId);await f.restartPod();const m=f.store.manifest(f.captured.commandId);assert.throws(()=>f.receiver.begin(m,old),{code:'TRANSFER_NOT_AUTHORIZED'});await complete(f);assert.equal(f.store.transferProgress(m.commandId)!.epoch,'pod-recovery-2');assert.equal(m.metadata.source&&JSON.stringify(m.metadata.source),JSON.stringify(old));
  const second=fixture(t);second.allow(false);await assert.rejects(second.sender.step(second.captured.commandId),{code:'TRANSFER_AUTHORITY_LOST'});second.allow(true);second.clock(50);await second.sender.step(second.captured.commandId);second.clock(49);await assert.rejects(second.sender.step(second.captured.commandId),{code:'TRANSFER_CLOCK_INVALID'});
});
test('priority, rate, backoff, finite attempts, single owner and timed-out transports bound retries',async t=>{
  const f=fixture(t,{bytesPerSecond:32});f.priority(true);assert.equal((await f.sender.step(f.captured.commandId)).reason,'HIGHER_PRIORITY_PENDING');assert.equal(f.store.transferProgress(f.captured.commandId),null);f.priority(false);await f.sender.step(f.captured.commandId);assert.equal((await f.sender.step(f.captured.commandId)).reason,'LAN_RATE_LIMIT');f.advance();assert.equal((await f.sender.step(f.captured.commandId)).reason,null);
  const failed=fixture(t,{maxAttempts:1});failed.transport.begin=async()=>{throw new Error('LINK_DOWN');};assert.equal((await failed.sender.step(failed.captured.commandId)).state,'failed');assert.equal((await failed.sender.step(failed.captured.commandId)).reason,'TRANSFER_ATTEMPTS_EXHAUSTED');
  const slow=fixture(t,{timeoutMs:10});slow.transport.begin=async()=>new Promise(()=>{});const pending=slow.sender.step(slow.captured.commandId);await assert.rejects(slow.sender.step(slow.captured.commandId),{code:'TRANSFER_BUSY'});assert.equal((await pending).reason,'TRANSFER_TIMEOUT');await assert.rejects(slow.sender.step(slow.captured.commandId),{code:'TRANSFER_TRANSPORT_QUARANTINED'});assert.equal(slow.store.delivery(slow.captured.commandId),null);await slow.sender.stopAndDrain();assert.equal(slow.sender.status.closed,true);
});
test('native owner corruption cannot produce a fresh receipt or successful duplicate',async t=>{
  const f=fixture(t,{chunkBytes:65536});await complete(f);const m=f.store.manifest(f.captured.commandId);writeFileSync(join(f.edgeRoot,`${m.image.id}.png`),Buffer.alloc(m.image.bytes));assert.throws(()=>f.receiver.finish(m.image.id,manifestDigest(m),f.source()),{code:'TRANSFER_RAW_CORRUPT'});f.restartEdge();assert.equal(f.receiver.status().corrupt,1);assert.throws(()=>f.receiver.begin(m,f.source()),{code:'TRANSFER_RAW_CORRUPT'});assert.ok(f.store.readImage(f.captured).length>0);
});
test('SIGKILL at every native transfer/retention commit boundary releases kernel owners and retains valid or explicit incomplete data',{timeout:30000},async t=>{
  const points=['after-transfer-reservation','after-chunk-write','after-chunk-commit','after-transfer-rename','after-owner-commit','after-transfer-ack','after-release-intent','after-release-unlink','after-release-finalize'];
  for(const point of points) {
    const f=fixture(t,{chunkBytes:65536}),aux=mkdtempSync(join(tmpdir(),'arbi-capture-kill-'));t.after(()=>rmSync(aux,{recursive:true,force:true}));const keyFile=join(aux,'test-key.pem');writeFileSync(keyFile,f.key.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
    await f.sender.stopAndDrain();f.store.close();f.receiver.close();const child=spawn(process.execPath,[fileURLToPath(new URL('./capture-transfer-crash-child.js',import.meta.url)),f.podRoot,f.edgeRoot,keyFile,point,f.captured.commandId,JSON.stringify(f.podOptions.binding)],{stdio:'pipe'});let errors='';child.stderr.on('data',chunk=>{errors+=String(chunk);});const [code,signal]=await once(child,'exit');assert.equal(signal,'SIGKILL',`${point}: exit ${code}: ${errors.slice(0,1024)}`);
    f.restartEdge();await f.restartPod();const delivered=f.store.delivery(f.captured.commandId);
    if(point.startsWith('after-release-')){assert.equal(delivered!.state,'released');assert.equal(f.store.retentionStatus().retainedBytes,0);}else{assert.ok(f.store.readImage(f.captured).length>0);if(point==='after-transfer-ack')assert.equal(delivered!.state,'acknowledged');else assert.equal(delivered,null);await complete(f);}
    assert.equal(f.receiver.status().owned,1);assert.equal(f.receiver.readOwned(f.captured.image!.id).bytes.length,f.captured.image!.bytes);assert.equal(f.store.records().length,1);
  }
});
test('verified native cursor custody flushes historical audit/usage/diagnostics without a cloud commit or erased gap',async t=>{
  const f=fixture(t);await f.sender.step(f.captured.commandId);const m=f.store.manifest(f.captured.commandId),events=JSON.parse(readFileSync(new URL('../../../packages/arbi-protocol/fixtures/audit-events.json',import.meta.url),'utf8')).valid;
  const event=structuredClone(events.capture);event.realm=m.realm;event.siteId=m.siteId;event.source={module:'pod',identity:f.source()};event.links.target=f.source();event.resource.deviceId=f.source().deviceId;
  const audit=new SqliteAuditSpool({path:join(f.podRoot,'audit.sqlite'),realm:m.realm,siteId:m.siteId,executionMode:'simulation',source:event.source,maxEvents:32,maxBytes:262144,maxPages:256}),diagnostics=new DiagnosticBuffer(join(f.podRoot,'diagnostics.sqlite'));
  audit.append(event);diagnostics.append({code:'DIAGNOSTIC_ACCEPTED',atMs:0,bootId:f.source().bootId,connectionId:null,correlationId:m.correlationId,sequence:'1'});
  const recovery=new PodCursorRecovery({source:f.source(),edge:f.edge,publicKey:f.key.publicKey,authorized:()=>true,audit,usage:f.usage,diagnostics});t.after(async()=>{await recovery.stopAndDrain();audit.close();diagnostics.close();});
  f.receiver.options.ingestClock=()=>({utc:'2026-10-11T11:30:00.000Z',uncertaintyMs:25,deviceId:'edge-custody'});
  const transport={send:async(kind:Parameters<CaptureReceiver['acceptCursor']>[0],id:string,body:unknown,pod:ReturnType<typeof f.source>,signal:AbortSignal)=>{signal.throwIfAborted();return f.receiver.acceptCursor(kind,id,body,pod);}};
  const first=await recovery.flush(transport);assert.equal(first.audit,1);assert.equal(first.usage,1);assert.equal(first.diagnostic,1);assert.equal(first.reason,null);assert.equal(first.cloudCommitted,false);assert.equal(audit.status().pending,0);assert.equal(f.usage.status().pending,0);assert.equal(diagnostics.status().buffered,0);assert.equal(f.receiver.cursorStatus().retained,3);assert.equal(f.receiver.cursorStatus().wanDelivery,'not-delivered');assert.equal(recovery.status().coverage,'partial');
  const handed=f.receiver.pendingCursors();assert.deepEqual(handed.find(x=>x.kind==='audit')!.body,event);assert.equal(handed.find(x=>x.kind==='usage')!.body.gap,'clock-uncertain');assert.equal(handed.find(x=>x.kind==='diagnostic')!.body.bootId,f.source().bootId);
  assert.deepEqual((await recovery.flush(transport)),{audit:0,usage:0,diagnostic:0,cloudCommitted:false,reason:null});
});
test('lost, invalid, revoked and timed-out cursor acknowledgements preserve the durable prefix and quarantine late transports',async t=>{
  const f=fixture(t),m=f.store.manifest(f.captured.commandId),source=f.source(),audit=new SqliteAuditSpool({path:join(f.podRoot,'audit.sqlite'),realm:m.realm,siteId:m.siteId,executionMode:'simulation',source:{module:'pod',identity:source},maxEvents:32,maxBytes:262144,maxPages:256}),diagnostics=new DiagnosticBuffer(join(f.podRoot,'diagnostics.sqlite'));
  t.after(()=>{audit.close();diagnostics.close();});diagnostics.append({code:'COMMAND_REJECTED',atMs:0,bootId:source.bootId,connectionId:null,correlationId:m.correlationId,sequence:'1'});
  let allowed=true;const recovery=new PodCursorRecovery({source,edge:f.edge,publicKey:f.key.publicKey,authorized:()=>allowed,audit,usage:f.usage,diagnostics,timeoutMs:20});t.after(()=>recovery.stopAndDrain());
  let lost=true;const transport={send:async(kind:Parameters<CaptureReceiver['acceptCursor']>[0],id:string,body:unknown,pod:typeof source,signal:AbortSignal)=>{signal.throwIfAborted();const receipt=f.receiver.acceptCursor(kind,id,body,pod);if(lost){lost=false;throw new Error('ACK_LOST');}return receipt;}};
  assert.equal((await recovery.flush(transport)).reason,'CURSOR_RECOVERY_REQUIRED');assert.equal(diagnostics.status().buffered,1);assert.equal(f.receiver.cursorStatus().retained,1);const restored=await recovery.flush(transport);assert.equal(restored.diagnostic,1);assert.equal(f.receiver.cursorStatus().retained,1);
  diagnostics.append({code:'COMMAND_REJECTED',atMs:1,bootId:source.bootId,connectionId:null,correlationId:m.correlationId,sequence:'2'});allowed=false;assert.equal((await recovery.flush(transport)).reason,'CURSOR_RECOVERY_REQUIRED');assert.equal(diagnostics.status().buffered,1);allowed=true;
  const invalid={send:async(...args:Parameters<typeof transport.send>)=>{const r=await transport.send(...args);return {...r,contentHash:'0'.repeat(64)};}};assert.equal((await recovery.flush(invalid)).reason,'CURSOR_RECOVERY_REQUIRED');assert.equal(diagnostics.status().buffered,1);
  assert.equal((await recovery.flush({send:async()=>new Promise(()=>{})})).reason,'CURSOR_RECOVERY_TIMEOUT');await assert.rejects(recovery.flush(transport),{code:'CURSOR_TRANSPORT_QUARANTINED'});assert.equal(diagnostics.status().buffered,1);
});
test('SIGKILL after edge cursor commit preserves the pod prefix; fresh-epoch retransmission deduplicates edge custody',{timeout:10000},async t=>{
  const f=fixture(t),aux=mkdtempSync(join(tmpdir(),'arbi-capture-kill-'));t.after(()=>rmSync(aux,{recursive:true,force:true}));const keyFile=join(aux,'test-key.pem');writeFileSync(keyFile,f.key.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});await f.sender.stopAndDrain();f.store.close();f.receiver.close();
  const child=spawn(process.execPath,[fileURLToPath(new URL('./capture-transfer-crash-child.js',import.meta.url)),f.podRoot,f.edgeRoot,keyFile,'after-cursor-commit',f.captured.commandId,JSON.stringify(f.podOptions.binding)],{stdio:'pipe'});let errors='';child.stderr.on('data',chunk=>{errors+=String(chunk);});const [code,signal]=await once(child,'exit');assert.equal(signal,'SIGKILL',`exit ${code}: ${errors.slice(0,1024)}`);f.restartEdge();await f.restartPod();
  const diagnostics=new DiagnosticBuffer(join(f.podRoot,'diagnostics.sqlite')),m=f.store.manifest(f.captured.commandId),audit=new SqliteAuditSpool({path:join(f.podRoot,'audit.sqlite'),realm:m.realm,siteId:m.siteId,executionMode:'simulation',source:{module:'pod',identity:f.source()},maxEvents:32,maxBytes:262144,maxPages:256});assert.equal(diagnostics.status().buffered,1);assert.equal(f.receiver.cursorStatus().retained,1);
  const recovery=new PodCursorRecovery({source:f.source(),edge:f.edge,publicKey:f.key.publicKey,authorized:()=>true,audit,usage:f.usage,diagnostics});t.after(async()=>{await recovery.stopAndDrain();audit.close();diagnostics.close();});
  const r=await recovery.flush({send:async(kind,id,body,pod,signal)=>{signal.throwIfAborted();return f.receiver.acceptCursor(kind,id,body,pod);}});assert.equal(r.diagnostic,1);assert.equal(r.reason,null);assert.equal(f.receiver.cursorStatus().retained,1);assert.equal(diagnostics.status().buffered,0);assert.equal(r.cloudCommitted,false);assert.equal(f.store.delivery(f.captured.commandId),null);
});
