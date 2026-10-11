import assert from 'node:assert/strict';
import test from 'node:test';
import { webDeploymentIdentity } from './web-identity';
test('web build identity comes only from the independent compiled manifest and rejects unknown revisions',()=>{
  const old=process.env.ARBI_WEB_BUILD_IDENTITY;try{delete process.env.ARBI_WEB_BUILD_IDENTITY;assert.equal(webDeploymentIdentity().revision,null);
    const value={revision:'a'.repeat(40),dirty:true,builtAt:'2026-10-11T00:00:00.000Z',environment:'preview',provenance:'web-build-manifest'};process.env.ARBI_WEB_BUILD_IDENTITY=JSON.stringify(value);assert.deepEqual(webDeploymentIdentity(),value);
    process.env.ARBI_WEB_BUILD_IDENTITY=JSON.stringify({...value,revision:'device-version'});assert.equal(webDeploymentIdentity().revision,null);
  }finally{if(old===undefined)delete process.env.ARBI_WEB_BUILD_IDENTITY;else process.env.ARBI_WEB_BUILD_IDENTITY=old;}
});
