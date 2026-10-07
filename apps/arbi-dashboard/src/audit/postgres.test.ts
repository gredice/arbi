import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import pg from "pg";
import { SqliteAuditSpool } from "@arbi/audit";
import type { AuditEvent } from "@arbi/protocol";
import { postgresDatabase } from "../enrollment/store";
import { DeviceAuditIngest } from "./ingest";
import type { EvidenceResolver } from "./ingest";
import { createAuditServer } from "./server";
import { PostgresAuditStore } from "./store";
import { authorization, binding, deviceEvent, intent, inventory, now } from "./test-support";

const socket = process.env.ARBI_ENROLLMENT_TEST_SOCKET;
test("isolated native PostgreSQL: transactional admission, crash/restart, real SQLite replay, authority and immutable history",{ skip: !socket,timeout: 25_000 },async (t) => {
  const root = realpathSync(socket!);assert.ok(root.startsWith(`${realpathSync(process.platform === "darwin" ? "/private/tmp" : tmpdir())}/arbi-enrollment-pg-`));
  const admin = new pg.Pool({ host: root,user: "arbi_test",port: 54321,database: "postgres",max: 1 });
  await admin.query("CREATE DATABASE arbi_audit_test");await admin.end();
  const config = { host: root,user: "arbi_test",port: 54321,database: "arbi_audit_test",max: 6 };
  const pool = new pg.Pool(config);t.after(() => pool.end());
  t.diagnostic(`Isolated native PostgreSQL ${(await pool.query("SHOW server_version")).rows[0].server_version}`);
  for (const file of ["0001-enrollment","0002-media"]) await pool.query(await readFile(new URL(`../../migrations/${file}.sql`,import.meta.url),"utf8"));
  const legacyRecord = intent("11111111-1111-4111-8111-111111111111");
  const legacyRegistry = { ...inventory().registry,siteId: "legacy-site" };
  await pool.query("INSERT INTO arbi_device_registry VALUES('test','synthetic-audit','legacy-site',$1)",[legacyRegistry]);
  await pool.query("INSERT INTO arbi_device_audit VALUES($1,'test','synthetic-audit','legacy-site',$2)",[legacyRecord.eventId,legacyRecord]);
  await pool.query("INSERT INTO arbi_media_sites VALUES('test','synthetic-audit','legacy-site',$1)",[{ realm: legacyRecord.realm,siteId: "legacy-site" }]);
  await pool.query("INSERT INTO arbi_media_audit VALUES($1,'test','synthetic-audit','legacy-site',$2,'{}')",[legacyRecord.eventId,legacyRecord]);
  const legacy = await pool.query("SELECT * FROM arbi_device_audit ORDER BY id");
  const media = await pool.query("SELECT * FROM arbi_media_audit ORDER BY id");
  const migration = await readFile(new URL("../../migrations/0003-audit.sql",import.meta.url),"utf8");
  await pool.query(migration);await pool.query(migration);
  assert.deepEqual((await pool.query("SELECT * FROM arbi_device_audit ORDER BY id")).rows,legacy.rows);
  assert.deepEqual((await pool.query("SELECT * FROM arbi_media_audit ORDER BY id")).rows,media.rows);
  const a = new PostgresAuditStore(postgresDatabase(pool),"ingest-1",() => now);
  const cloud = intent(),allow = authorization(cloud);
  // Real process exits after COMMIT, before any outbox notification; restart finds both records.
  const child = spawn(process.execPath,["--import","tsx","--input-type=module","--eval",`
    import pg from 'pg';import { postgresDatabase } from ${JSON.stringify(new URL("../enrollment/store.ts",import.meta.url).href)};
    import { PostgresAuditStore } from ${JSON.stringify(new URL("./store.ts",import.meta.url).href)};
    const pool=new pg.Pool(${JSON.stringify(config)});const s=new PostgresAuditStore(postgresDatabase(pool),'ingest-1',()=>${now});
    await s.admit(${JSON.stringify(cloud)},${JSON.stringify(allow)},${JSON.stringify(binding(cloud))},${JSON.stringify(binding(allow))});
    process.stdout.write('committed');setInterval(()=>{},1000);`],{ stdio: ["ignore","pipe","pipe"] });
  let stderr = "";child.stderr.on("data",(data) => { stderr += data; });
  await new Promise<void>((resolve,reject) => { child.stdout.once("data",() => resolve());child.once("error",reject);child.once("exit",() => reject(new Error(stderr))); });
  child.kill("SIGKILL");await new Promise((resolve) => child.once("exit",resolve));
  const b = new PostgresAuditStore(postgresDatabase(pool),"ingest-2",() => now+2000);
  const repeated = await Promise.all([a.admit(cloud,allow,binding(cloud),binding(allow)),b.admit(cloud,allow,binding(cloud),binding(allow))]);
  assert.deepEqual(repeated[0],repeated[1]);assert.equal((await pool.query("SELECT count(*) FROM arbi_audit_events")).rows[0].count,"2");
  const delivered = new Set<string>();
  await assert.rejects(b.deliver(cloud.realm,cloud.siteId,async (id) => { delivered.add(id);throw new Error("delivery receipt lost"); }));
  assert.equal(await a.deliver(cloud.realm,cloud.siteId,async (id) => { delivered.add(id); }),1);assert.equal(delivered.size,1);
  assert.equal(await b.deliver(cloud.realm,cloud.siteId,async () => { throw new Error("unexpected duplicate"); }),0);
  // Any failed row rejects all intent/decision/outbox/head changes.
  const head = await a.verify(cloud.realm,cloud.siteId), next = intent("rollback-intent","3"),decision = authorization(next);
  await pool.query("ALTER TABLE arbi_audit_outbox ADD CONSTRAINT inject_failure CHECK (false) NOT VALID");
  await assert.rejects(a.admit(next,decision,binding(next),binding(decision)),{ code: "UNAVAILABLE" });
  assert.deepEqual(await a.verify(cloud.realm,cloud.siteId),head);
  assert.equal((await pool.query("SELECT count(*) FROM arbi_audit_events WHERE id LIKE 'rollback%' ")).rows[0].count,"0");
  await pool.query("ALTER TABLE arbi_audit_outbox DROP CONSTRAINT inject_failure");
  const inv = inventory();await pool.query("INSERT INTO arbi_device_registry(environment,namespace_id,site_id,state) VALUES($1,$2,$3,$4)",
    [cloud.realm.environment,cloud.realm.namespaceId,cloud.siteId,inv.registry]);
  const approved = new Map<string,AuditEvent>();
  const resolver: EvidenceResolver = async (_sql,query) => approved.has(query.eventId) ? binding(approved.get(query.eventId)!) : null;
  const ingest = new DeviceAuditIngest(a,cloud.realm,resolver,() => now);
  const first = deviceEvent("offline-1","1"),third = deviceEvent("offline-3","3"),second = deviceEvent("offline-2","2");
  for (const e of [first,second,third]) approved.set(e.eventId,e);
  const temp = mkdtempSync(join(tmpdir(),"arbi-audit-replay-"));t.after(() => rmSync(temp,{ recursive: true,force: true }));
  const opts = { path: join(temp,"spool.sqlite"),realm: first.realm,executionMode: first.executionMode,siteId: first.siteId,source: first.source,maxEvents: 8,maxBytes: 16384,maxPages: 64 };
  const spool = new SqliteAuditSpool(opts);spool.append(first);spool.append(third);spool.close();
  const restarted = new SqliteAuditSpool(opts);t.after(() => restarted.close());
  let firstReceipt: unknown;
  await assert.rejects(restarted.replay(async (e) => { firstReceipt = await ingest.ingest(inv.upload(e),e.siteId);throw new Error("lost ack"); }));
  assert.deepEqual(await ingest.ingest(inv.upload(first),first.siteId),firstReceipt);
  const simultaneous = await Promise.all([ingest.ingest(inv.upload(first),first.siteId),ingest.ingest(inv.upload(first),first.siteId)]);
  assert.deepEqual(simultaneous,[firstReceipt,firstReceipt]);
  assert.deepEqual((await pool.query("SELECT record FROM arbi_audit_events WHERE id='offline-1'")).rows[0].record.sourceTime,first.sourceTime);
  const http = createAuditServer({ db: postgresDatabase(pool),realm: first.realm,resolveEvidence: resolver,now: () => now });
  const request = () => new Request("https://synthetic.test/audit/ingest",{ method: "POST",headers: { "content-type": "application/json" },body: JSON.stringify(inv.upload(first)) });
  const response = await http.handle(request(),first.siteId);assert.equal(response.status,200);assert.deepEqual(await response.json(),firstReceipt);
  assert.equal(await restarted.replay((e) => ingest.ingest(inv.upload(e),e.siteId)),2);
  assert.equal((await pool.query("SELECT count(*) FROM arbi_audit_events WHERE id LIKE 'offline-%'")).rows[0].count,"2");
  const gap = (await pool.query("SELECT detail FROM arbi_audit_evidence WHERE event_id='offline-3'")).rows[0].detail;
  assert.deepEqual(gap.gaps,[{ from: "2",to: "2" }]);assert.equal(gap.clockDisjoint,true);
  await ingest.ingest(inv.upload(second),second.siteId);
  const filled = (await pool.query("SELECT detail FROM arbi_audit_evidence WHERE event_id='offline-2'")).rows[0].detail;
  assert.deepEqual(filled.gaps,[]);assert.deepEqual(gap.gaps,[{ from: "2",to: "2" }]);
  // Same ID with changed report conflicts even with an independently approved binding.
  const conflicting = { ...first,sourceTime: { ...first.sourceTime,monotonicMs: 2000 } };approved.set(first.eventId,conflicting);
  await assert.rejects(ingest.ingest(inv.upload(conflicting),first.siteId),{ code: "CONFLICT" });approved.set(first.eventId,first);
  const sameSequence = deviceEvent("sequence-conflict","1");approved.set(sameSequence.eventId,sameSequence);
  await assert.rejects(ingest.ingest(inv.upload(sameSequence),sameSequence.siteId),{ code: "CONFLICT" });
  for (const patch of [{ actor: { kind: "human",id: "forged" } },{ realm: { ...first.realm,namespaceId: "other" } },
    { executionMode: "hardware" },{ source: { ...first.source,module: "browser" } },{ siteId: "other" },{ ingestTime: { utc: new Date(now).toISOString(),uncertaintyMs: 1,deviceId: "forged" } }]) {
    await assert.rejects(ingest.ingest(inv.upload({ ...first,...patch } as AuditEvent),first.siteId));
  }
  await assert.rejects(ingest.ingest({ ...inv.upload(first),signature: "x".repeat(86) },first.siteId),{ code: "DENIED" });
  await assert.rejects(ingest.ingest({ ...inv.upload(first),expiresAtMs: now-1 },first.siteId),{ code: "DENIED" });
  const unknown = deviceEvent("unknown-evidence","4");await assert.rejects(ingest.ingest(inv.upload(unknown),first.siteId),{ code: "DENIED" });
  const fourth = deviceEvent("offline-4","4");fourth.sourceTime.monotonicMs = 100;approved.set(fourth.eventId,fourth);
  await ingest.ingest(inv.upload(fourth),fourth.siteId);
  assert.equal((await pool.query("SELECT detail FROM arbi_audit_evidence WHERE event_id='offline-4'")).rows[0].detail.clockRegression,true);
  // New current boot authenticates upload of protected old-boot evidence; revocation still denies replay.
  inv.registry.devices[0].retiredIdentities.push(first.source.identity);
  inv.registry.devices[0].current = { ...first.source.identity,bootId: "boot-2",sessionId: "link-2" };
  await pool.query("UPDATE arbi_device_registry SET state=$1 WHERE site_id=$2 AND namespace_id=$3",[inv.registry,first.siteId,first.realm.namespaceId]);
  assert.deepEqual(await ingest.ingest(inv.upload(first),first.siteId),firstReceipt);
  const bootEvent = deviceEvent("new-boot","3");bootEvent.source.identity = inv.registry.devices[0].current;bootEvent.links.target = bootEvent.source.identity;approved.set(bootEvent.eventId,bootEvent);
  await ingest.ingest(inv.upload(bootEvent),bootEvent.siteId);
  assert.equal((await pool.query("SELECT detail FROM arbi_audit_evidence WHERE event_id='new-boot'")).rows[0].detail.otherBootObserved,true);
  inv.registry.devices[0].status = "revoked";await pool.query("UPDATE arbi_device_registry SET state=$1 WHERE site_id=$2 AND namespace_id=$3",[inv.registry,first.siteId,first.realm.namespaceId]);
  await assert.rejects(ingest.ingest(inv.upload(first),first.siteId),{ code: "DENIED" });
  assert.equal((await http.handle(request(),first.siteId)).status,403);
  // Dedicated non-owner app role: inserts/reads events, updates only mutable head, cannot alter old history.
  await pool.query("CREATE ROLE audit_app NOLOGIN; GRANT USAGE ON SCHEMA public TO audit_app; GRANT SELECT,INSERT ON arbi_audit_events,arbi_audit_evidence,arbi_audit_outbox,arbi_audit_deliveries TO audit_app; GRANT SELECT,INSERT,UPDATE ON arbi_audit_heads TO audit_app; GRANT SELECT,INSERT ON arbi_device_audit,arbi_media_audit TO audit_app");
  const client = await pool.connect();
  try { await client.query("SET ROLE audit_app");
    for (const table of ["arbi_audit_events","arbi_device_audit","arbi_media_audit"]) for (const command of [`UPDATE ${table} SET record=record`,`DELETE FROM ${table}`,`TRUNCATE ${table}`]) await assert.rejects(client.query(command),{ code: "42501" });
  } finally { await client.query("RESET ROLE");client.release(); }
  await assert.rejects(pool.query("UPDATE arbi_audit_events SET record=record"),{ code: "42501" });
  const verified = await a.verify(cloud.realm,cloud.siteId);
  // Privileged tamper is detected only while the prior checkpoint remains independent.
  await pool.query("ALTER TABLE arbi_audit_events DISABLE TRIGGER arbi_audit_events_immutable; UPDATE arbi_audit_events SET record=jsonb_set(record,'{sourceTime,monotonicMs}','9999') WHERE id='offline-1'");
  await assert.rejects(a.verify(cloud.realm,cloud.siteId));assert.ok(verified.ordinal > 0);
  await pool.query("ALTER TABLE arbi_audit_events ENABLE TRIGGER arbi_audit_events_immutable");
});
