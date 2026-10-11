import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import Ajv from 'ajv';
import { validateMessage } from '@arbi/protocol';
import { app } from './toolchain.mjs';
const validate=new Ajv({strict:true}).compile(JSON.parse(readFileSync(join(app,'schema/diagnostics.schema.json'),'utf8')));
const binary=process.env.ARBI_DIAGNOSTICS_HOST_BIN??join(app,'dist/host','diagnostics');
function run(mode){const r=spawnSync(binary,[mode],{encoding:'utf8',timeout:10000,maxBuffer:256000});assert.equal(r.status,0,r.error?.message??r.stderr);return JSON.parse(r.stdout);}
function contract(v){assert.equal(validate(v),true,JSON.stringify(validate.errors));}
test('source diagnostics never invent absent sensors, real inputs, reset cause or physical timing',()=>{
  for(const mode of ['snapshot','unconfigured','stale']) {
    const v=run(mode);contract(v);assert.equal(v.actuationInhibited,true);assert.equal(v.physicalAcceptance,false);
    for(const k of ['encoderCounts','motorCurrentA','lineTensionN']){assert.deepEqual(v[k],{quality:'unavailable',value:null,sampleMonotonicMs:null});const bad=structuredClone(v);bad[k].value=0;assert.equal(validate(bad),false);bad[k].quality='measured';assert.equal(validate(bad),false);}
    assert.ok(v.inputs.every(i=>i.realQuality==='unavailable'&&i.realValue===null));assert.equal(v.resetCause.value,null);
    assert.ok(Object.values(v.physicalTiming).every(x=>x===null));
    assert.equal(v.positionMm.quality,mode==='unconfigured'?'unavailable':mode==='stale'?'stale':'estimated');
    if(mode==='stale')assert.equal(v.positionMm.ageMs,200);
    if(mode==='snapshot'){assert.equal(v.commandedSteps.quality,'commanded');assert.equal(v.positionMm.frameRevision,'frame-1');assert.equal(v.counters.decimatedSnapshots,'1');}
  }
});
test('flooded diagnostics retain separate fault capacity, bound memory and disclose order, gaps and reset boundaries',()=>{
  const v=run('ring');assert.deepEqual({...v,memoryBytes:0},{normalCapacity:16,faultCapacity:4,gap:true,resetBoundary:true,memoryBytes:0});assert.ok(v.memoryBytes<65536);
  const rejected=run('redaction');contract(rejected);assert.equal(rejected.command,null);assert.ok(!JSON.stringify(rejected).includes('secret'));
});
test('controller accepted, rejected, completed and aborted records preserve epochs, command IDs and configuration',()=>{
  const records=run('outcomes');let previous=0n;const byCommand=new Map();
  for(const {record,protocolOutcome} of records){contract(record);assert.ok(BigInt(record.sequence)>previous);previous=BigInt(record.sequence);
    if(record.command){assert.equal(record.configuration.calibration,'calibration-1');assert.equal(record.configuration.frame,'frame-1');assert.equal(record.source.bootId,'boot-1');assert.equal(record.command.requestSource.bootId,'edge-boot-1');const list=byCommand.get(record.command.commandId)??[];list.push(record.kind);byCommand.set(record.command.commandId,list);}
    if(protocolOutcome){assert.equal(validateMessage(protocolOutcome).ok,true,JSON.stringify(protocolOutcome));assert.equal(protocolOutcome.sequence,record.sequence);assert.equal(protocolOutcome.body.commandId,record.command.commandId);assert.equal(protocolOutcome.body.correlationId,record.command.correlationId);assert.equal(protocolOutcome.executionMode,'simulation');if(record.kind==='aborted')assert.deepEqual(protocolOutcome.body.error,{code:'INTERRUPTED',retryable:false});}
  }
  assert.deepEqual(byCommand.get('move-2'),['accepted','completed','rejected']);assert.deepEqual(byCommand.get('move-3'),['accepted','aborted']);assert.ok(records.some(x=>x.record.kind==='fault'));
});
