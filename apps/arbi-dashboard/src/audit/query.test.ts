import assert from 'node:assert/strict';
import test from 'node:test';
import { auditQuery, retentionExpired, retentionPolicy } from './query-contracts';

test('audit queries reject cross-site claims, oversized ranges, duplicate-shaped fields and unsafe numbers',()=>{
  const valid={fromMs:0,toMs:86400000,limit:100,actorId:'operator-1',deviceId:'edge-1',correlationId:'correlation-1'};
  assert.deepEqual(auditQuery(valid),valid);
  for(const patch of [{siteId:'other'},{limit:101},{limit:1.1},{fromMs:-1},{toMs:0},{toMs:31*86400000+1},{cursor:'x'.repeat(2049)},{actorId:'../../private'}])
    assert.throws(()=>auditQuery({...valid,...patch}),{code:'INVALID_REQUEST'});
});

test('receipt retention includes the cutoff and never uses an untrusted source clock',()=>{
  const now=90*86400000,cutoff=now-30*86400000;
  assert.equal(retentionExpired(cutoff+1,now,30),false);
  assert.equal(retentionExpired(cutoff,now,30),true);
  assert.equal(retentionExpired(cutoff-1,now,30),true);
});

test('retention requires finite class-specific policy and explicit pseudonymization',()=>{
  const valid={class:'audit',revision:'policy-1',retainDays:90,identityMode:'pseudonymized',maxHoldDays:30};
  assert.deepEqual(retentionPolicy(valid),valid);
  for(const patch of [{class:'everything'},{retainDays:0},{retainDays:3651},{maxHoldDays:366},{identityMode:'raw'},{automaticDelete:true}])
    assert.throws(()=>retentionPolicy({...valid,...patch}),{code:'INVALID_REQUEST'});
});
