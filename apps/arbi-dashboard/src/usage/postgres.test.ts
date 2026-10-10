import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import pg from 'pg';
import { postgresDatabase } from '../enrollment/store';
import { createUsageServer } from './server';
import { migrations, commonTests, setup, realm } from './test-support';
import { VERSION } from './contracts';
const socket=process.env.ARBI_ENROLLMENT_TEST_SOCKET;
test('native PostgreSQL usage: concurrent duplicate/overlap, restart and audit rollback',{skip:!socket,timeout:45000},async t=>{
  const root=realpathSync(socket!);assert.ok(root.startsWith(`${realpathSync(process.platform==='darwin'?'/private/tmp':tmpdir())}/arbi-enrollment-pg-`));
  const config={host:root,user:'arbi_test',port:54321,database:'arbi_usage_test',max:4};
  const admin=new pg.Pool({...config,database:'postgres',max:1});await admin.query('CREATE DATABASE arbi_usage_test');await admin.end();
  const pool=new pg.Pool(config),other=new pg.Pool({...config,max:1});t.after(async()=>{await other.end();await pool.end();});
  const db=postgresDatabase(pool);await migrations(pool);await commonTests(t,db,pool);
  await t.test('independent concurrent clients serialize duplicate/overlap and roll back failed correction audit',async()=>{
    const f=await setup(db,pool),second=createUsageServer({db:postgresDatabase(other),realm,identity:f.identity.adapter,resolveSite:f.identity.resolveResource,currentAuthority:f.currentAuthority,browserOrigins:['https://synthetic.test']});
    const o=f.observation(),signed=f.signed('ingest',[{sequence:'1',observation:o}],VERSION);
    const results=await Promise.all([f.server.store.ingest(f.siteId,signed),second.store.ingest(f.siteId,signed)]);
    assert.deepEqual(new Set(results.map(r=>r.results[0].decision)),new Set(['duplicate','recorded']));
    const conflicting=f.observation();await assert.rejects(second.store.ingest(f.siteId,f.signed('ingest',[{sequence:'2',observation:conflicting}],VERSION)),{code:'CONFLICT'});
    assert.equal((await second.store.read(await f.context(),f.query)).totals[0].bytes,'100');
    await pool.query('ALTER TABLE arbi_usage_corrections ADD CONSTRAINT injected_failure CHECK(false) NOT VALID');
    await assert.rejects(f.server.store.correct(await f.context('configuration.write'),{key:'correction',observationId:o.observationId,reasonId:'bad-counter'}),{code:'UNAVAILABLE'});
    assert.equal((await pool.query("SELECT id FROM arbi_audit_events WHERE site_id=$1 AND record->>'action'='configuration.change'",[f.siteId])).rows.length,0);
    assert.equal((await f.read()).totals[0].bytes,'100');await pool.query('ALTER TABLE arbi_usage_corrections DROP CONSTRAINT injected_failure');
  });
});
