import assert from 'node:assert/strict';
import test from 'node:test';
import { realtimeRoute } from './runtime';
test('unconfigured mounted realtime routes expose no identity or provider defaults',async () => {
  for (const action of ['attach','recover','device']) {
    const result=await realtimeRoute(new Request('https://synthetic.invalid',{method:'POST'}),{siteId:'synthetic-site',action});
    assert.equal(result.status,503);assert.equal(result.headers.get('cache-control'),'private, no-store');
    assert.deepEqual(Object.keys(await result.json()).sort(),['correlationId','error']);
  }
});
