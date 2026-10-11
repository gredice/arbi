import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Realm } from '@arbi/protocol';
import { isRealm } from '@arbi/gredice';
import type { SqlSession } from '../enrollment/store';
import { OperationsError, OPERATIONS_VERSION } from './contracts';
const MAX_BYTES=16*1024*1024;
interface Target{socket:string;database:string;realm:Realm}
function isolated(input:Target){
  try{const socket=realpathSync(input.socket),base=realpathSync(process.platform==='darwin'?'/private/tmp':tmpdir()),info=lstatSync(socket);
    if(!socket.startsWith(`${base}/arbi-enrollment-pg-`)||info.isSymbolicLink()||info.uid!==process.getuid?.()||(info.mode&0o077)!==0||!/^arbi_[a-z0-9_]{1,80}$/.test(input.database)||!isRealm(input.realm)||input.realm.environment!=='test')throw Error();
    return socket;
  }catch{throw new OperationsError('DENIED');}
}
function command(name:string,args:string[],input:Target){
  const socket=isolated(input),env={...process.env};for(const name of Object.keys(env))if(name.startsWith('PG'))delete env[name];env.PGPASSFILE='/dev/null';try{
    const bin=execFileSync('pg_config',['--bindir'],{encoding:'utf8',timeout:5000,maxBuffer:1024}).trim();
    return execFileSync(join(bin,name),['--host',socket,'--port','54321','--username','arbi_test','--dbname',input.database,...args],
      {timeout:10000,maxBuffer:MAX_BYTES,stdio:['ignore','pipe','pipe'],env});
  }catch{throw new OperationsError('UNAVAILABLE');}
}
export async function isolatedDatabaseDigest(sql:SqlSession,realm:Realm){
  const foreign=Number((await sql.query<{n:string}>('SELECT count(*)::text n FROM arbi_device_registry WHERE environment<>$1 OR namespace_id<>$2',[realm.environment,realm.namespaceId])).rows[0].n);
  if(foreign)throw new OperationsError('DENIED');
  const tables:Record<string,{rows:string;digest:string}>={};
  // Hash rows in PostgreSQL, never publish private snapshots or command bodies.
  for(const table of ['arbi_operations_gate','arbi_device_registry','arbi_command_jobs','arbi_job_reports','arbi_control_leases','arbi_audit_events','arbi_audit_heads','arbi_audit_outbox','arbi_usage_windows','arbi_usage_settings','arbi_media_images','arbi_realtime_sites','arbi_telemetry_history','arbi_live_producers','arbi_live_viewers','arbi_live_reports']){
    if(table.startsWith('arbi_live_')&&!(await sql.query<{present:boolean}>("SELECT to_regclass($1) IS NOT NULL present",[table])).rows[0].present)continue;
    const result=(await sql.query<{n:string;hash:string}>(`SELECT count(*)::text n,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) hash FROM ${table} t`)).rows[0];
    tables[table]={rows:result.n,digest:result.hash};
  }
  return tables;
}
/** Test/operator drill only: owned socket-only cluster, private archive, no network targets. */
export async function dumpIsolatedDatabase(input:Target,sql:SqlSession,privateDirectory:string,releaseCatalogDigest:string){
  isolated(input);if(!/^[a-f0-9]{64}$/.test(releaseCatalogDigest))throw new OperationsError('DENIED');
  const parent=realpathSync(privateDirectory),info=lstatSync(parent);if(info.uid!==process.getuid?.()||info.mode&0o077||info.isSymbolicLink())throw new OperationsError('DENIED');
  const gate=(await sql.query<{state:string}>('SELECT state FROM public.arbi_operations_gate WHERE singleton=true')).rows[0];
  if(gate?.state!=='quarantined')throw new OperationsError('DENIED');
  const reference=await isolatedDatabaseDigest(sql,input.realm),bytes=command('pg_dump',['--format=custom','--no-owner','--no-privileges'],input);
  if(bytes.length>MAX_BYTES)throw new OperationsError('CAPACITY');
  const archive=join(parent,`${randomUUID()}.dump`);writeFileSync(archive,bytes,{mode:0o600,flag:'wx'});chmodSync(archive,0o600);
  const manifest={version:OPERATIONS_VERSION,realm:input.realm,sourceDatabase:input.database,archiveDigest:createHash('sha256').update(bytes).digest('hex'),archiveBytes:bytes.length,
    atMs:Date.now(),reference,releaseCatalogDigest,limits:{maxArchiveBytes:MAX_BYTES,objectBytes:'not included',externalDirectory:'not included',applicationState:'snapshot; quarantine before exposure'}};
  const manifestPath=archive+'.json';writeFileSync(manifestPath,JSON.stringify(manifest),{mode:0o600,flag:'wx'});return {archive,manifestPath,manifest};
}
export async function restoreIsolatedDatabase(input:Target,sql:SqlSession,backup:Awaited<ReturnType<typeof dumpIsolatedDatabase>>){
  isolated(input);if(input.database===backup.manifest.sourceDatabase||JSON.stringify(input.realm)!==JSON.stringify(backup.manifest.realm))throw new OperationsError('DENIED');
  const info=lstatSync(backup.archive);if(info.isSymbolicLink()||info.uid!==process.getuid?.()||info.mode&0o077||info.size>MAX_BYTES)throw new OperationsError('DENIED');
  if(createHash('sha256').update(readFileSync(backup.archive)).digest('hex')!==backup.manifest.archiveDigest)throw new OperationsError('TAMPER');
  if(Number((await sql.query<{n:string}>("SELECT count(*)::text n FROM information_schema.tables WHERE table_schema='public'")).rows[0].n))throw new OperationsError('DENIED');
  command('pg_restore',['--no-owner','--no-privileges','--exit-on-error','--single-transaction',backup.archive],input);
  // Dumps omit deployment ACLs. Reapply the additive owner migrations to
  // restore closed PUBLIC privileges before any application role is granted.
  for(const file of ['0001-enrollment','0002-media','0003-audit','0004-jobs','0005-realtime','0006-telemetry','0006-dashboard','0007-usage','0008-audit-lifecycle','0009-usage-settings','0010-operations','0011-live'])
    await sql.query(await readFile(new URL(`../../migrations/${file}.sql`,import.meta.url),'utf8'));
  const restored=await isolatedDatabaseDigest(sql,input.realm);
  for(const [table,reference] of Object.entries(backup.manifest.reference))if(JSON.stringify(restored[table])!==JSON.stringify(reference))throw new OperationsError('TAMPER');
  for(const [table,reference] of Object.entries(restored))if(!Object.hasOwn(backup.manifest.reference,table)&&reference.rows!=='0')throw new OperationsError('TAMPER');
  return {state:'verified-offline',restored,archiveDigest:backup.manifest.archiveDigest,releaseCatalogDigest:backup.manifest.releaseCatalogDigest};
}
