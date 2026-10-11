import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {CaptureStage} from './stage.js';
import {captureStageFixture,captureMarkerCalibration} from './stage-fixture.js';
import {ImageProcessor} from './processor.js';
import {CaptureHistorySource} from './history.js';
import {validateCaptureHistoryRow} from '@arbi/protocol/capture-history';
import {createCommissioningReference} from '../commissioning/reference.js';
test('native staged history retains independent failed processing and pending/failed upload across restart; failed focus stays separate',async t=>{
  const f=captureStageFixture(),root=mkdtempSync(join(tmpdir(),'arbi-capture-stage-')),processor=new ImageProcessor(),options={root,realm:f.manifest.realm,siteId:f.manifest.siteId};let stage=new CaptureStage(options);
  t.after(()=>{stage.close();processor.close();f.receiver.close();for(const p of [root,f.root])rmSync(p,{recursive:true,force:true});});
  const record=await stage.stage(f.receiver,f.manifest.image.id,processor,null,Date.now());assert.equal(record.artifacts[0].trace.processing.state,'unavailable');
  const failed={version:'arbi.capture-result/1.0',commandId:'focus-failure',correlationId:'failed-job',resourceId:'other-target',fingerprint:'a'.repeat(64),state:'failed',phase:'autofocus',reason:'FOCUS_FAILED',image:null,metadata:null};
  const source=()=>new CaptureHistorySource({stage,podResults:()=>[failed],configuration:()=>null});const first=source().rows();assert.equal(first.length,2);assert.equal(first.find(r=>r.id==='focus-failure')!.camera.focus,'failed');assert.equal(first[0].camera.state,'captured');assert.equal(first[0].artifacts[0].upload.state,'pending');assert.equal(first[0].association,null);
  stage.attempt(f.manifest.image.id,f.manifest.image.id);stage.failed(f.manifest.image.id,f.manifest.image.id,'UPLOAD_TIMEOUT');stage.close();stage=new CaptureStage(options);const restored=source().rows()[0];assert.equal(restored.id,f.manifest.image.id);assert.equal(restored.artifacts[0].upload.reason,'UPLOAD_TIMEOUT');assert.equal(restored.camera.state,'captured');assert.equal(restored.manifest!.metadata.capturedAt&&JSON.stringify(restored.manifest!.metadata.capturedAt),JSON.stringify(f.manifest.metadata.capturedAt));
  const bad=structuredClone(restored);bad.camera.state='failed';assert.throws(()=>validateCaptureHistoryRow(bad));const wrong=structuredClone(restored);wrong.artifacts[0].trace.manifest.correlationId='other-job';assert.throws(()=>validateCaptureHistoryRow(wrong));
});
test('protected native framing review reads applied/staged identities and authoritative audit; incompatible edits cannot activate',async t=>{
  const root=mkdtempSync(join(tmpdir(),'arbi-commission-')),r=await createCommissioningReference(root);t.after(()=>{r.close();rmSync(root,{recursive:true,force:true});});await r.enrollAll();
  assert.equal((await r.request('stage',{set:r.set,reason:'review-initial'})).status,200);assert.equal((await r.request('activate')).status,200);
  const response=await r.request('review');assert.equal(response.status,200);const first=await response.json();assert.equal(first.active.configuration.revision,r.set.configuration.revision);assert.ok(first.revisions.some((x:{correlationId:string|null})=>x.correlationId));assert.ok(first.audit.some((x:{action:string})=>x.action==='configuration.change'));assert.equal(JSON.stringify(first).includes('privateKey'),false);
  const incompatible=structuredClone(r.set);incompatible.configuration.revision='new-framing-revision';incompatible.configuration.previousRevision=r.set.configuration.revision;incompatible.targets[0].panDeg=999;
  assert.equal((await r.request('stage',{set:incompatible,reason:'framing-edit'})).status,409);const rejected=await (await r.request('review')).json();assert.equal(rejected.active.configuration.revision,r.set.configuration.revision);assert.ok(rejected.status.rejected.reason);assert.equal(rejected.staged,null);
  r.provider.putPrincipal({actor:{kind:'human',id:'fixture-technician'},accountId:'fixture-account',member:false,sites:{[r.set.configuration.siteId]:{roles:['engineer'],serviceScopes:[],active:false,revision:'revoked'}}});assert.equal((await r.request('review')).status,403);
});

test('actual processing rejects missing fiducials without changing capture/focus or pretending upload success',async t=>{
  const f=captureStageFixture(),root=mkdtempSync(join(tmpdir(),'arbi-capture-stage-')),processor=new ImageProcessor(),stage=new CaptureStage({root,realm:f.manifest.realm,siteId:f.manifest.siteId});
  t.after(()=>{stage.close();processor.close();f.receiver.close();for(const p of [root,f.root])rmSync(p,{recursive:true,force:true});});
  await stage.stage(f.receiver,f.manifest.image.id,processor,captureMarkerCalibration(f.manifest),Date.now());const source=new CaptureHistorySource({stage,podResults:()=>[],configuration:()=>null}),row=source.rows()[0];
  assert.equal(row.camera.state,'captured');assert.equal(row.camera.focus,'focused');assert.equal(row.artifacts[0].trace.processing.state,'failed');assert.equal(row.artifacts[0].trace.processing.reason,'FIDUCIAL_MISSING');assert.equal(row.artifacts.length,1);assert.equal(row.artifacts[0].upload.state,'pending');
});
