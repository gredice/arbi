import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { join } from 'node:path';
import { countsToPose, poseToCounts } from '@arbi/simulation-core';
import { app } from './toolchain.mjs';
const profile=JSON.parse(readFileSync(join(app,'dist/generated/motion-profile.json'),'utf8'));
const binary=process.env.ARBI_MOTION_HOST_BIN??join(app,'dist/host','motion');
const run=(mode,p) => {
  const result=spawnSync(binary,[mode,...p.map(String)],{encoding:'utf8',timeout:5000});
  assert.equal(result.status,0,result.error?.message??result.stderr); return JSON.parse(result.stdout);
};
const near=(a,b) => assert.ok(Math.abs(a-b)<=1e-7+1e-12*Math.abs(b),`${a} != ${b}`);
test('shared reference vectors and 200 seeded poses agree across simulator and MCU C core',()=>{
  const vectors=JSON.parse(readFileSync(new URL('../../../packages/arbi-protocol/fixtures/reference/1.0/vectors.json',import.meta.url),'utf8'));
  const positions=vectors.geometry.map(v=>v.positionMm);
  let seed=52;
  for(let n=0;n<200;n++) {
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    positions.push({x:400+random()*3200,y:400+random()*4200,z:700+random()*2100});
  }
  for(const p of positions) {
    const expected=poseToCounts(profile,p), actual=run('pose',[p.x,p.y,p.z]);
    assert.equal(actual.result,0);assert.deepEqual(actual.counts,expected.counts);
    actual.cables.forEach((v,i)=>near(v,expected.cableMm[i]));
    const inverse=countsToPose(profile,actual.counts),status=run('status',[p.x,p.y,p.z]);
    status.estimatedPositionMm.forEach((v,i)=>near(v,Object.values(inverse.positionMm)[i]));
    assert.equal(status.positionQuality,'estimated');assert.equal(status.lengthQuality,'estimated');
    assert.equal(status.measuredPosition,null);assert.equal(status.measuredTension,null);assert.equal(status.physicalAcceptance,false);
    assert.equal(status.modelDigest,profile.identity.binding);
  }
  for(const v of vectors.geometry) {
    const result=run('pose',Object.values(v.positionMm));
    result.cables.forEach((n,i)=>near(n,v.expectedLengthMm[['a','b','c','d'][i]]));
  }
});
test('nonfinite coordinates, units, frames, rates, travel and stale revisions refuse plans',()=>{
  for(const p of [[NaN,2000,2500],[Infinity,2000,2500],[199,2000,2500],[1000,2000,3001]]) assert.notEqual(run('pose',p).result,0);
  const result=spawnSync(binary,['lifecycle'],{encoding:'utf8',timeout:10000});
  assert.equal(result.status,0,result.error?.message??result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{lifecycle:'passed',physicalAcceptance:false});
});
test('seeded finite command traces remain within the same simulator model before and during progress',()=>{
  let seed=5201;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let n=0;n<50;n++) {
    const start={x:1000+random()*2000,y:1000+random()*3000,z:1000+random()*1500};
    const target={x:start.x+random()-0.5,y:start.y+random()-0.5,z:start.z+random()-0.5};
    const plan=run('plan',[...Object.values(start),...Object.values(target)]);
    assert.equal(plan.result,0);assert.ok(plan.durationTicks<=250000);
    assert.deepEqual(plan.initial,poseToCounts(profile,start).counts);assert.deepEqual(plan.target,poseToCounts(profile,target).counts);
    const counts=[...plan.initial];
    for(const word of plan.words) {
      for(let i=0;i<4;i++) if(word&(1<<(2*i))) counts[i]+=(word&(1<<(2*i+1)))?-1:1;
      const estimated=countsToPose(profile,counts);
      assert.ok(Object.values(estimated.positionMm).every(Number.isFinite));
    }
    assert.deepEqual(counts,plan.target);
  }
  const stationary=run('plan',[1000,2000,2500,1000,2000,2500]);
  assert.equal(stationary.result,0);assert.equal(stationary.words.length,2);
});
