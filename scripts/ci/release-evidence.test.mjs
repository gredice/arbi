import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {catalog,draftInput,evaluateReleaseEvidence,validateCatalog,procedureDigest} from './release-evidence.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
  const input=draftInput('a'.repeat(40)),artifacts=new Map(),release=input.release;
  release.configurationDigest='b'.repeat(64);
  for(const requirement of catalog.requirements)release.ownerAssignments[requirement.ownerRole]='synthetic-owner-'+requirement.ownerRole;
  for(const t of catalog.tests)release.hardwareRevisions[t.target]='synthetic-revision-'+t.target;
  for(const stage of catalog.stages.slice(2)){
    const limits={};for(const t of catalog.tests.filter(t=>t.stage===stage.id))for(const name of t.measurements)limits[name]={minimum:0,maximum:100,unit:'synthetic-unit'};
    const procedure={id:'synthetic-procedure-'+stage.id,reviewerId:'synthetic-independent-reviewer',approvedAtMs:1000000,validUntilMs:3000000,limits};release.procedures[stage.id]={...procedure,sha256:procedureDigest(procedure)};
  }
  for(const t of catalog.tests){
    const physical=catalog.stages.findIndex(s=>s.id===t.stage)>=2;
    const raw={version:'arbi.release-test-evidence/1.0',testId:t.id,sourceCommit:release.sourceCommit,configurationDigest:release.configurationDigest,provenance:physical?'physical-measurement':t.stage==='simulation'?'simulation':'source',targetRevision:release.hardwareRevisions[t.target],realFirmware:physical,controlledSubstitutes:physical&&!['secured-frame','installed-site'].includes(t.stage),stopConditionsRespected:true,startedAtMs:2000000,finishedAtMs:2000100,outcome:'passed',modelComparisonDigest:t.stage==='hardware-in-loop'?'c'.repeat(64):null,measurements:t.measurements.map(name=>({name,value:10,unit:'synthetic-unit',instrumentId:'synthetic-instrument',uncertainty:1}))};
    const file=t.id+'.json',bytes=Buffer.from(JSON.stringify(raw));artifacts.set(file,bytes);
    input.records.push({testId:t.id,status:'passed',sourceCommit:release.sourceCommit,configurationDigest:release.configurationDigest,procedureSha256:physical?release.procedures[t.stage].sha256:null,artifact:{file,sha256:hash(bytes)},review:{reviewerId:'synthetic-independent-reviewer',role:t.reviewerRole,decision:'accepted'}});
  }
  const options={readArtifact:file=>{if(!artifacts.has(file))throw Error('MISSING');return artifacts.get(file);}};
  const change=(id,patch)=>{const record=input.records.find(r=>r.testId===id),raw=JSON.parse(artifacts.get(record.artifact.file));Object.assign(raw,patch);const bytes=Buffer.from(JSON.stringify(raw));artifacts.set(record.artifact.file,bytes);record.artifact.sha256=hash(bytes);};
  return {input,artifacts,options,change};
}
test('pinned coverage maps every requirement/hazard to named tests, owners and explicit stage criteria',()=>assert.equal(validateCatalog(),true));
test('empty current-release inventory is incomplete and cannot enter physical stages',()=>{
  const report=evaluateReleaseEvidence(draftInput('a'.repeat(40)));assert.equal(report.complete,false);assert.equal(report.publicOperationReady,false);assert.ok(report.blockers.length>0);assert.ok(report.stages.every(s=>!s.entryEligible));assert.ok(report.tests.filter(t=>!['unit-contract','simulation'].includes(t.stage)).every(t=>t.status==='missing'));
});
test('all source/simulation evidence cannot stand in for absent physical records',()=>{
  const f=fixture();f.input.records=f.input.records.filter(r=>['unit-contract','simulation'].includes(catalog.tests.find(t=>t.id===r.testId).stage));const report=evaluateReleaseEvidence(f.input,f.options);
  assert.equal(report.complete,false);assert.equal(report.publicOperationReady,false);assert.equal(report.stages.find(s=>s.id==='installed-site').entryEligible,false);assert.equal(report.tests.find(t=>t.testId==='recording-acceptance').status,'not-applicable');
});
test('fully populated synthetic validator input may complete reported coverage but never grants public operation',()=>{
  const f=fixture(),report=evaluateReleaseEvidence(f.input,f.options);assert.equal(report.complete,true);assert.equal(report.publicOperationReady,false);assert.ok(report.stages.every(s=>s.complete));
});
test('failed early bench evidence blocks later stage eligibility even when later records claim success',()=>{
  const f=fixture();f.input.records.find(r=>r.testId==='dock-bench').status='failed';const report=evaluateReleaseEvidence(f.input,f.options);assert.equal(report.complete,false);assert.equal(report.tests.find(t=>t.testId==='dock-bench').status,'failed');assert.equal(report.stages.find(s=>s.id==='secured-frame').entryEligible,false);
});
test('simulation provenance, substitute-only loaded frame and missing firmware cannot pass physical acceptance',()=>{
  for(const [id,patch] of [['hil-local-stop',{provenance:'simulation'}],['frame-end-to-end',{controlledSubstitutes:true}],['target-update-bench',{realFirmware:false}]]){const f=fixture();f.change(id,patch);const report=evaluateReleaseEvidence(f.input,f.options);assert.equal(report.complete,false);assert.equal(report.tests.find(t=>t.testId===id).status,'missing');}
});
test('raw file mutation, stale source/configuration and wrong target revision remain blockers',()=>{
  for(const mutation of ['raw','source','config','target','outcome']){const f=fixture(),r=f.input.records.find(r=>r.testId==='hil-camera');if(mutation==='raw')f.artifacts.set(r.artifact.file,Buffer.from('{}'));if(mutation==='source')r.sourceCommit='d'.repeat(40);if(mutation==='config')r.configurationDigest='d'.repeat(64);if(mutation==='target')f.change(r.testId,{targetRevision:'different'});if(mutation==='outcome')f.change(r.testId,{outcome:'failed'});assert.equal(evaluateReleaseEvidence(f.input,f.options).complete,false);}
});
test('missing calibrated measurements, trace comparison or exceeded predefined uncertainty bounds cannot pass',()=>{
  for(const patch of [{startedAtMs:999999},{finishedAtMs:3000001},{measurements:[]},{modelComparisonDigest:null},{measurements:[{name:'stop-latency',value:100,unit:'synthetic-unit',instrumentId:'synthetic-instrument',uncertainty:1}]}]){const f=fixture();f.change('hil-local-stop',patch);assert.equal(evaluateReleaseEvidence(f.input,f.options).complete,false);}
});
test('missing named owner, rejected or non-independent physical review block completion',()=>{
  for(const mutation of ['owner','review','independent']){const f=fixture(),r=f.input.records.find(r=>r.testId==='dock-bench');if(mutation==='owner')delete f.input.release.ownerAssignments['mechanical-owner'];if(mutation==='review')r.review.decision='rejected';if(mutation==='independent')r.review.reviewerId=f.input.release.ownerAssignments['mechanical-owner'];assert.equal(evaluateReleaseEvidence(f.input,f.options).complete,false);}
});
test('recording N/A requires disabled feature proof and matching release; activation requires real acceptance',()=>{
  const f=fixture(),r=f.input.records.find(r=>r.testId==='recording-acceptance');Object.assign(r,{status:'not-applicable',artifact:null,review:null,procedureSha256:null});assert.equal(evaluateReleaseEvidence(f.input,f.options).complete,true);
  r.sourceCommit='d'.repeat(40);assert.equal(evaluateReleaseEvidence(f.input,f.options).complete,false);r.sourceCommit=f.input.release.sourceCommit;f.input.release.recordingEnabled=true;assert.equal(evaluateReleaseEvidence(f.input,f.options).complete,false);
});
test('duplicate/unknown records, traversal and changed procedure limits cannot erase mandatory gates',()=>{
  const f=fixture();f.input.records.push(f.input.records[0]);assert.throws(()=>evaluateReleaseEvidence(f.input,f.options),/DUPLICATE/);
  const g=fixture();g.input.records[0].testId='invented';assert.throws(()=>evaluateReleaseEvidence(g.input,g.options),/INVALID/);
  const h=fixture();h.input.records[0].artifact.file='../private';assert.equal(evaluateReleaseEvidence(h.input,h.options).complete,false);
  const j=fixture();j.input.release.procedures['component-bench'].limits.duration.maximum=1000;assert.throws(()=>evaluateReleaseEvidence(j.input,j.options),/PROCEDURE_DIGEST/);
});
