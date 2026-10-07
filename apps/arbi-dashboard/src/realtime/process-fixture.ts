import { createServer } from 'node:http';
import { once } from 'node:events';
import pg from 'pg';
import { createIsolatedIdentityProvider } from '@arbi/gredice/testing';
import { postgresDatabase } from '../enrollment/store';
import { createRealtimeServer } from './server';
import { PostgresJobStore } from '../jobs/store';
import { fixture,realm } from './test-support';
// Explicit IPC-only isolated test server. No deployment entrypoint installs it.
if(!process.send || !process.env.ARBI_ENROLLMENT_TEST_SOCKET) throw new Error('FIXTURE_ONLY');
const pool=new pg.Pool({host:process.env.ARBI_ENROLLMENT_TEST_SOCKET,user:'arbi_test',port:54321,database:'arbi_realtime_test',max:2});
const provider=createIsolatedIdentityProvider(realm);
const broker=(await fixture()).broker;
const db=postgresDatabase(pool),jobs=new PostgresJobStore(db,realm,async () => null);
let runtime: ReturnType<typeof createRealtimeServer>;
const server=createServer(async (request,response) => {
  try {
    const parts: Buffer[]=[];let size=0;
    for await(const part of request) {size+=part.length;if(size>16384) throw new Error();parts.push(part);}
    const url=new URL(request.url!,'http://127.0.0.1');const match=url.pathname.match(/^\/api\/sites\/([^/]+)\/(realtime|jobs)\/device$/);if(!match) throw new Error();
    const input=JSON.parse(Buffer.concat(parts).toString());
    const result=match[2]==='jobs' ? Response.json(await jobs.device(match[1],input)) :
      await runtime.handle(new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}),{siteId:match[1],action:'device'});
    response.writeHead(result.status,{'content-type':'application/json'}).end(Buffer.from(await result.arrayBuffer()));
  } catch {response.writeHead(503).end('{}');}
});
process.once('message',async (message: {siteId:string}) => {
  const registry=(await pool.query('SELECT state FROM arbi_device_registry WHERE site_id=$1',[message.siteId])).rows[0].state;
  provider.putSite(message.siteId,registry.accountId);
  runtime=createRealtimeServer({db,realm,identity:provider.adapter,resolveSite:provider.resolveResource,currentAuthority:async () => null,browserOrigins:[],broker});
  server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();if(!address || typeof address==='string') throw new Error();
  process.send!({origin:`http://127.0.0.1:${address.port}`});
});
async function close() {server.closeAllConnections();server.close();await pool.end();process.exit();}
process.once('SIGTERM',() => {void close();});
