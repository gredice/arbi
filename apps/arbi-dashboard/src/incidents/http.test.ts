import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createIsolatedIdentityProvider } from '@arbi/gredice/testing';
import { incidentDigest,parseIncident } from '@arbi/simulation-core';
import { IncidentHttp } from './http';
import { configureIncidents,incidentRoute } from './runtime';

test('incident boundary denies ordinary/preview composition, unauthorized export and scope/retention changes; replay has no actuator method',async()=>{
  const b=parseIncident(readFileSync(new URL('../../../../packages/arbi-simulation-core/fixtures/incidents/synthetic-fault.json',import.meta.url),'utf8'));
  assert.equal((await incidentRoute(new Request('https://synthetic.test'),{siteId:b.siteId,action:'read'})).status,503);
  const identity=createIsolatedIdentityProvider(b.realm);identity.putSite(b.siteId,'synthetic-account');identity.putResource('audit-export',b.id,b.siteId);
  const principal=(id:string,roles:('engineer'|'viewer')[])=>({actor:{kind:'human' as const,id},accountId:'synthetic-account',member:true,
    sites:{[b.siteId]:{roles,serviceScopes:[],active:true,revision:'membership-1'}}});
  identity.putPrincipal(principal('engineer',['engineer']));identity.putPrincipal(principal('viewer',['viewer']));
  const engineer=await identity.issue({kind:'human',id:'engineer'}),viewer=await identity.issue({kind:'human',id:'viewer'});
  let reads=0,audits=0,stored=b,auditAvailable=true;let onRead:(()=>void)|undefined;
  const server=new IncidentHttp({realm:b.realm,identity:identity.adapter,resolveResource:identity.resolveResource,
    auditAuthorization:async()=>{audits++;return auditAvailable;},browserOrigins:['https://synthetic.test'],privateRedactionSalt:'b'.repeat(64),
    load:async()=>{reads++;onRead?.();return stored;}});
  const request=(action:string,token=engineer.token)=>new Request(`https://synthetic.test/incidents/${action}?bundleId=${b.id}`,{method:action==='export'?'POST':'GET',headers:{authorization:`Bearer ${token}`,origin:'https://synthetic.test','x-arbi-request':'1'}});
  const params=(action:string)=>({siteId:b.siteId,action});
  let response=await server.handle(request('read'),params('read'));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal((await response.json()).digest,b.digest);assert.ok(audits>=1);
  response=await server.handle(request('export'),params('export'));assert.equal(response.status,200);assert.equal((await response.json()).schemaVersion,'arbi.incident-export/1.0');
  const before=reads;assert.equal((await server.handle(request('export',viewer.token),params('export'))).status,403);assert.equal(reads,before);
  assert.equal((await server.handle(request('read'),{siteId:'foreign-site',action:'read'})).status,403);
  stored=structuredClone(b);stored.siteId='foreign-site';const {digest:_,...payload}=stored;stored.digest=incidentDigest(payload);
  // The bundle's records retain the old site; a corrupt or foreign bundle cannot be exposed.
  assert.equal((await server.handle(request('read'),params('read'))).status,503);
  stored=structuredClone(b);stored.data.createdAtUtc='1999-01-01T00:00:00.000Z';stored.data.retentionUntilUtc='2000-01-01T00:00:00.000Z';const {digest:__,...expired}=stored;stored.digest=incidentDigest(expired);
  assert.equal((await server.handle(request('read'),params('read'))).status,403);
  stored=structuredClone(b);stored.data.origin='bench-recording';const {digest:___,...longRetention}=stored;stored.digest=incidentDigest(longRetention);
  assert.equal((await server.handle(request('read'),params('read'))).status,403);
  stored=b;auditAvailable=false;const noAuditReads=reads;
  assert.equal((await server.handle(request('read'),params('read'))).status,503);assert.equal(reads,noAuditReads);auditAvailable=true;
  onRead=()=>identity.revoke(engineer.sessionId);
  assert.equal((await server.handle(request('read'),params('read'))).status,401);onRead=undefined;
  assert.equal((await server.handle(request('read'),params('read'))).status,401);
  assert.equal((await server.handle(new Request(request('read'),{method:'POST'}),params('read'))).status,400);
  let productionCalls=0;configureIncidents({handle:async()=>{productionCalls++;throw Error('FORBIDDEN');}} as unknown as IncidentHttp);
  const previous=process.env.VERCEL_ENV,target=process.env.VERCEL_TARGET_ENV;process.env.VERCEL_ENV='preview';delete process.env.VERCEL_TARGET_ENV;
  try{assert.equal((await incidentRoute(request('read'),params('read'))).status,503);assert.equal(productionCalls,0);}
  finally{if(previous===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=previous;if(target===undefined)delete process.env.VERCEL_TARGET_ENV;else process.env.VERCEL_TARGET_ENV=target;}
});
