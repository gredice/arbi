import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { Configuration } from "@arbi/protocol";
import { countsToPose, mmPerStep, motionProfile, poseToCounts, validateMotionProfile, type AxisMechanics } from "./motion-geometry.js";
const c = JSON.parse(readFileSync(new URL("../../arbi-protocol/fixtures/configuration.json",import.meta.url),"utf8")).valid.configuration as Configuration;
const axes = JSON.parse(readFileSync(new URL("../fixtures/motion/synthetic.json",import.meta.url),"utf8")).axes as AxisMechanics[];
test("drum circumference, microstep division, direction and home reference are explicit",()=>{
  const p=motionProfile(c,axes), v={x:1000,y:2000,z:2500}, actual=poseToCounts(p,v);
  for(let i=0;i<4;i++) {
    const a=axes[i],expected=Math.sign(actual.cableMm[i]-a.homeCableMm)*Math.floor(Math.abs(actual.cableMm[i]-a.homeCableMm)/mmPerStep(a)+0.5);
    assert.equal(actual.counts[i],a.homeSteps+expected*a.direction);
  }
  const inverse=countsToPose(p,actual.counts);
  for(const key of ["x","y","z"] as const) assert.ok(Math.abs(inverse.positionMm[key]-v[key])<0.5);
  const changed=structuredClone(axes);changed[0].radiusMm+=1;
  assert.notEqual(motionProfile(c,changed).identity.binding,p.identity.binding);
  const stale=structuredClone(c);stale.calibration!.revision="calibration-2";
  assert.notEqual(motionProfile(stale,axes).identity.binding,p.identity.binding);
});
test("invalid mechanics, incompatible geometry and contradictory cables are refused",()=>{
  for(const [key,value] of [["radiusMm",NaN],["radiusMm",0],["microsteps",3],["direction",0],["maximumSteps",1e100],["maximumRateHz",20001],["homeCableMm",0]] as const) {
    const bad=structuredClone(axes);bad[0][key]=value;assert.throws(()=>motionProfile(c,bad));
  }
  const p=motionProfile(c,axes),bad=structuredClone(p);bad.anchors[2].z+=1;assert.throws(()=>validateMotionProfile(bad));
  assert.throws(()=>poseToCounts(p,{x:Infinity,y:2000,z:2500}));
  assert.throws(()=>countsToPose(p,[0,0,0,0]));
  const result=poseToCounts(p,{x:1000,y:2000,z:2500});result.counts[2]+=1000;assert.throws(()=>countsToPose(p,result.counts));
});
