/** Explicit source-only fixture composition; never selected by normal runtime. */
import {readFileSync,mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {generateKeyPairSync} from 'node:crypto';
import {configurationDigest,type Realm} from '@arbi/protocol';
import {payloadDigest} from '@arbi/protocol/capture-transfer';
import type {CaptureManifest} from '@arbi/protocol/capture-transfer';
import {CaptureReceiver} from './capture-receiver.js';
import {decodePng,encodePng} from './png.js';
import type {Calibration} from './contracts.js';
export function captureStageFixture(markers=false,scope?:{realm:Realm;siteId:string}){
  const fixture=JSON.parse(readFileSync(new URL('../../fixtures/captured-png.json',import.meta.url),'utf8')),r=fixture.receipt,{file:_,...image}=r.image;
  if(scope){if(scope.realm.environment!=='test')throw Error('ISOLATED_SCOPE_REQUIRED');r.metadata.realm=scope.realm;r.metadata.siteId=scope.siteId;}
  let bytes:Buffer=Buffer.from(fixture.pngBase64,'base64');
  if(markers){const decoded=decodePng(bytes),points=[{x:4,y:4},{x:27,y:4},{x:27,y:19},{x:4,y:19}],colours=[[240,20,20],[20,240,20],[20,20,240],[240,20,240]];
    for(const [n,p] of points.entries())for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)decoded.rgb.set(colours[n],((p.y+dy)*decoded.width+p.x+dx)*3);
    bytes=encodePng(decoded);image.sha256=payloadDigest(bytes);image.bytes=bytes.length;fixture.producer={...fixture.producer,adapter:'explicit-marker-fixture',dirty:true};}
  const manifest:CaptureManifest={version:'arbi.capture-manifest/1.0',realm:r.metadata.realm,siteId:r.metadata.siteId,podDeviceId:r.metadata.source.deviceId,commandId:r.commandId,correlationId:r.correlationId,targetId:r.resourceId,captureFingerprint:r.fingerprint,image,metadata:r.metadata};
  const root=mkdtempSync(join(tmpdir(),'arbi-edge-captures-')),keys=generateKeyPairSync('ed25519'),source={deviceId:'edge',bootId:'stage-edge-boot',sessionId:'stage-edge-session'};
  const receiver=new CaptureReceiver({root,realm:manifest.realm,siteId:manifest.siteId,podDeviceId:manifest.podDeviceId,edge:source,privateKey:keys.privateKey,authorize:()=>true}),pod=r.metadata.source;
  receiver.begin(manifest,pod);receiver.chunk(image.id,configurationDigest(manifest),0,bytes,payloadDigest(bytes),pod);receiver.finish(image.id,configurationDigest(manifest),pod);
  return {fixture,manifest,receiver,root,source,bytes};
}
export function captureMarkerCalibration(m:CaptureManifest):Calibration {
  const c=m.metadata.configuration as {digest:string;calibrationRevision:string};return {version:'arbi.image-calibration/1.0',origin:'simulated',revision:'marker-fixture-1',siteId:m.siteId,configurationDigest:c.digest,captureCalibrationRevision:c.calibrationRevision,targetId:m.targetId,frameRevision:'fixture-plane-1',widthPx:32,heightPx:24,
    intrinsics:{fx:32,fy:32,cx:15.5,cy:11.5,k1:0,k2:0,p1:0,p2:0},bed:{xMm:0,yMm:0,widthMm:1000,heightMm:1000,planeZMm:0,outputWidthPx:24,outputHeightPx:16},
    fiducials:(['red','green','blue','magenta'] as const).map((colour,n)=>({colour,positionMm:[{x:0,y:0},{x:1000,y:0},{x:1000,y:1000},{x:0,y:1000}][n]})),quality:{revision:'fixture-quality-1',minimumLaplacianVariance:1,minimumMean:1,maximumMean:254,maximumClippedFraction:0.2}};
}
