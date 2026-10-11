import assert from 'node:assert/strict';
import test from 'node:test';
import { configureUpdates,updatesRoute } from './runtime';
test('update BFF is unavailable by default, forwards the private bearer to its trusted gateway, and excludes branch previews',async()=>{
  const old=process.env.VERCEL_ENV,oldTarget=process.env.VERCEL_TARGET_ENV;delete process.env.VERCEL_ENV;delete process.env.VERCEL_TARGET_ENV;
  const request=new Request('http://localhost/api/sites/synthetic-site/updates/advance',{method:'POST',headers:{cookie:'arbi_dashboard_session=synthetic-credential',origin:'http://localhost','x-arbi-request':'1'},body:JSON.stringify({operationId:'synthetic-operation'})});
  try{assert.equal((await updatesRoute(request.clone(),{siteId:'synthetic-site',action:'advance'})).status,503);let calls=0;
    configureUpdates({handle:async(r,siteId,action)=>{calls++;assert.equal(r.headers.get('authorization'),'Bearer synthetic-credential');assert.equal(siteId,'synthetic-site');assert.equal(action,'advance');assert.deepEqual(await r.json(),{operationId:'synthetic-operation'});return Response.json({error:'CAPABILITY_DENIED'},{status:403});}});
    assert.equal((await updatesRoute(request.clone(),{siteId:'synthetic-site',action:'advance'})).status,403);assert.equal(calls,1);
    process.env.VERCEL_ENV='preview';assert.equal((await updatesRoute(request.clone(),{siteId:'synthetic-site',action:'advance'})).status,503);assert.equal(calls,1);
  }finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old;if(oldTarget===undefined)delete process.env.VERCEL_TARGET_ENV;else process.env.VERCEL_TARGET_ENV=oldTarget;}
});
