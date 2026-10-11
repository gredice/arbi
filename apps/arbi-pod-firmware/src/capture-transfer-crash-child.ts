import { createPrivateKey,createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Identity } from '@arbi/protocol';
import { manifestDigest,payloadDigest } from '@arbi/protocol/capture-transfer';
import { CaptureReceiver } from '../../arbi-edge-controller/dist/images/capture-receiver.js';
import { CaptureStore } from './capture-store.js';
import { DiagnosticBuffer } from './diagnostic-buffer.js';
const [podRoot,edgeRoot,keyFile,point,commandId,bindingText]=process.argv.slice(2);if(!point||!bindingText)throw new Error('CRASH_CHILD_ARGUMENTS');
const binding=JSON.parse(bindingText),privateKey=createPrivateKey(readFileSync(keyFile)),fault=(p:string)=>{if(p===point)process.kill(process.pid,'SIGKILL');};
const store=new CaptureStore({root:podRoot,binding,fault}),manifest=store.manifest(commandId),pod=manifest.metadata.source as Identity,edge={deviceId:'edge',bootId:'edge-recovery-1',sessionId:'edge-recovery-session'};
const receiver=new CaptureReceiver({root:edgeRoot,realm:manifest.realm,siteId:manifest.siteId,podDeviceId:pod.deviceId,edge,privateKey,authorize:p=>p.deviceId===pod.deviceId&&p.bootId===pod.bootId&&p.sessionId===pod.sessionId,fault});
if(point==='after-cursor-commit') {
  const diagnostics=new DiagnosticBuffer(`${podRoot}/diagnostics.sqlite`),row={code:'COMMAND_REJECTED' as const,atMs:0,bootId:pod.bootId,connectionId:null,correlationId:manifest.correlationId,sequence:'1'};diagnostics.append(row);receiver.acceptCursor('diagnostic',`${pod.bootId}:1`,row,pod);throw new Error('CRASH_POINT_NOT_REACHED');
}
const progress=receiver.begin(manifest,pod),bytes=store.readImage(store.get(commandId)!);
if(progress.offset<bytes.length)receiver.chunk(manifest.image.id,manifestDigest(manifest),progress.offset,bytes.subarray(progress.offset),payloadDigest(bytes.subarray(progress.offset)),pod);
const receipt=receiver.finish(manifest.image.id,manifestDigest(manifest),pod);store.acknowledgeTransfer(commandId,receipt,edge,createPublicKey(privateKey));store.releaseAcknowledged(commandId);
receiver.close();store.close();throw new Error('CRASH_POINT_NOT_REACHED');
