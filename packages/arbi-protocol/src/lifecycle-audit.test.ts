import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { updateIntentAudit,updateOutcomeAudit } from './lifecycle-audit.js';
import { validateAuditEvent } from './audit.js';
import type { UpdateJournal } from './update-types.js';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/updates.json',import.meta.url),'utf8'));
const journal = (): UpdateJournal => ({schemaVersion:'arbi.update/1.0',request:structuredClone(fixture.request),
  baseline:structuredClone(fixture.baseline),baselineManifest:structuredClone(fixture.baselineManifest),events:structuredClone(fixture.events)});
const clock = {utc:null,uncertaintyMs:null,monotonicMs:1000};
test('update audit keeps requesting actor, sanitized revisions and observed terminal boot; staging cannot be installation success',()=> {
  const j = journal(),source = {module:'edge' as const,identity:j.request.source};
  const root = updateIntentAudit(j,source,clock,'1');assert.ok(root.ok);
  assert.deepEqual(root.value.actor,j.request.auditContext.actor);assert.equal(root.value.effect,'none');assert.equal(root.value.links.sessionId,null);assert.equal(root.value.metadata.authorizationId,j.request.auditContext.authorizationId);
  const event = j.events.at(-1)!;
  const result = updateOutcomeAudit(root.value,j,event.eventId,{module:'motion',identity:event.source},{...clock,monotonicMs:2000},'2');
  assert.ok(result.ok,JSON.stringify(result));assert.equal(result.value.effect,'device-reported');
  assert.deepEqual(result.value.actor,root.value.actor);assert.equal(result.value.change?.after.revisionId,event.boot!.releaseId);
  assert.equal(result.value.record?.id,event.boot!.recordId);
  assert.equal(updateOutcomeAudit(root.value,j,j.events[0]!.eventId,source,clock,'3').ok,false);
  assert.equal(updateOutcomeAudit({...root.value,actor:{kind:'service',id:'forged'}},j,event.eventId,{module:'motion',identity:event.source},clock,'4').ok,false);
  assert.equal(updateOutcomeAudit(root.value,j,event.eventId,{module:'motion',identity:{...event.source,bootId:'forged'}},clock,'5').ok,false);
});
test('rollback attribution preserves original human while recording explicit recovery policy; interruption is unknown effect',()=> {
  const j = journal();j.events = [...j.events.slice(0,3),structuredClone(fixture.rollback)];
  const root = updateIntentAudit(j,{module:'edge',identity:j.request.source},clock,'1');assert.ok(root.ok,JSON.stringify(root));
  const result = updateOutcomeAudit(root.value,j,fixture.rollback.eventId,{module:'motion',identity:fixture.rollback.source},clock,'2');
  assert.ok(result.ok,JSON.stringify(result));assert.equal(result.value.action,'update.rollback');
  assert.equal(result.value.metadata.recoveryPolicy,'update-recovery/1');assert.deepEqual(result.value.actor,j.request.auditContext.actor);
  assert.equal(result.value.change?.after.state,'rolled-back');assert.equal(validateAuditEvent(result.value).ok,true);
});

test('update failure after installation reservation retains unknown effect, original actor and request linkage',()=> {
  const j = journal();
  const failure = { ...j.events[0]!,verification:null,kind:'failed' as const,eventId:'interrupted-install',observedAt:'2026-10-07T12:00:05.000Z' };
  j.events = [...j.events.slice(0,3),failure];
  const root = updateIntentAudit(j,{module:'edge',identity:j.request.source},clock,'1');assert.ok(root.ok,JSON.stringify(root));
  const result = updateOutcomeAudit(root.value,j,failure.eventId,{module:'edge',identity:failure.source},clock,'2');
  assert.ok(result.ok,JSON.stringify(result));assert.equal(result.value.effect,'unknown');assert.equal(result.value.evidence,'connection-loss');
  assert.equal(result.value.outcome,'interrupted');assert.deepEqual(result.value.actor,root.value.actor);
});
