import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {runLocalFaultWorkflows} from './workflows.js';
test('seeded actual local-service fault workflows retain replayable semantic traces, original audit attribution and essential traffic', {timeout:30000},async t=>{
  const run=async(seed:number)=>{const directory=mkdtempSync('/tmp/arbi-fault-workflows-');t.after(()=>rmSync(directory,{recursive:true,force:true}));return runLocalFaultWorkflows(directory,seed);};
  const first=await run(77),second=await run(77);assert.deepEqual(first,second);assert.equal(first.length,12);
  mkdirSync('fault-results',{recursive:true});writeFileSync('fault-results/local-workflows.json',JSON.stringify(first,null,2)+'\n',{mode:0o600});
  const other=await run(78);assert.notDeepEqual(first.slice(0,8).map(t=>t.injectedAtMs),other.slice(0,8).map(t=>t.injectedAtMs));
  assert.ok(first.every(t=>t.physicalAcceptance===false&&t.semanticDigest.length===64&&t.trace.length>0));
  assert.doesNotMatch(JSON.stringify(first),/Bearer|privateKey|credentialId|127\.0\.0\.1|authorizationId/);
  t.diagnostic(JSON.stringify(first.map(({id,seed,injectedAtMs,observed,semanticDigest})=>({id,seed,injectedAtMs,observed,semanticDigest}))));
  await assert.rejects(run(-1),/INVALID_SEED/);
});
