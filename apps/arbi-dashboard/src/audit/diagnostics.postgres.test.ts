import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import pg from 'pg';
import type { AuditEvent } from '@arbi/protocol';
import { postgresDatabase } from '../enrollment/store';
import { createAuditServer } from './server';
import { PostgresAuditStore } from './store';
import { authorization, binding, deviceEvent, intent, inventory, now } from './test-support';

const socket=process.env.ARBI_ENROLLMENT_TEST_SOCKET;
test('native PostgreSQL diagnostic reconnect: durable preflight, original old-boot evidence, lost receipt and deduplicated replay',{skip:!socket,timeout:15000},async t=>{
  // The native CI stage builds this independent consumer; ordinary tests do not require generated edge files.
  const [{DiagnosticStore},{DiagnosticPipeline},{DiagnosticUplink},{JobAuditRelay},{TransferBudget}]=await Promise.all(
    ['diagnostics/store','diagnostics/pipeline','diagnostics/uplink','jobs/audit-relay','transfers/budget'].map(path=>import(new URL(`../../../arbi-edge-controller/dist/${path}.js`,import.meta.url).href)));
  const root=realpathSync(socket!);assert.ok(root.startsWith(`${realpathSync(process.platform==='darwin'?'/private/tmp':tmpdir())}/arbi-enrollment-pg-`));
  const config={host:root,user:'arbi_test',port:54321,database:'arbi_diagnostic_replay_test',max:2};
  const admin=new pg.Pool({...config,database:'postgres',max:1});await admin.query('CREATE DATABASE arbi_diagnostic_replay_test');await admin.end();
  const pool=new pg.Pool(config);t.after(()=>pool.end());
  for(const migration of ['0001-enrollment','0002-media','0003-audit'])await pool.query(await readFile(new URL(`../../migrations/${migration}.sql`,import.meta.url),'utf8'));
  const cloud=new PostgresAuditStore(postgresDatabase(pool),'diagnostic-cloud',()=>now),request=intent(),allow=authorization(request);
  await cloud.admit(request,allow,binding(request),binding(allow));
  const inv=inventory(),first=deviceEvent('diagnostic-offline-1','1'),third=deviceEvent('diagnostic-offline-3','3');
  const approved=new Map<string,AuditEvent>([[first.eventId,first],[third.eventId,third]]);
  inv.registry.devices[0].retiredIdentities.push(first.source.identity);inv.registry.devices[0].current={...first.source.identity,bootId:'current-edge-boot',sessionId:'current-edge-link'};
  await pool.query('INSERT INTO arbi_device_registry VALUES($1,$2,$3,$4::jsonb)',[first.realm.environment,first.realm.namespaceId,first.siteId,JSON.stringify(inv.registry)]);
  const server=createAuditServer({db:postgresDatabase(pool),realm:first.realm,now:()=>now,
    resolveEvidence:async(_sql,q)=>approved.has(q.eventId)?binding(approved.get(q.eventId)!):null});
  const directory=mkdtempSync(join(tmpdir(),'arbi-diagnostic-native-'));let clock=now,lose=true,attempts=0;
  const current=inv.registry.devices[0].current,storeOptions={path:join(directory,'diagnostics.sqlite'),realm:first.realm,siteId:first.siteId,source:current,
    maxRecords:32,maxBytes:16384,maxPages:64,retainMs:60000};
  const budgetOptions={path:join(directory,'budget.sqlite'),realm:first.realm,siteId:first.siteId,source:current,
    policy:{revision:'native-test',allowanceBytes:16384,essentialBytes:65536,maxTransferBytes:16384,bytesPerSecond:16384,essentialBytesPerSecond:65536,
      concurrency:1,essentialConcurrency:1,unknownCoverage:'defer' as const,maxAttempts:2,uploadWindows:[],stream:{maxBitrate:800,maxDurationMs:1000,idleMs:250}},
    clock:()=>({epoch:'native-test-clock',monotonicMs:clock-now,utcMs:clock,reliable:true}),authorize:()=>false};
  let pipeline=new DiagnosticPipeline(new DiagnosticStore(storeOptions),()=>clock),budget=new TransferBudget(budgetOptions),relay=new JobAuditRelay(join(directory,'audit'));
  t.after(()=>{pipeline.close();budget.close();relay.close();rmSync(directory,{recursive:true,force:true});});
  relay.spool(first).append(first);relay.spool(third).append(third);
  budget.checkpoint({period:'native-test',startUtcMs:now,endUtcMs:now+86400000,revision:1,usedBytes:16384,coverage:'unknown',observedUtcMs:now,maxAgeMs:60000,coveredCharges:[]});
  const pump=()=>new DiagnosticUplink({pipeline,budget,auditSpools:()=>relay.pendingSpools(),mode:()=> 'essential-only',auditFrame:async(e:AuditEvent)=>JSON.stringify(inv.upload(e)),
    send:async(kind:'audit'|'diagnostic',frame:string)=>{
      assert.equal(kind,'audit');attempts++;assert.ok(budget.status.active!>0);
      const response=await server.handle(new Request('https://synthetic.test/audit/ingest',{method:'POST',headers:{'content-type':'application/json'},body:frame}),first.siteId);
      assert.equal(response.status,200);const receipt=await response.json();if(lose){lose=false;throw Error('synthetic committed receipt lost');}
      return {attemptedBytes:Buffer.byteLength(frame),acceptedBytes:Buffer.byteLength(frame),receipt};
    }});
  const initial=pump();assert.equal((await initial.flush()).auditUploaded,0);assert.equal(relay.pendingSpools()[0]!.status().pending,2);
  assert.ok(initial.status.accounting.ambiguousUpperBoundBytes>0);assert.equal((await pool.query("SELECT count(*) n FROM arbi_audit_events WHERE id LIKE 'diagnostic-offline-%'")).rows[0].n,'1');
  initial.stop();pipeline.close();budget.close();relay.close();clock+=1000;
  pipeline=new DiagnosticPipeline(new DiagnosticStore(storeOptions),()=>clock);budget=new TransferBudget(budgetOptions);relay=new JobAuditRelay(join(directory,'audit'));
  assert.equal((await pump().flush()).auditUploaded,2);assert.equal(attempts,3);assert.equal(relay.pendingSpools()[0]!.status().pending,0);
  assert.equal((await pool.query("SELECT count(*) n FROM arbi_audit_events WHERE id LIKE 'diagnostic-offline-%'")).rows[0].n,'2');
  const records=(await pool.query("SELECT record FROM arbi_audit_events WHERE id LIKE 'diagnostic-offline-%' ORDER BY id")).rows.map(r=>r.record);
  for(const [i,original] of [first,third].entries()){const {ingestTime,...record}=records[i],{ingestTime:originalIngest,...originalRecord}=original;
    assert.equal(originalIngest,null);assert.deepEqual(record,originalRecord);assert.ok(ingestTime);}
  const gap=(await pool.query('SELECT detail FROM arbi_audit_evidence WHERE event_id=$1',[third.eventId])).rows[0].detail;assert.deepEqual(gap.gaps,[{from:'2',to:'2'}]);assert.equal(gap.clockDisjoint,true);
  assert.equal(budget.status.coverage,'unknown');assert.equal(budget.status.remainingBytes,0);assert.ok(budget.status.degraded===false);
});
