import {generateKeyPairSync,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import type {Registry} from '../src/enrollment/contracts';
// Private harness only. This process is never imported by the dashboard application.
const connectionString=process.env.ARBI_DASHBOARD_TEST_DATABASE_URL,origin=process.env.ARBI_DASHBOARD_ORIGIN;
if(!connectionString||!origin||process.env.ARBI_DASHBOARD_PROVIDER!=='isolated-test-simulation'||process.env.ARBI_DASHBOARD_REALM!=='test'||!process.env.ARBI_DASHBOARD_TEST_OPERATOR_CODE||process.env.VERCEL)throw Error('ISOLATED_FIXTURE_REQUIRED');
const url=new URL(connectionString),socket=url.searchParams.get('host');
if(url.hostname!=='localhost'||!socket||!(await realpath(socket)).startsWith(`${await realpath(tmpdir())}/arbi-shell-pg-`)||new URL(origin).hostname!=='127.0.0.1')throw Error('ISOLATED_SOCKET_REQUIRED');
const directory=await mkdtemp(join(tmpdir(),'arbi-playground-')),realm={environment:'test' as const,namespaceId:process.env.ARBI_DASHBOARD_NAMESPACE!},siteId='synthetic-controls';
const identity={deviceId:'edge',bootId:randomUUID(),sessionId:randomUUID()},credentialId=randomUUID(),keys=generateKeyPairSync('ed25519');
const pool=new pg.Pool({connectionString,max:1});
let worker:ReturnType<typeof spawn>|undefined;
try{
  await pool.query('BEGIN');
  const row=(await pool.query<{state:Registry}>('SELECT state FROM arbi_device_registry WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 FOR UPDATE',[realm.environment,realm.namespaceId,siteId])).rows[0];
  if(!row||row.state.devices.length)throw Error('DEDICATED_EMPTY_FIXTURE_REQUIRED');
  const now=Date.now();row.state.devices.push({id:'edge',componentId:'edge',role:'edge',status:'active',parentDeviceId:null,replacesDeviceId:null,enrolledAtMs:now,revokedAtMs:null,current:identity,
    retiredIdentities:[],lastSeenAtMs:now,softwareRevision:'synthetic-playground',appliedConfigRevision:'config-1',capabilities:[],credentials:[{id:credentialId,
      publicKey:keys.publicKey.export({type:'spki',format:'der'}).toString('base64url'),createdAtMs:now,expiresAtMs:now+900000,revokedAtMs:null,lastSequence:0}]});
  await pool.query('UPDATE arbi_device_registry SET state=$4::jsonb WHERE environment=$1 AND namespace_id=$2 AND site_id=$3',[realm.environment,realm.namespaceId,siteId,JSON.stringify(row.state)]);await pool.query('COMMIT');
  worker=spawn(process.execPath,['scripts/playground-fixture-consumer.mjs'],{cwd:new URL('../../arbi-edge-controller/',import.meta.url),stdio:['ignore','ignore','ignore','ipc']});
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('CONTROLLER_TIMEOUT')),10000);worker!.once('exit',()=>reject(Error('CONTROLLER_EXIT')));
    worker!.once('message',(message:unknown)=>{clearTimeout(timer);const value=message as {ready?:boolean;phase?:string};if(value.ready)resolve();else {
      if(value.phase&&/^(composition|scope|network|(?:snapshot|poll|outcome)-[0-9]{3})$/.test(value.phase))process.stderr.write(`ISOLATED_PLAYGROUND_FAILED ${value.phase}\n`);
      reject(Error('CONTROLLER_UNAVAILABLE'));}});
    worker!.send!({realm,siteId,identity,credentialId,directory,origin,key:keys.privateKey.export({type:'pkcs8',format:'pem'})});});
  process.stdout.write('PLAYGROUND_READY\n');
  await new Promise<void>(resolve=>{process.once('SIGTERM',()=>resolve());worker!.once('exit',()=>resolve());});
}catch{process.stderr.write('ISOLATED_PLAYGROUND_FAILED\n');process.exitCode=1;}
finally{if(worker&&worker.exitCode===null){worker.send?.('stop');await new Promise<void>(resolve=>{const timer=setTimeout(()=>{worker!.kill('SIGTERM');resolve();},1500);worker!.once('exit',()=>{clearTimeout(timer);resolve();});});}
  await pool.end();await rm(directory,{recursive:true,force:true});}
