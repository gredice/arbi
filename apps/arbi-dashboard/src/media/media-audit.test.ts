import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {validateAuditEvent,type AuditEvent} from '@arbi/protocol';
import {createIsolatedIdentityProvider} from '@arbi/gredice/testing';
import {recordingAuditHook} from './recording-hooks';
import {setup} from './test-support';
import {PostgresMediaStore} from './store';
test('future recording hooks expose disabled authorization only for start, stop, failure, playback, export and delete',async()=>{
  const fixtures=JSON.parse(await readFile(new URL('../../../../packages/arbi-protocol/fixtures/audit-events.json',import.meta.url),'utf8'));
  const base=fixtures.valid['vocabulary-0'] as AuditEvent;
  const identity=createIsolatedIdentityProvider(base.realm),actor={kind:'human' as const,id:base.actor.id};identity.putSite(base.siteId,'recording-account');
  identity.putPrincipal({actor,accountId:'recording-account',member:true,sites:{[base.siteId]:{roles:['engineer','update-admin'],serviceScopes:[],active:true,revision:'membership-1'}}});const human=await identity.issue(actor);
  for(const operation of ['start','stop','failure','playback','export','delete']){
    const hook=recordingAuditHook(operation);assert.equal(hook.enabled,false);assert.match(hook.capability,/^recording\./);
    await assert.rejects(identity.adapter.authorize(human.token,hook.capability,{realm:base.realm,siteId:base.siteId,accountId:'recording-account',resource:{kind:'site',id:base.siteId},executionMode:'simulation'}),{code:'RECORDING_DISABLED'});
    const event={...base,...hook.denial,links:{...base.links,intentEventId:null,causationEventId:null}};
    assert.equal(validateAuditEvent(event).ok,true);assert.equal(validateAuditEvent({...event,action:hook.reservedAction,resource:{kind:'recording',id:'future-recording',deviceId:null},evidence:'access-grant',outcome:'allow',reason:'authorized'}).ok,false);
  }
  assert.throws(()=>recordingAuditHook('automatic'),{code:'INVALID_REQUEST'});
});
test('separate still viewers get audited grants before signing; URL replay/cache visibility cannot become delivered bytes',async t=>{
  const h=await setup(t),ready=await h.ready('shared-still'),sign=h.blob.adapter.accessGrant.bind(h.blob.adapter);let signings=0;
  h.blob.adapter.accessGrant=async(path,expires)=>{
    const prepared=(await h.db.query<{record:any}>('SELECT record FROM arbi_media_grants')).rows.filter(r=>r.record.issuance==='prepared');
    assert.equal(prepared.length,1);const grant=prepared[0].record;
    assert.equal((await h.db.query('SELECT id FROM arbi_media_audit WHERE id::text=$1',[grant.intentEventId])).rows.length,1);signings++;
    return sign(path,expires);
  };
  const first=await h.call('access',{variant:'full',operation:'view'},ready.imageId,'viewer'),second=await h.call('access',{variant:'full',operation:'download'},ready.imageId,'engineer');
  assert.equal(first.status,200);assert.equal(second.status,200);assert.notEqual(first.value.grantId,second.value.grantId);assert.equal(signings,2);
  const before=(await h.db.query('SELECT id FROM arbi_media_audit')).rows.length;
  for(let n=0;n<2;n++){const response=await fetch(first.value.url);assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,h.bytes.length);}
  assert.equal((await h.db.query('SELECT id FROM arbi_media_audit')).rows.length,before);
  const grants=(await h.db.query<{record:AuditEvent;detail:any}>("SELECT record,detail FROM arbi_media_audit WHERE record->>'evidence'='access-grant'")).rows;
  assert.deepEqual(new Set(grants.map(r=>r.record.actor.id)),new Set(['viewer','engineer']));
  assert.ok(grants.every(r=>r.detail.usage.transferBytes===null&&r.detail.usage.wanBytes===null));
  assert.equal((await h.db.query("SELECT id FROM arbi_media_audit WHERE record->>'evidence'='access-observation'")).rows.length,0);
});
test('provider signing failure closes prepared issuance with a linked failure and withholds every URL',async t=>{
  const h=await setup(t),ready=await h.ready('failed-signing'),sign=h.blob.adapter.accessGrant.bind(h.blob.adapter);
  h.blob.adapter.accessGrant=async(path,expires)=>{h.blob.controls.failIssue=true;return sign(path,expires);};
  const result=await h.call('access',{variant:'full',operation:'view'},ready.imageId);assert.equal(result.status,503);assert.equal(Object.hasOwn(result.value,'url'),false);
  const grant=(await h.db.query<{record:any}>('SELECT record FROM arbi_media_grants')).rows[0].record;assert.equal(grant.issuance,'failed');assert.equal(grant.revoked,true);
  const failure=(await h.db.query<{record:AuditEvent;detail:any}>("SELECT record,detail FROM arbi_media_audit WHERE detail->>'result'='signing-failed-no-response'")).rows[0];
  assert.equal(failure.record.outcome,'fail');assert.equal(failure.record.actor.id,'viewer');assert.equal(failure.detail.grantIntentEventId,grant.intentEventId);
  const audit=JSON.stringify((await h.db.query('SELECT record,detail FROM arbi_media_audit')).rows);assert.doesNotMatch(audit,/delegationToken|clientSigningToken|vercel-blob-signature/);
});
test('ordinary media audit refuses fsync-off storage; schema fixtures require an explicit isolated simulation realm',async t=>{
  const h=await setup(t);assert.equal((await h.db.query<{fsync:string}>('SHOW fsync')).rows[0].fsync,'off');
  const normal=new PostgresMediaStore(h.sql);
  await assert.rejects(normal.authorization({realm:{environment:'test',namespaceId:'media-fixture'},siteId:'site-a',actor:{kind:'human',id:'viewer'},sessionId:h.tokens.viewer.sessionId,
    capability:'still.read',decision:'authorized',correlationId:'durability-check',reason:null,membershipRevision:'membership-1',observedAtMs:Date.now(),surface:'media',resource:{kind:'site',id:'site-a'}},new AbortController().signal),{code:'UNAVAILABLE'});
  assert.throws(()=>new PostgresMediaStore(h.sql,{environment:'production',namespaceId:'forbidden'}),{code:'DENIED'});
});
test('a resource change after signing withholds the response and preserves a revoked linked grant failure',async t=>{
  const h=await setup(t),ready=await h.ready('post-sign-change'),sign=h.blob.adapter.accessGrant.bind(h.blob.adapter);
  h.blob.adapter.accessGrant=async(path,expires)=>{const url=await sign(path,expires);assert.equal((await h.call('delete',{imageId:ready.imageId,variant:'all'},undefined,'engineer')).status,200);return url;};
  const result=await h.call('access',{variant:'full',operation:'view'},ready.imageId);assert.equal(result.status,403);assert.equal(Object.hasOwn(result.value,'url'),false);
  const grant=(await h.db.query<{record:any}>('SELECT record FROM arbi_media_grants')).rows[0].record;assert.equal(grant.revoked,true);assert.equal(grant.issuance,'failed');
  const failure=(await h.db.query<{detail:any}>("SELECT detail FROM arbi_media_audit WHERE detail->>'result'='signed-response-withheld'")).rows[0];assert.equal(failure.detail.grantIntentEventId,grant.intentEventId);
});
