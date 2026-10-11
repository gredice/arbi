import assert from 'node:assert/strict';
import { globSync,readFileSync,statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('audit coverage inventory accounts for every HTTP route and binds actions to executable evidence and observability limits',()=>{
  const root=new URL('../../../../',import.meta.url);
  const manifest=JSON.parse(readFileSync(new URL('docs/software/audit-coverage.json',root),'utf8'));
  assert.equal(manifest.schemaVersion,'arbi.audit-coverage/1.0');
  const routes=globSync('apps/arbi-dashboard/src/app/api/**/route.ts',{cwd:fileURLToPath(root)}).sort();
  assert.deepEqual(manifest.http.map((x:{entrypoint:string})=>x.entrypoint).sort(),routes);
  const entries=[...manifest.http,...manifest.internal];
  assert.equal(new Set(entries.map(x=>x.entrypoint)).size,entries.length);
  for(const entry of entries){
    assert.ok(statSync(new URL(entry.entrypoint,root)).isFile());
    for(const field of ['actions','requiredFacts','evidence']){
      assert.ok(entry[field].length>0);assert.equal(new Set(entry[field]).size,entry[field].length);
      assert.ok(entry[field].every((x:unknown)=>typeof x==='string'&&x.length>0));
    }
    assert.ok(typeof entry.observability==='string'&&entry.observability.length>20);
    for(const evidence of entry.evidence){
      assert.match(evidence,/\.test\.ts$/);assert.match(readFileSync(new URL(evidence,root),'utf8'),/test\(/);
    }
  }
});
