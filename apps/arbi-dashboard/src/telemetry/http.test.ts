import assert from 'node:assert/strict';
import test from 'node:test';
import { telemetryRoute } from './runtime';
test('unconfigured telemetry routes expose only a redacted unavailable response',async()=>{
  for(const action of ['current','history','inventory','device']) {
    const response=await telemetryRoute(new Request('https://synthetic.invalid',{method:action==='device'?'POST':'GET'}),{siteId:'synthetic',action});
    assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.deepEqual(Object.keys(await response.json()).sort(),['correlationId','error']);
  }
});
