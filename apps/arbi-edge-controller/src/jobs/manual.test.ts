import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { validateAuditEvent, type Command } from '@arbi/protocol';
import { createJobReference } from './reference.js';
const limits={deadmanMs:250,maxJogMs:500,maxLeaseMs:15000};
function rig(t:TestContext,directory?:string) {
  const d=directory??mkdtempSync(join(tmpdir(),'arbi-manual-'));if(!directory)t.after(()=>rmSync(d,{recursive:true,force:true}));
  const r=createJobReference(d,{manual:limits});t.after(()=>r.close());
  const command=(sequence=1):Command=>{
    const c=structuredClone(r.command);c.sequence=String(sequence);c.messageId=`manual-msg-${sequence}`;
    c.command.commandId=`manual-command-${sequence}`;c.command.idempotencyKey=`manual-key-${sequence}`;
    c.command.deadline.expiresMonotonicMs=r.authority.gate.nowMonotonicMs+500;
    c.body={type:'camera.gimbal',panDeg:1,tiltDeg:0,frame:r.applied.request.configuration.geometry.gimbalFrame,maxDurationMs:500};return c;
  };
  return {...r,command,d};
}
test('manual gestures require an explicit local session and fresh pulse; duplicate acquisition never renews deadman',t=>{
  const r=rig(t);assert.equal(r.consumer.receive(r.command()).error,'LEASE_STALE');
  r.manual!.acquire();assert.equal(r.consumer.receive(r.command(2)).error,'LEASE_STALE');
  r.manual!.pulse('1');const c=r.command(3);assert.equal(r.consumer.receive(c).outcome,'accepted');r.advance(1000);
  assert.equal(r.adapter.dispatches.length,1);
  r.authority.gate.nowMonotonicMs=1200;r.manual!.acquire();assert.equal(r.manual!.status.lastPulseMonotonicMs,1000);
  r.advance(1250);assert.equal(r.manual!.status.active,null);assert.equal(r.journal.get(c.command.commandId)!.outcome,'failed');
  assert.ok(r.adapter.stops>1);assert.equal(r.consumer.status.physicalActuationEnabled,false);
});
test('duplicate and reordered heartbeat packets cannot extend an active gesture',t=>{
  const r=rig(t);r.manual!.acquire();r.manual!.pulse('10');
  r.authority.gate.nowMonotonicMs=1150;
  for(const sequence of ['10','9'])assert.throws(()=>r.manual!.pulse(sequence),/SEQUENCE_REPLAY/);
  assert.equal(r.manual!.status.lastPulseMonotonicMs,1000);r.advance(1250);assert.equal(r.manual!.status.active,null);
  assert.throws(()=>r.manual!.pulse('11'),/LEASE_STALE/);assert.throws(()=>r.manual!.acquire(),/LEASE_STALE/);
  assert.equal(r.journal.status().degraded,false);
});
test('manual timeout is local monotonic time; source UTC jumps do not renew it',t=>{
  const r=rig(t);r.manual!.acquire();r.manual!.pulse('1');
  const c=r.command();c.sourceTime.utc='2099-01-01T00:00:00.000Z';c.sourceTime.uncertaintyMs=1;
  assert.equal(r.consumer.receive(c).outcome,'accepted');r.advance(1000);
  r.authority.gate.nowMonotonicMs=1249;r.manual!.tick();assert.notEqual(r.manual!.status.active,null);r.advance(1250);assert.equal(r.manual!.status.active,null);
  assert.equal(r.journal.get(c.command.commandId)!.error,'LEASE_EXPIRED');
});
test('release before dispatch cannot allow an admitted gesture to start later; retry returns history without renewal',t=>{
  const r=rig(t);r.manual!.acquire();r.manual!.pulse('1');const c=r.command();const admitted=r.consumer.receive(c);
  r.manual!.release();r.advance(1000);assert.equal(r.adapter.dispatches.length,0);
  const result=r.consumer.receive({...c,messageId:'retry',sequence:'2'});assert.equal(result.outcome,'failed');
  assert.equal(result.command.command.commandId,admitted.command.command.commandId);assert.equal(r.manual!.status.active,null);
});
test('two operators and revoked/older fences cannot regain authority; explicit stopped handover uses a higher fence',t=>{
  const r=rig(t);r.manual!.acquire();r.manual!.pulse('1');const first=structuredClone(r.authority.gate);
  r.authority.gate.authorizedActor={kind:'human',id:'second-operator'};
  r.authority.gate.lease={...first.lease!,id:'second-lease',holderId:'second-operator',fence:String(BigInt(first.lease!.fence)+1n)};
  assert.throws(()=>r.manual!.pulse('2'),/LEASE_STALE/);assert.equal(r.manual!.status.active,null);
  r.manual!.acquire();r.manual!.pulse('1');assert.equal(r.manual!.status.actor!.id,'second-operator');r.manual!.release();
  Object.assign(r.authority.gate,first);assert.throws(()=>r.manual!.acquire(),/LEASE_STALE/);assert.equal(r.adapter.dispatches.length,0);
});
test('viewer source capabilities, recording and maintenance never create actuator authority',async t=>{
  for(const mutate of [
    (r:ReturnType<typeof rig>)=>{r.authority.gate.allowedTypes=['state.resync'];},
    (r:ReturnType<typeof rig>)=>{r.authority.gate.authorizedActor={kind:'service',id:'viewer'};},
    (r:ReturnType<typeof rig>)=>{r.authority.gate.lease=null;},
    (r:ReturnType<typeof rig>)=>{r.authority.state='Maintenance';},
    (r:ReturnType<typeof rig>)=>{r.authority.mode='inhibited';},
    (r:ReturnType<typeof rig>)=>{r.authority.cloudConnected=false;}
  ])await t.test('denied',sub=>{const r=rig(sub);mutate(r);assert.throws(()=>r.manual!.acquire(),/NOT_AUTHORIZED/);assert.equal(r.adapter.dispatches.length,0);});
  const r=rig(t);r.manual!.acquire();r.manual!.pulse('1');
  assert.throws(()=>r.consumer.receive({...r.command(),body:{type:'recording.start'}}),/UNKNOWN_TYPE/);
});
test('unknown/stale calibration, excessive duration and movement interlocks are applied before dispatch',t=>{
  const r=rig(t);r.manual!.acquire();r.manual!.pulse('1');
  const long=r.command();if('maxDurationMs' in long.body)long.body.maxDurationMs=501;assert.equal(r.consumer.receive(long).error,'INVALID_RANGE');
  r.authority.stationary=false;assert.equal(r.consumer.receive(r.command(2)).error,'INVALID_TRANSITION');r.authority.stationary=true;
  const config=r.command(3);config.command.configRevision='old';assert.equal(r.consumer.receive(config).error,'CONFIG_MISMATCH');
  r.authority.conditions.maintenance.value='deny';assert.equal(r.consumer.receive(r.command(4)).error,'FAULT_INHIBITED');assert.equal(r.adapter.dispatches.length,0);
});
test('network loss, suspended client and changed receiver/module epoch stop on the next independent tick',async t=>{
  for(const mutate of [
    (r:ReturnType<typeof rig>)=>{r.authority.cloudConnected=false;},
    (r:ReturnType<typeof rig>)=>{r.authority.gate.lease=null;},
    (r:ReturnType<typeof rig>)=>{r.authority.modules.motion.generation++;},
    (r:ReturnType<typeof rig>)=>{r.authority.gate.receiver={...r.authority.gate.receiver,bootId:'new-boot'};},
    (r:ReturnType<typeof rig>)=>{r.authority.state='Maintenance';},
    (r:ReturnType<typeof rig>)=>{r.authority.gate.nowMonotonicMs=999;}
  ])await t.test('stopped',sub=>{
    const r=rig(sub);r.manual!.acquire();r.manual!.pulse('1');const c=r.command();r.consumer.receive(c);r.advance(1000);
    mutate(r);r.consumer.tick();assert.equal(r.manual!.status.active,null);assert.equal(r.journal.get(c.command.commandId)!.outcome,'failed');assert.ok(r.adapter.stops>1);
  });
});
test('persisted fence survives journal close/reopen and process restart never restores an unfinished gesture',t=>{
  const r=rig(t);r.manual!.acquire();r.manual!.pulse('1');const c=r.command();r.consumer.receive(c);r.advance(1000);r.close();
  const restarted=rig(t,r.d);assert.equal(restarted.manual!.status.active,null);assert.equal(restarted.adapter.dispatches.length,0);
  assert.equal(restarted.journal.get(c.command.commandId)!.outcome,'failed');assert.throws(()=>restarted.manual!.acquire(),/LEASE_STALE/);
});
test('SIGKILL after manual dispatch retains its fence and interrupts the gesture without redispatch',{timeout:15000},async t=>{
  const d=mkdtempSync(join(tmpdir(),'arbi-manual-crash-'));t.after(()=>rmSync(d,{recursive:true,force:true}));
  const child=spawn(process.execPath,[fileURLToPath(new URL('./crash-worker.js',import.meta.url)),d,'after-send','1','--manual'],{stdio:'ignore'});
  assert.equal((await once(child,'exit'))[1],'SIGKILL');
  const restarted=rig(t,d);assert.equal(restarted.journal.get('durable-capture')!.outcome,'failed');assert.equal(restarted.manual!.status.active,null);
  assert.throws(()=>restarted.manual!.acquire(),/LEASE_STALE/);assert.equal(restarted.consumer.tick(),null);assert.equal(restarted.adapter.dispatches.length,0);
});
test('lease pulse cannot extend the original command duration, and actual simulated timeout bounds are recorded',t=>{
  const r=rig(t);r.manual!.acquire();r.manual!.pulse('1');const c=r.command();r.consumer.receive(c);r.advance(1000);
  // A bounded simulator command may finish; fresh pulses never move its original expiry beyond 1500.
  for(let now=1050;now<=1500;now+=50){r.authority.gate.nowMonotonicMs=now;r.manual!.pulse(String(now));r.advance(now);}
  assert.equal(r.journal.get(c.command.commandId)!.expiresAtMs,1500);
  r.authority.gate.nowMonotonicMs=1750;r.consumer.tick();assert.equal(r.manual!.status.active,null);
  t.diagnostic('Synthetic deadman: 250 ms; sampling: 50 ms; observed closure at exact deadline, 0 ms sample overshoot. No physical timing claim.');
});
test('lease lifecycle audit hooks are bounded, attributable and copied through the existing durable spool',t=>{
  const r=rig(t);r.manual!.acquire();for(let n=1;n<=10;n++)r.manual!.pulse(String(n));r.manual!.release();
  const events=r.journal.pendingAudit();assert.equal(events.length,3);
  for(const e of events)assert.equal(validateAuditEvent(e).ok,true);
  assert.deepEqual(events.map(e=>e.evidence),['intent','authorization','service-outcome']);
  assert.equal(events[2].action,'control.session.end');assert.equal(events[2].links.intentEventId,events[0].eventId);
  r.consumer.tick();assert.equal(r.journal.pendingAudit().length,0);assert.equal(r.manual!.status.physicalActuationEnabled,false);
});
