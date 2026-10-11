import assert from 'node:assert/strict';
import test from 'node:test';
import {SimulatedLiveAdapter} from './simulated-adapter';
import {policy,liveSignal,type ProducerDemand,type LiveProfile} from './contracts';
import {liveRoute} from './runtime';
const p:LiveProfile={id:'low-test',transport:'isolated-signaling',maxUpstreamBps:200000,maxDownstreamBps:400000,maxViewers:2};
test('isolated producer independently expires leases, fences old generations and deduplicates bounded signaling',async()=>{
  const adapter=new SimulatedLiveAdapter();try{const now=Date.now(),d:ProducerDemand={version:'arbi.live/1.0',realm:{environment:'test',namespaceId:'isolated-live'},siteId:'site',id:'producer',generation:'1',target:{deviceId:'pod',bootId:'boot',sessionId:'link'},configRevision:'config',profile:p,viewers:2,issuedAtMs:now,expiresAtMs:now+350,sharedUpstream:true};
    await adapter.apply(d,new AbortController().signal);assert.equal(adapter.status.producers.length,1);
    const query={demand:d,viewerId:'viewer',epoch:1,sequence:1,expiresAtMs:d.expiresAtMs,message:{type:'offer' as const,data:'isolated-offer'}};
    assert.deepEqual(await adapter.signal(query,new AbortController().signal),await adapter.signal(query,new AbortController().signal));
    await assert.rejects(adapter.signal({...query,message:{...query.message,data:'different'}},new AbortController().signal),{code:'CONFLICT'});
    await new Promise(resolve=>setTimeout(resolve,360));assert.equal(adapter.status.producers.length,0);
    assert.equal((await adapter.apply(d,new AbortController().signal)).state,'stopped');assert.equal(adapter.status.producers.length,0);
    const stopped={...d,generation:'2',viewers:0,issuedAtMs:Date.now(),expiresAtMs:Date.now()};await adapter.apply(stopped,new AbortController().signal);
    await assert.rejects(adapter.apply(d,new AbortController().signal),{code:'STALE_FENCE'});
    await assert.rejects(adapter.apply({...stopped,realm:{...d.realm,environment:'production'}},new AbortController().signal),{code:'DENIED'});
  }finally{adapter.close();}
});
test('unknown bandwidth and oversized signaling cannot grant an isolated media path; default runtime has no fixture',async()=>{
  assert.throws(()=>policy({allow:true,reason:'within-budget',revision:'policy',layer:'unknown',remainingBytes:'100',maxUpstreamBps:200000}),{code:'INVALID_REQUEST'});
  assert.throws(()=>liveSignal({type:'offer',data:'x'.repeat(4097)}),{code:'INVALID_REQUEST'});
  const response=await liveRoute(new Request('https://synthetic.test/api/sites/site/live/start',{method:'POST',body:'{}'}),{siteId:'site',action:'start'});
  assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.doesNotMatch(JSON.stringify(await response.json()),/tokenKey|credentialId|database|fixture/);
});
