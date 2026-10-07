import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import { AblyBroker } from './ably';
import type { Grant } from './contracts';

test('real Ably REST SDK serializes exact capability/client/TTL, publishes bounded hints and revokes without reauth margin',async (t) => {
  const requests: { path: string; body: any }[]=[];
  const server=createServer(async (request,response) => {
    const buffers: Buffer[]=[];for await(const b of request) buffers.push(b);
    const body=JSON.parse(Buffer.concat(buffers).toString());const path=request.url!.split('?')[0];requests.push({path,body});
    response.setHeader('content-type','application/json');
    if(path.endsWith('/requestToken')) {
      const canonical=[body.keyName,body.ttl,body.capability,body.clientId,body.timestamp,body.nonce].join('\n')+'\n';
      assert.equal(body.mac,createHmac('sha256','synthetic-secret').update(canonical).digest('base64'));
      response.end(JSON.stringify({token:'isolated-no-provider-authority',issued:Date.now(),expires:Date.now()+body.ttl,
        capability:body.capability,clientId:body.clientId}));
    } else if(path.endsWith('/revokeTokens')) {
      response.end(JSON.stringify({successCount:1,failureCount:0,results:[{target:body.targets[0],appliesAt:Date.now(),issuedBefore:Date.now()}]}));
    } else response.end('{}');
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address && typeof address==='object');
  t.after(async () => {server.closeAllConnections();await new Promise<void>((r) => server.close(() => r()));});
  const broker=new AblyBroker('fixture.key:synthetic-secret',true,['fixture.old:synthetic-secret'],{endpoint:'127.0.0.1',port:address.port,tls:false,fallbackHosts:[]});
  const grant={id:'grant-1',realm:{environment:'test',namespaceId:'realm-a'},siteId:'site-a',channel:'arbi:test:realm-a:site-a:state:client-a',clientId:'client-a',expiresAtMs:Date.now()+30000} as Grant;
  const token=await broker.issue(grant,1000);
  assert.equal(token.clientId,grant.clientId);assert.deepEqual(JSON.parse(token.capability),{[grant.channel]:['subscribe']});
  assert.equal(requests[0].body.ttl,1000);
  await broker.publish(grant.channel,{version:'arbi.realtime/1.0',realm:grant.realm,siteId:grant.siteId,epoch:'epoch-a',cursor:'2'});
  assert.equal(requests[1].path,`/channels/${encodeURIComponent(grant.channel)}/messages`);
  assert.equal(requests[1].body[0].name,'changed');assert.equal(JSON.parse(requests[1].body[0].data).cursor,'2');
  await broker.revoke(grant.clientId);
  assert.deepEqual(requests.slice(-2).map((r) => r.path),['/keys/fixture.key/revokeTokens','/keys/fixture.old/revokeTokens']);
  for(const request of requests.slice(-2)) assert.deepEqual(request.body,{targets:['clientId:client-a'],allowReauthMargin:false});
  await assert.rejects(broker.issue(grant,30001),{code:'EXPIRED'});
});
