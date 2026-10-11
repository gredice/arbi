import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { COLOURS,originalFromCapture } from './contracts.js';
import type { Calibration,Original } from './contracts.js';
import { ImageProcessor,selectUpload } from './processor.js';
import { decodePng,encodePng } from './png.js';
import { hash } from './pipeline.js';
import { homography,project,undistort } from './geometry.js';

function fixture(options:{points?:{x:number;y:number}[];missing?:boolean;flat?:number;duplicate?:boolean}={}) {
  const rgb=new Uint8Array(64*64*3);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){const v=options.flat??((Math.floor(x/4)+Math.floor(y/4))%2?40:220);rgb.set([v,v,v],(y*64+x)*3);}
  const points=options.points??[{x:10,y:10},{x:53,y:10},{x:53,y:53},{x:10,y:53}],colours=[[240,20,20],[20,240,20],[20,20,240],[240,20,240]];
  const marker=(x:number,y:number,n:number)=>{for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)rgb.set(colours[n],((y+dy)*64+x+dx)*3);};
  if(options.flat===undefined){points.forEach((p,n)=>{if(!options.missing||n!==2)marker(p.x,p.y,n);});if(options.duplicate)marker(32,32,0);}
  const png=encodePng({width:64,height:64,rgb});
  const original:Original={id:'raw-fixture-1',sha256:hash(png),bytes:png.length,contentType:'image/png',widthPx:64,heightPx:64,siteId:'fictional-site',targetId:'fictional-bed',jobId:'fixture-job',correlationId:'fixture-job',configurationDigest:'c'.repeat(64),captureCalibrationRevision:'capture-calibration-1'};
  const calibration:Calibration={version:'arbi.image-calibration/1.0',origin:'simulated',revision:'vision-calibration-1',siteId:original.siteId,configurationDigest:original.configurationDigest,captureCalibrationRevision:original.captureCalibrationRevision,targetId:original.targetId,frameRevision:'fictional-bed-plane-1',widthPx:64,heightPx:64,
    intrinsics:{fx:64,fy:64,cx:31.5,cy:31.5,k1:0,k2:0,p1:0,p2:0},bed:{xMm:0,yMm:0,widthMm:1000,heightMm:1000,planeZMm:0,outputWidthPx:44,outputHeightPx:44},
    fiducials:COLOURS.map((colour,n)=>({colour,positionMm:[{x:0,y:0},{x:1000,y:0},{x:1000,y:1000},{x:0,y:1000}][n]})),quality:{revision:'synthetic-quality-1',minimumLaplacianVariance:1000,minimumMean:30,maximumMean:225,maximumClippedFraction:0.2}};
  return {png,original,calibration,rgb};
}
const near=(a:number,b:number,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);
test('golden crop preserves exact pixels, transform, digests, raw identity and independent states',async()=>{
  const f=fixture(),before=Buffer.from(f.png),p=new ImageProcessor(),result=await p.process(f.original,f.png,f.calibration);p.close();
  assert.equal(result.processing.state,'rectified');const d=result.processing.derivative!;
  const h=d.transform.homography;[43/64,0,-21.5/64,0,43/64,-21.5/64,0,0,1].forEach((v,n)=>near(h[n],v));
  const decoded=decodePng(d.png),expected=new Uint8Array(44*44*3);
  for(let y=0;y<44;y++)expected.set(f.rgb.subarray(((y+10)*64+10)*3,((y+10)*64+54)*3),y*44*3);
  assert.deepEqual(decoded.rgb,expected);assert.equal(hash(d.png),d.sha256);assert.equal(d.bytes,d.png.length);assert.equal(d.originalSha256,hash(before));
  assert.equal(d.originalId,f.original.id);assert.equal(d.calibrationRevision,f.calibration.revision);assert.equal(d.frameRevision,'fictional-bed-plane-1');
  assert.deepEqual(f.png,before);assert.deepEqual(result.capture,{state:'captured',original:f.original});assert.deepEqual(result.upload,{state:'not-uploaded'});assert.equal(result.physicalCalibrationAccepted,false);
  assert.ok(result.processing.quality!.accepted);assert.ok(result.resources.workUnits<=8000000);
});
test('projective golden correspondence produces the independently calculated four-corner transform',async()=>{
  const points=[{x:8,y:8},{x:52,y:8},{x:48,y:52},{x:8,y:56}],f=fixture({points}),p=new ImageProcessor(),r=await p.process(f.original,f.png,f.calibration);p.close();assert.equal(r.processing.state,'rectified');
  // Pixel-space corner equations: g-10h=-1 and 11g-h=1.
  const g=11/109,h=12/109,pixelH=[44+52*g,8*h,8,8*g,48+56*h,8,g,h,1];
  const normalized=[(pixelH[0]-31.5*g)/64,(pixelH[1]-31.5*h)/64,(8-31.5)/64,(pixelH[3]-31.5*g)/64,(pixelH[4]-31.5*h)/64,(8-31.5)/64,g,h,1];
  r.processing.derivative!.transform.homography.forEach((v,n)=>near(v,normalized[n]));
  for(const [n,corner] of [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}].entries()){const mapped=project(pixelH,corner);near(mapped.x,points[n].x);near(mapped.y,points[n].y);}
});
test('radial correction converges to an analytic reference and distorted pixels retain calibrated lineage',async()=>{
  const f=fixture({points:[{x:9,y:9},{x:54,y:9},{x:54,y:54},{x:9,y:54}]});f.calibration.intrinsics.k1=0.2;
  const known=undistort({x:47.75,y:39.625},f.calibration.intrinsics,()=>{});near(known.x,0.25);near(known.y,0.125);
  const p=new ImageProcessor(),r=await p.process(f.original,f.png,f.calibration);p.close();assert.equal(r.processing.state,'rectified');
  const d=r.processing.derivative!;near(d.transform.homography[0],43/64,0.015);near(d.transform.homography[4],43/64,0.015);assert.equal(d.transform.intrinsics.k1,0.2);
  assert.throws(()=>undistort({x:511,y:511},{...f.calibration.intrinsics,fx:1,fy:1},()=>{}),{code:'LENS_INVERSION_FAILED'});
});
test('missing/ambiguous fiducials, degenerate geometry, blur and exposure have explicit raw fallbacks',async()=>{
  for(const [f,reason] of [[fixture({missing:true}),'FIDUCIAL_MISSING'],[fixture({duplicate:true}),'FIDUCIAL_AMBIGUOUS'],[fixture({flat:128}),'BLUR_REJECTED'],[fixture({flat:0}),'EXPOSURE_REJECTED'],[fixture({flat:255}),'EXPOSURE_REJECTED']] as const){
    const p=new ImageProcessor(),r=await p.process(f.original,f.png,f.calibration);p.close();assert.equal(r.processing.state,'failed');assert.equal(r.processing.reason,reason);assert.equal(r.processing.derivative,null);assert.equal(selectUpload(r,f.png.length).kind,'raw');assert.deepEqual(r.upload,{state:'not-uploaded'});
  }
  assert.throws(()=>homography([{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:3,y:0}],[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]),{code:'FIDUCIAL_GEOMETRY'});
});
test('missing/incompatible/invalid calibration cannot rectify or fabricate target geometry',async()=>{
  const f=fixture();for(const scenario of ['missing','site','config','capture','dimensions','origin','nan','extra','frame']) {
    const c=structuredClone(f.calibration);if(scenario==='site')c.siteId='other-site';if(scenario==='config')c.configurationDigest='d'.repeat(64);if(scenario==='capture')c.captureCalibrationRevision='wrong';if(scenario==='dimensions')c.widthPx=65;
    if(scenario==='origin')(c as unknown as {origin:string}).origin='physical';if(scenario==='nan')c.intrinsics.fx=NaN;if(scenario==='extra')Object.assign(c.bed,{secret:'not-allowed'});if(scenario==='frame')c.frameRevision='';
    const p=new ImageProcessor(),r=await p.process(f.original,f.png,scenario==='missing'?null:c);p.close();assert.equal(r.processing.state,scenario==='missing'?'unavailable':'failed');assert.equal(r.processing.derivative,null);assert.ok(r.processing.reason!.startsWith('CALIBRATION_'));
  }
});
test('native capture producer fixture consumes real raw bytes and metadata with explicit missing-marker fallback',async()=>{
  const native=JSON.parse(readFileSync(new URL('../../fixtures/captured-png.json',import.meta.url),'utf8')),original=originalFromCapture(native.receipt),png=Buffer.from(native.pngBase64,'base64');
  assert.equal(native.producer.source,'5835fa2d4959f8cdd87bcc3ee2c7d47dc1f3af1a');assert.equal(native.producer.dirty,false);assert.equal(original.sha256,hash(png));assert.equal(original.bytes,png.length);assert.deepEqual(native.receipt.metadata.processing,{state:'not-processed',derivedIds:[]});
  const c=fixture().calibration;Object.assign(c,{siteId:original.siteId,targetId:original.targetId,configurationDigest:original.configurationDigest,captureCalibrationRevision:original.captureCalibrationRevision,widthPx:32,heightPx:24});c.intrinsics={fx:32,fy:24,cx:15.5,cy:11.5,k1:0,k2:0,p1:0,p2:0};
  const p=new ImageProcessor(),result=await p.process(original,png,c);p.close();assert.equal(result.processing.reason,'FIDUCIAL_MISSING');assert.equal(result.capture.state,'captured');assert.equal(result.upload.state,'not-uploaded');assert.equal(selectUpload(result,png.length).kind,'raw');
  const bad=structuredClone(native.receipt);bad.metadata.configuration.digest='x';assert.throws(()=>originalFromCapture(bad),{code:'ORIGINAL_INVALID'});
});
test('retries retain one logical derivative and revision/input changes create distinct lineage without raw mutation',async()=>{
  const f=fixture(),p=new ImageProcessor(),a=await p.process(f.original,f.png,f.calibration),b=await p.process(f.original,f.png,structuredClone(f.calibration));
  assert.equal(a.processing.derivative!.id,b.processing.derivative!.id);assert.equal(a.processing.derivative!.sha256,b.processing.derivative!.sha256);assert.deepEqual(a.processing.derivative!.transform,b.processing.derivative!.transform);
  const changed=structuredClone(f.calibration);changed.revision='vision-calibration-2';const c=await p.process(f.original,f.png,changed);assert.notEqual(c.processing.derivative!.id,a.processing.derivative!.id);
  assert.equal(selectUpload(a,a.processing.derivative!.bytes).kind,'rectified');assert.equal(selectUpload(a,f.png.length,'original-first').kind,'raw');assert.equal(selectUpload(a,0).state,'queued');assert.throws(()=>selectUpload(a,-1),{code:'UPLOAD_BUDGET_INVALID'});p.close();
});
test('bounded work, worker time, abort, single-owner concurrency and close cannot publish late derivatives',async()=>{
  const f=fixture(),tiny=new ImageProcessor({maximumWorkUnits:1}),cut=await tiny.process(f.original,f.png,f.calibration);tiny.close();assert.equal(cut.processing.reason,'PROCESSING_WORK_BUDGET');assert.equal(cut.processing.derivative,null);
  const timed=new ImageProcessor({timeoutMs:1}),timeout=await timed.process(f.original,f.png,f.calibration);assert.equal(timeout.processing.reason,'PROCESSING_TIMEOUT');timed.close();
  const p=new ImageProcessor(),abort=new AbortController(),pending=p.process(f.original,f.png,f.calibration,abort.signal),busy=await p.process(f.original,f.png,f.calibration);assert.equal(busy.processing.reason,'PROCESSING_BUSY');assert.throws(()=>p.close(),{code:'PROCESSING_BUSY'});abort.abort();assert.equal((await pending).processing.reason,'PROCESSING_ABORTED');
  assert.equal((await p.process(f.original,f.png,f.calibration)).processing.state,'rectified');p.close();await assert.rejects(p.process(f.original,f.png,f.calibration),{code:'PROCESSOR_CLOSED'});assert.throws(()=>new ImageProcessor({maximumWorkUnits:8000001}),{code:'PROCESSING_POLICY_INVALID'});
});
test('raw corruption, truncated PNG and independent filter fixtures reject invalid pixels before derivatives',async()=>{
  const f=fixture(),broken=Buffer.from(f.png);broken[40]^=1;const p=new ImageProcessor(),corrupt=await p.process(f.original,broken,f.calibration);assert.equal(corrupt.processing.reason,'RAW_INTEGRITY_FAILED');assert.equal(selectUpload(corrupt,8388608).state,'queued');
  const changed={...f.original,sha256:hash(broken)};assert.equal((await p.process(changed,broken,f.calibration)).processing.reason,'PNG_INVALID');assert.throws(()=>decodePng(f.png.subarray(0,-3)),{code:'PNG_INVALID'});
  const filters=JSON.parse(readFileSync(new URL('../../fixtures/png-filters.json',import.meta.url),'utf8'));
  for(const encoded of filters.pngBase64)assert.deepEqual([...decodePng(Buffer.from(encoded,'base64')).rgb],filters.expectedRgb);p.close();
});
