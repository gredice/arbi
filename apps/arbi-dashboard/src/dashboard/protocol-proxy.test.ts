import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProtocolProxy,normalProtocolFault} from '../../scripts/protocol-proxy';
test('private protocol proxy restricts target, paths, fault input and bounded trace fields',async()=>{
  for(const target of ['https://127.0.0.1','http://example.invalid','http://127.0.0.1/other','http://user:password@127.0.0.1'])
    await assert.rejects(createProtocolProxy(target,'synthetic-controls','unused','unused'),/ISOLATED_LOOPBACK_REQUIRED/);
  const root=await mkdtemp(join(tmpdir(),'arbi-proxy-test-')),faultPath=join(root,'fault'),tracePath=join(root,'trace');
  let forwarded=0;const target=createServer((_request,response)=>{forwarded++;response.setHeader('content-type','application/json');response.end('{"durable":true}');});
  target.listen(0,'127.0.0.1');await once(target,'listening');
  let proxy:Awaited<ReturnType<typeof createProtocolProxy>>|undefined;
  try{
    await writeFile(faultPath,JSON.stringify(normalProtocolFault()),{mode:0o600});
    proxy=await createProtocolProxy(`http://127.0.0.1:${(target.address() as import('node:net').AddressInfo).port}`,'synthetic-controls',faultPath,tracePath);
    const path='/api/sites/synthetic-controls/dashboard-control/device',body=JSON.stringify({action:'snapshot',signature:'sensitive-proof',credentialId:'private-credential',payload:{protocol:'arbi/1.0',messageId:'test-1',kind:'event',sequence:'1',source:{deviceId:'edge',bootId:'boot',sessionId:'session',privateKey:'sensitive-key'},sourceTime:{utc:'2026-10-11T00:00:00Z',monotonicMs:1,uncertaintyMs:10}}});
    assert.equal((await fetch(`${proxy.origin}${path}`,{method:'POST',body})).status,200);assert.equal(forwarded,1);
    assert.equal((await fetch(`${proxy.origin}/api/sites/installed/dashboard-control/device`,{method:'POST',body})).status,404);assert.equal(forwarded,1);
    await writeFile(faultPath,JSON.stringify({...normalProtocolFault(),mode:'disconnect',untilMs:Date.now()+2000}));
    assert.equal((await fetch(`${proxy.origin}${path}`,{method:'POST',body})).status,503);assert.equal(forwarded,1);
    await writeFile(faultPath,'{}');assert.equal((await fetch(`${proxy.origin}${path}`,{method:'POST',body})).status,503);assert.equal(forwarded,1);
    const trace=await readFile(tracePath,'utf8');assert.doesNotMatch(trace,/signature|sensitive|credentialId|privateKey/);assert.ok(Buffer.byteLength(trace)<65536);
  }finally{await proxy?.close();await new Promise<void>(resolve=>target.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});
