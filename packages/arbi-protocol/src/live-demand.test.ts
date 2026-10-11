import assert from 'node:assert/strict';
import test from 'node:test';
import {validateLiveProducerDemand,type LiveProducerDemand} from './live-demand.js';
const demand:LiveProducerDemand={version:'arbi.live/1.0',realm:{environment:'test',namespaceId:'live-contract-reference'},siteId:'synthetic-site',id:'producer-1',generation:'18446744073709551615',target:{deviceId:'edge',bootId:'boot-1',sessionId:'source-1'},configRevision:'config-1',profile:{id:'low',transport:'isolated-signaling',maxUpstreamBps:96000,maxDownstreamBps:200000,maxViewers:4},viewers:4,issuedAtMs:1000,expiresAtMs:16000,sharedUpstream:true};
test('existing bounded private demand supports an exact u64 fence without enabling production transport',()=>{
  validateLiveProducerDemand(demand);for(const change of [{generation:'18446744073709551616'},{generation:'01'},{generation:'0'},{viewers:5},{issuedAtMs:1000,expiresAtMs:16001},{sharedUpstream:false},{realm:{environment:'production',namespaceId:'live-contract-reference'}},{profile:{...demand.profile,transport:'unselected-production-transport'}}])assert.throws(()=>validateLiveProducerDemand({...demand,...change} as LiveProducerDemand));
  assert.throws(()=>validateLiveProducerDemand({...demand,credential:'not-a-demand-field'} as LiveProducerDemand));
});
