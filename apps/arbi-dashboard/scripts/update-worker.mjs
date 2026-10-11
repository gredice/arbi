import { createServer } from 'node:http';
import { mkdtemp,realpath,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { createDashboardTestProvider } from '../src/dashboard/test-provider';
import { postgresDatabase } from '../src/enrollment/store';
import { createUpdateReference } from '../../arbi-edge-controller/dist/updates/reference.js';
import { UpdateServer } from '../../arbi-edge-controller/dist/updates/server.js';
// Owned private harness only, never imported by the dashboard application or selected by a public request.
const connection=process.env.ARBI_DASHBOARD_TEST_DATABASE_URL,origin=process.env.ARBI_DASHBOARD_ORIGIN,gatewayOrigin=process.env.ARBI_DASHBOARD_UPDATE_ORIGIN,gatewayCredential=process.env.ARBI_DASHBOARD_UPDATE_CREDENTIAL;
if(!connection||!origin||!gatewayOrigin||!gatewayCredential||process.env.ARBI_DASHBOARD_PROVIDER!=='isolated-test-simulation'||process.env.ARBI_DASHBOARD_REALM!=='test'||!process.env.ARBI_DASHBOARD_TEST_UPDATE_CODE||process.env.VERCEL)throw Error('ISOLATED_FIXTURE_REQUIRED');
const url=new URL(connection),socket=url.searchParams.get('host'),gatewayURL=new URL(gatewayOrigin);
if(url.hostname!=='localhost'||!socket||!(await realpath(socket)).startsWith(`${await realpath(tmpdir())}/arbi-shell-pg-`)||new URL(origin).hostname!=='127.0.0.1'||gatewayURL.protocol!=='http:'||gatewayURL.hostname!=='127.0.0.1'||!/^Bearer [A-Za-z0-9_-]{43}$/.test(gatewayCredential))throw Error('ISOLATED_SOCKET_REQUIRED');
const faultPath=process.env.ARBI_UPDATE_FAULT_PATH;if(faultPath!==join(socket,'update-fault.json'))throw Error('OWNED_FIXTURE_REQUIRED');
const directory=await mkdtemp(join(tmpdir(),'arbi-update-browser-')),realm={environment:'test'         ,namespaceId:process.env.ARBI_DASHBOARD_NAMESPACE };
const pool=new pg.Pool({connectionString:connection,max:2});
const provider=createDashboardTestProvider({db:postgresDatabase(pool),realm,verificationKey:Buffer.from(process.env.ARBI_DASHBOARD_TEST_SIGNING_KEY ,'base64url'),accessCode:process.env.ARBI_DASHBOARD_TEST_ACCESS_CODE ,updateCode:process.env.ARBI_DASHBOARD_TEST_UPDATE_CODE,browserOrigins:[origin]});
const fixture=await createUpdateReference(directory,{realm,initialUtcMs:Date.now(),allowanceBytes:70000});fixture.roles('synthetic-updater',['update-admin','engineer']);
const server=new UpdateServer({identity:provider.identity,resolveResource:provider.resolveResource,browserOrigins:[origin]},fixture.orchestrator);let revision='';
const manifests=structuredClone(fixture.composition.sets);
const listener=createServer(async(req,res)=>{try{
  if(req.headers['x-arbi-update-gateway']!==gatewayCredential){res.writeHead(403).end();return;}
  const match=req.url?.match(/^\/sites\/([A-Za-z0-9._:-]+)\/updates\/([a-z]+)(\?.*)?$/);if(!match){res.writeHead(404).end();return;}
  const fault=JSON.parse(await readFile(faultPath,'utf8'))                                                ;
  if(fault.version!=='arbi.update-browser-fault/1.0'||!['normal','interrupt-once','canary-failed','active-motion','unavailable','signature-invalid'].includes(fault.mode)||typeof fault.revision!=='string')throw Error('INVALID_FAULT');
  if(fault.mode==='unavailable'){res.writeHead(503,{'content-type':'application/json'}).end(JSON.stringify({error:'UNAVAILABLE'}));return;}
  if(fault.revision!==revision){revision=fault.revision;fixture.sourceMode(fault.mode==='interrupt-once'?'interrupt-once':'complete');fixture.health('pico',fault.mode==='canary-failed'?'failed':'passed');fixture.safety({activeMotion:fault.mode==='active-motion'});fixture.composition.sets=structuredClone(manifests);
    if(fault.mode==='signature-invalid')fixture.composition.sets[0] .manifests.find(m=>m.releaseId==='pico-1.1.0') .artifact.signature.value='0'.repeat(128);
  }
  fixture.advanceClock(Math.max(0,Date.now()-fixture.now()));
  const chunks         =[];let size=0;for await(const c of req){size+=c.length;if(size>4096)throw Error('CAPACITY');chunks.push(c);}const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(typeof value==='string'&&!['cookie','host','x-arbi-update-gateway'].includes(key))headers.set(key,value);
  const request=new Request(`${origin}${req.url}`,{method:req.method,headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
  const response=await server.handle(request,match[1] ,match[2] );res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
}catch{res.writeHead(503,{'content-type':'application/json','cache-control':'private, no-store'}).end(JSON.stringify({error:'UNAVAILABLE'}));}});
listener.requestTimeout=8000;listener.headersTimeout=8000;
try{await new Promise      (resolve=>listener.listen(Number(gatewayURL.port),'127.0.0.1',resolve));process.stdout.write('UPDATES_READY\n');await new Promise      (resolve=>process.once('SIGTERM',resolve));}
catch{process.stderr.write('ISOLATED_UPDATES_FAILED\n');process.exitCode=1;}
finally{listener.closeAllConnections();await new Promise      (resolve=>listener.close(()=>resolve()));await fixture.close();await pool.end();await rm(directory,{recursive:true,force:true});}
