import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { IsolatedUpdateProxy } from './proxy';
test('private loopback transport forwards the current bearer and bounds response bytes without exposing its gateway credential',async t=>{
  const credential=`Bearer ${'a'.repeat(43)}`,realm={environment:'test' as const,namespaceId:'synthetic-proxy'};let large=false,calls=0;
  const listener=createServer(async(req,res)=>{calls++;assert.equal(req.headers.authorization,'Bearer synthetic-user');assert.equal(req.headers.cookie,undefined);assert.equal(req.headers['x-arbi-update-gateway'],credential);assert.equal(req.url,'/sites/synthetic-site/updates/advance');let body='';for await(const c of req)body+=String(c);assert.deepEqual(JSON.parse(body),{operationId:'synthetic-operation'});res.writeHead(403,{'content-type':'application/json'}).end(large?'x'.repeat(262145):JSON.stringify({error:'CAPABILITY_DENIED'}));});
  await new Promise<void>(resolve=>listener.listen(0,'127.0.0.1',resolve));t.after(async()=>{listener.closeAllConnections();await new Promise<void>(resolve=>listener.close(()=>resolve()));});const address=listener.address();assert.ok(address&&typeof address==='object');
  const origin=`http://127.0.0.1:${address.port}`,proxy=new IsolatedUpdateProxy({realm,origin,credential});const request=()=>new Request('http://localhost/updates/advance',{method:'POST',headers:{authorization:'Bearer synthetic-user',cookie:'private-unused-cookie'},body:JSON.stringify({operationId:'synthetic-operation'})});
  const denied=await proxy.handle(request(),'synthetic-site','advance');assert.equal(denied.status,403);assert.deepEqual(await denied.json(),{error:'CAPABILITY_DENIED'});large=true;const bounded=await proxy.handle(request(),'synthetic-site','advance');assert.equal(bounded.status,503);assert.deepEqual(await bounded.json(),{error:'UNAVAILABLE'});assert.equal(calls,2);
  assert.throws(()=>new IsolatedUpdateProxy({realm:{...realm,environment:'production'},origin,credential}));assert.throws(()=>new IsolatedUpdateProxy({realm,origin:'http://example.com',credential}));
});
