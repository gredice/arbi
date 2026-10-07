import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import test from "node:test";
import pg from "pg";
import type { AuthorizedContext } from "@arbi/gredice";
import type { Command, Event } from "@arbi/protocol";
import { postgresDatabase } from "../enrollment/store";
import type { Job } from "./contracts";
import { createJobsServer } from "./server";
import { PostgresJobStore } from "./store";
import { fixture,realm } from "./test-support";

const socket = process.env.ARBI_ENROLLMENT_TEST_SOCKET;
test("native PostgreSQL jobs: independent connections, fences, crash/replay, signed reports, current authority and atomic audit",{ skip: !socket,timeout: 45000 },async (t) => {
  const root = realpathSync(socket!);assert.ok(root.startsWith(`${realpathSync(process.platform === "darwin" ? "/private/tmp" : tmpdir())}/arbi-enrollment-pg-`));
  const admin = new pg.Pool({ host: root,user: "arbi_test",port: 54321,database: "postgres",max: 1 });
  await admin.query("CREATE DATABASE arbi_jobs_test");await admin.end();
  const config = { host: root,user: "arbi_test",port: 54321,database: "arbi_jobs_test",max: 4 };
  const pool = new pg.Pool(config), independent = new pg.Pool({ ...config,max: 1 });t.after(async () => { await independent.end();await pool.end(); });
  t.diagnostic(`Native PostgreSQL ${(await pool.query("SHOW server_version")).rows[0].server_version}`);
  for (const file of ["0001-enrollment","0002-media","0003-audit","0004-jobs","0004-jobs"]) await pool.query(await readFile(new URL(`../../migrations/${file}.sql`,import.meta.url),"utf8"));
  async function setup() {
    const f = await fixture();await pool.query("INSERT INTO arbi_device_registry VALUES($1,$2,$3,$4::jsonb)",[realm.environment,realm.namespaceId,f.registry.siteId,JSON.stringify(f.registry)]);
    const a = new PostgresJobStore(postgresDatabase(pool),realm,f.currentAuthority), b = new PostgresJobStore(postgresDatabase(independent),realm,f.currentAuthority);
    await a.device(f.registry.siteId,f.upload("snapshot",f.snapshot()));
    const one = await f.human("operator-1"),two = await f.human("operator-2");
    const sync = () => pool.query("UPDATE arbi_device_registry SET state=$1::jsonb WHERE environment=$2 AND namespace_id=$3 AND site_id=$4",[JSON.stringify(f.registry),realm.environment,realm.namespaceId,f.registry.siteId]);
    return { f,a,b,one,two,sync };
  }
  const { f,a,b,one,two } = await setup(), siteId = f.registry.siteId;
  const request = { key: "acquire-1",deviceId: "edge-1",ttlMs: 4500 };
  const races = await Promise.allSettled([a.lease(one.context,"acquire",request),b.lease(two.context,"acquire",request)]);
  assert.equal(races.filter((r) => r.status === "fulfilled").length,1);
  const winner = races[0].status === "fulfilled" ? one : two, loser = winner === one ? two : one;
  const lease = (races.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof a.lease>>>).value;
  const input = { key: "logical-move",deviceId: "edge-1",leaseId: lease.id,fence: lease.fence,timeoutMs: 3000,
    body: { type: "motion.move",positionMm: { x: 10,y: 20,z: 100 },frame: { name: "site",revision: "frame-1" },maxSpeedMmPerS: 10,maxDurationMs: 500 } };
  await assert.rejects(a.submit(loser.context,input),{ code: "STALE_FENCE" });
  const duplicates = await Promise.all([a.submit(winner.context,input),b.submit(winner.context,input)]);
  assert.deepEqual(duplicates[0],duplicates[1]);const job = duplicates[0];
  assert.equal(job.deviceStatus,null);assert.equal(job.terminal,null);
  await assert.rejects(b.submit(winner.context,{ ...input,body: { ...input.body,maxSpeedMmPerS: 20 } }),{ code: "CONFLICT" });
  await assert.rejects(a.submit(winner.context,{ ...input,key: "forged",actor: { kind: "human",id: "forged" } }),{ code: "INVALID_REQUEST" });
  assert.equal((await pool.query("SELECT count(*) FROM arbi_command_jobs WHERE site_id=$1",[siteId])).rows[0].count,"1");
  const poll = async (store = a) => await store.device(siteId,f.upload("poll",{})) as { commands: Command[] };
  assert.deepEqual((await poll()).commands,[job.command]); // lost delivery/receipt, durable identical envelope on another connection
  assert.deepEqual((await poll(b)).commands,[job.command]);
  const accepted = f.outcome(job.command,"accepted");
  assert.deepEqual(await a.device(siteId,f.upload("outcome",accepted)),{ decision: "recorded",durable: true });
  assert.deepEqual(await b.device(siteId,f.upload("outcome",accepted)),{ decision: "recorded",durable: true }); // ack lost, replay
  assert.deepEqual((await poll()).commands,[]);
  let readContext = await f.identity.adapter.authorize(winner.token,"state.read",{ realm,siteId,accountId: "account-1",resource: { kind: "site",id: siteId },executionMode: "simulation" });
  assert.equal((await a.status(readContext,job.id)).deviceStatus,"accepted");
  const running = f.outcome(job.command,"running");await b.device(siteId,f.upload("outcome",running));
  assert.equal((await a.status(readContext,job.id)).deviceStatus,"running");
  const done = f.outcome(job.command);
  const receipts = await Promise.all([a.device(siteId,f.upload("outcome",done)),b.device(siteId,f.upload("outcome",done))]);assert.deepEqual(receipts[0],receipts[1]);
  const terminalJob = await a.status(readContext,job.id);assert.equal(terminalJob.deviceStatus,"completed");assert.deepEqual({ ...terminalJob.terminal,ingestTime: null },done);assert.ok(terminalJob.terminal?.ingestTime);
  const contradiction = f.outcome(job.command,"failed");assert.deepEqual(await a.device(siteId,f.upload("outcome",contradiction)),{ decision: "contradiction",durable: true });
  assert.deepEqual((await b.status(readContext,job.id)).terminal,terminalJob.terminal);
  const reordered = f.outcome(job.command,"accepted");assert.deepEqual(await a.device(siteId,f.upload("outcome",reordered)),{ decision: "stale",durable: true });
  await assert.rejects(a.device(siteId,f.upload("outcome",{ ...done,body: { ...done.body,outcome: "failed",error: { code: "EXECUTION_FAILED",retryable: false } } })),{ code: "CONFLICT" });
  const persisted = (await pool.query("SELECT record FROM arbi_job_reports WHERE id=$1",[done.messageId])).rows[0].record;
  assert.deepEqual(persisted.sourceTime,done.sourceTime);assert.ok(persisted.ingestTime.utc);
  const event = (await pool.query("SELECT record FROM arbi_audit_events WHERE id=$1",[done.messageId])).rows[0].record;
  assert.deepEqual(event.actor,winner.context.actor);assert.equal(event.links.jobId,job.id);assert.equal(event.effect,"device-reported");
  await assert.rejects(pool.query("UPDATE arbi_command_jobs SET record=jsonb_set(record,'{terminal}','null') WHERE id=$1",[job.id]),{ code: "42501" });
  await assert.rejects(pool.query("DELETE FROM arbi_job_reports"),{ code: "42501" });
  await assert.rejects(pool.query("DELETE FROM arbi_command_jobs"),{ code: "42501" });
  await assert.rejects(pool.query("UPDATE arbi_control_leases SET fence=fence+1"),{ code: "42501" });
  await a.audit.verify(realm,siteId);

  // HTTP against real migrated PostgreSQL and current signed identity; browser claims confer no authority.
  const h = await setup();
  const http = createJobsServer({ db: postgresDatabase(pool),realm,identity: h.f.identity.adapter,resolveSite: h.f.identity.resolveResource,
    currentAuthority: h.f.currentAuthority,browserOrigins: ["https://synthetic.test"] });
  function req(action: string,body: unknown,token = h.one.token,extra: Record<string,string> = {}) {
    return new Request(`https://synthetic.test/api/sites/${h.f.registry.siteId}/jobs/${action}`,{ method: "POST",headers: {
      authorization: `Bearer ${token}`,origin: "https://synthetic.test","x-arbi-request": "1","content-type": "application/json",...extra },body: JSON.stringify(body) });
  }
  let response = await http.handle(req("acquire",{ key: "http-acquire",deviceId: "edge-1",ttlMs: 4500 }),{ siteId: h.f.registry.siteId,action: "acquire" });
  assert.equal(response.status,200);const httpLease = await response.json();
  const httpInput = { ...input,key: "http-submit",leaseId: httpLease.id,fence: httpLease.fence };
  response = await http.handle(req("submit",httpInput),{ siteId: h.f.registry.siteId,action: "submit" });assert.equal(response.status,202);
  const httpJob = await response.json();assert.equal(httpJob.deviceStatus,null);assert.equal(httpJob.terminal,null);
  for (const mutation of [{ ...httpInput,key: "wrong-config",configRevision: "forged" },{ ...httpInput,key: "wrong-boot",target: { bootId: "forged" } }]) {
    assert.equal((await http.handle(req("submit",mutation),{ siteId: h.f.registry.siteId,action: "submit" })).status,400);
  }
  assert.equal((await http.handle(req("submit",httpInput),{ siteId: "other-site",action: "submit" })).status,403);
  assert.equal((await http.handle(req("submit",httpInput,h.one.token,{ origin: "https://wrong.test" }),{ siteId: h.f.registry.siteId,action: "submit" })).status,403);
  const otherSession = await h.f.human("operator-1");
  assert.equal((await http.handle(req("submit",{ ...httpInput,key: "wrong-session" },otherSession.token),{ siteId: h.f.registry.siteId,action: "submit" })).status,409);
  h.f.identity.putPrincipal({ actor: { kind: "service",id: "service-1" },accountId: "account-1",member: true,
    sites: { [h.f.registry.siteId]: { roles: [],serviceScopes: ["capture.request"],active: true,revision: "member-1" } } });
  const svc = await h.f.identity.issue({ kind: "service",id: "service-1" });
  assert.equal((await http.handle(req("submit",httpInput,svc.token,{ origin: "" }),{ siteId: h.f.registry.siteId,action: "submit" })).status,403);
  h.f.identity.revoke(h.one.sessionId);
  assert.equal((await http.handle(req("submit",httpInput),{ siteId: h.f.registry.siteId,action: "submit" })).status,401);
  assert.deepEqual(await h.a.device(h.f.registry.siteId,h.f.upload("poll",{})),{ commands: [] });
  const admittedAfterRevoke = (await pool.query("SELECT record FROM arbi_command_jobs WHERE id=$1",[httpJob.id])).rows[0].record;
  assert.equal(admittedAfterRevoke.cloudDisposition,"authority-lost");assert.equal(admittedAfterRevoke.terminal,null);

  // Audit/outbox failure aborts all job, lease, head and decision persistence.
  const x = await setup();const xsite = x.f.registry.siteId;
  await pool.query("ALTER TABLE arbi_audit_outbox ADD CONSTRAINT jobs_inject_failure CHECK (false) NOT VALID");
  await assert.rejects(x.a.lease(x.one.context,"acquire",request),{ code: "UNAVAILABLE" });
  assert.equal((await pool.query("SELECT count(*) FROM arbi_control_leases WHERE site_id=$1",[xsite])).rows[0].count,"0");
  await pool.query("ALTER TABLE arbi_audit_outbox DROP CONSTRAINT jobs_inject_failure");
  const xl = await x.a.lease(x.one.context,"acquire",request);
  const head = await x.a.audit.verify(realm,xsite);
  await pool.query("ALTER TABLE arbi_command_jobs ADD CONSTRAINT jobs_inject_failure CHECK (false) NOT VALID");
  await assert.rejects(x.a.submit(x.one.context,{ ...input,leaseId: xl.id,fence: xl.fence }),{ code: "UNAVAILABLE" });
  assert.deepEqual(await x.a.audit.verify(realm,xsite),head);
  await pool.query("ALTER TABLE arbi_command_jobs DROP CONSTRAINT jobs_inject_failure");
  const xj = await x.a.submit(x.one.context,{ ...input,leaseId: xl.id,fence: xl.fence });
  const xdone = x.f.outcome(xj.command);
  await pool.query("ALTER TABLE arbi_job_reports ADD CONSTRAINT jobs_inject_failure CHECK (false) NOT VALID");
  await assert.rejects(x.a.device(xsite,x.f.upload("outcome",xdone)),{ code: "UNAVAILABLE" });
  assert.equal((await pool.query("SELECT record FROM arbi_command_jobs WHERE id=$1",[xj.id])).rows[0].record.terminal,null);
  await pool.query("ALTER TABLE arbi_job_reports DROP CONSTRAINT jobs_inject_failure");
  await x.b.device(xsite,x.f.upload("outcome",xdone));

  // Revocation/takeover, renew, cancellation and stop requests retain distinct meanings.
  const r = await setup(), rsite = r.f.registry.siteId;
  const rl = await r.a.lease(r.one.context,"acquire",request);
  const rj = await r.a.submit(r.one.context,{ ...input,leaseId: rl.id,fence: rl.fence });
  const engineer = await r.f.identity.adapter.authorize(r.two.token,"configuration.write",{ realm,siteId: rsite,accountId: "account-1",resource: { kind: "site",id: rsite },executionMode: "simulation" });
  await r.b.lease(engineer,"revoke",{ key: "revoke",leaseId: rl.id,fence: rl.fence });
  const replacement = await r.b.lease(r.two.context,"acquire",{ ...request,key: "replacement" });assert.ok(BigInt(replacement.fence)>BigInt(rl.fence));
  await assert.rejects(new PostgresJobStore(postgresDatabase(pool),realm,r.f.currentAuthority).submit(r.one.context,{ ...input,key: "stale-fence",leaseId: rl.id,fence: rl.fence }),{ code: "STALE_FENCE" });
  assert.deepEqual(await r.a.device(rsite,r.f.upload("poll",{})),{ commands: [] });
  assert.equal((await pool.query("SELECT record FROM arbi_command_jobs WHERE id=$1",[rj.id])).rows[0].record.cloudDisposition,"lease-lost");
  const renewed = await r.a.lease(r.two.context,"renew",{ key: "renew",leaseId: replacement.id,fence: replacement.fence,ttlMs: 4500 });assert.equal(renewed.fence,replacement.fence);
  const cancellable = await r.a.submit(r.two.context,{ ...input,key: "cancel-me",leaseId: renewed.id,fence: renewed.fence });
  const cancelled = await r.a.status(r.two.context,cancellable.id,true);assert.equal(cancelled.cloudDisposition,"cancel-requested");assert.equal(cancelled.terminal,null);
  const stop = await r.a.submit(r.one.context,{ key: "stop-request",deviceId: "edge-1",leaseId: null,fence: null,timeoutMs: 2000,body: { type: "control.stop",reason: "operator" } });
  assert.equal(stop.deviceStatus,null);assert.equal(stop.command.command.lease,null);
  const commands = (await r.a.device(rsite,r.f.upload("poll",{})) as { commands: Command[] }).commands;
  assert.deepEqual(commands.map((c) => c.command.commandId),[stop.id]);
  const stopped = r.f.outcome(stop.command);await r.b.device(rsite,r.f.upload("outcome",stopped));
  assert.equal((await pool.query("SELECT record FROM arbi_command_jobs WHERE id=$1",[cancellable.id])).rows[0].record.terminal,null);

  // Configuration/enrollment/reboot barriers, time ambiguity and stale snapshots.
  for (const kind of ["config","device-revoked","reboot","clock"] as const) {
    const z = await setup(), zsite = z.f.registry.siteId;
    const zl = await z.a.lease(z.one.context,"acquire",request), zj = await z.a.submit(z.one.context,{ ...input,leaseId: zl.id,fence: zl.fence });
    if (kind === "config") { z.f.registry.configRevision = "config-2";z.f.registry.devices[0].appliedConfigRevision = "config-2";await z.sync(); }
    if (kind === "device-revoked") { z.f.registry.devices[0].status = "revoked";await z.sync(); }
    if (kind === "reboot") {
      z.f.registry.devices[0].retiredIdentities.push(z.f.registry.devices[0].current!);
      z.f.registry.devices[0].current = { deviceId: "edge-1",bootId: "boot-2",sessionId: "link-2" };await z.sync();
      await z.a.device(zsite,z.f.upload("snapshot",z.f.snapshot()));
    }
    if (kind === "clock") { const e = z.f.snapshot();e.sourceTime = { ...e.sourceTime,utc: null,uncertaintyMs: null };await z.a.device(zsite,z.f.upload("snapshot",e)); }
    if (kind === "device-revoked") await assert.rejects(z.a.device(zsite,z.f.upload("poll",{})));
    else if (kind === "config") {
      assert.deepEqual(await z.a.device(zsite,z.f.upload("poll",{})),{ commands: [] });
    } else if (kind === "clock") {
      assert.deepEqual(await z.a.device(zsite,z.f.upload("poll",{})),{ commands: [] });
      await z.a.device(zsite,z.f.upload("snapshot",z.f.snapshot()));
      assert.deepEqual(await z.a.device(zsite,z.f.upload("poll",{})),{ commands: [] });
    } else {
      assert.deepEqual(await z.a.device(zsite,z.f.upload("poll",{})),{ commands: [] });
      const next = await z.a.lease(z.two.context,"acquire",{ ...request,key: "new-boot" });assert.ok(BigInt(next.fence)>BigInt(zl.fence));
      // Old-boot terminal evidence can recover through the current enrolled edge. It cannot grant dispatch.
      await z.a.device(zsite,z.f.upload("outcome",z.f.outcome(zj.command)));
    }
    const read = { ...z.two.context,capability: "state.read" } as AuthorizedContext;
    const status = await z.b.status(read,zj.id);
    if (kind !== "reboot") assert.notEqual(status.cloudDisposition,"admitted");
  }
  const time = await setup(), timeSite = time.f.registry.siteId;
  const short = await time.a.lease(time.one.context,"acquire",{ ...request,ttlMs: 700 });
  const stale = time.f.snapshot();stale.sourceTime.utc = new Date(Date.now()+60_000).toISOString();
  await time.a.device(timeSite,time.f.upload("snapshot",stale));
  await assert.rejects(time.a.submit(time.one.context,{ ...input,leaseId: short.id,fence: short.fence }),{ code: "CLOCK_UNCERTAIN" });
  await time.a.device(timeSite,time.f.upload("snapshot",time.f.snapshot()));
  await new Promise((resolve) => setTimeout(resolve,750));
  const takeover = await time.b.lease(time.two.context,"acquire",{ ...request,key: "after-expiry" });assert.ok(BigInt(takeover.fence)>BigInt(short.fence));
  await assert.rejects(time.a.lease(time.one.context,"renew",{ key: "stale-renew",leaseId: short.id,fence: short.fence,ttlMs: 1000 }),{ code: "STALE_FENCE" });
  const expired = await time.a.submit(time.two.context,{ ...input,key: "expires",leaseId: takeover.id,fence: takeover.fence,timeoutMs: 900,body: { ...input.body,maxDurationMs: 100 } });
  await new Promise((resolve) => setTimeout(resolve,950));
  assert.deepEqual(await time.b.device(timeSite,time.f.upload("poll",{})),{ commands: [] });
  assert.equal((await pool.query("SELECT record FROM arbi_command_jobs WHERE id=$1",[expired.id])).rows[0].record.cloudDisposition,"expired");
  const repeatedExpired = await time.a.submit(time.two.context,{ ...input,key: "expires",leaseId: takeover.id,fence: takeover.fence,timeoutMs: 900,body: { ...input.body,maxDurationMs: 100 } });
  assert.equal(repeatedExpired.cloudDisposition,"expired");assert.deepEqual(repeatedExpired.command,expired.command);
  await assert.rejects(time.a.device(timeSite,{ ...time.f.upload("poll",{}),signature: "x".repeat(86) }),{ code: "DENIED" });
  const behind = time.f.snapshot();behind.sequence = "0";if (behind.body.type === "state.snapshot") behind.body.eventCursor.sequence = "0";
  assert.deepEqual(await time.a.device(timeSite,time.f.upload("snapshot",behind)),{ decision: "stale",durable: true });
  // Persisted clock floor also fails closed after process replacement if the database clock regresses.
  await pool.query("UPDATE arbi_job_sites SET clock_floor_ms=$1 WHERE site_id=$2",[Date.now()+60_000,timeSite]);
  await assert.rejects(time.b.device(timeSite,time.f.upload("poll",{})),{ code: "CLOCK_UNCERTAIN" });

  // A slow later directory read cannot return an earlier command after its page lifetime expires.
  const page = await setup(), pageSite = page.f.registry.siteId;
  const pageLease = await page.a.lease(page.one.context,"acquire",request);
  const early = await page.a.submit(page.one.context,{ ...input,key: "early",leaseId: pageLease.id,fence: pageLease.fence,timeoutMs: 900,body: { ...input.body,maxDurationMs: 100 } });
  const later = await page.a.submit(page.one.context,{ ...input,key: "later",leaseId: pageLease.id,fence: pageLease.fence });
  let reads = 0;
  const slowPage = new PostgresJobStore(postgresDatabase(pool),realm,async (previous,signal) => {
    if (++reads === 3) await new Promise((resolve) => setTimeout(resolve,750));
    return page.f.currentAuthority(previous,signal);
  });
  const pageResult = await slowPage.device(pageSite,page.f.upload("poll",{})) as { commands: Command[] };
  assert.deepEqual(pageResult.commands.map((command) => command.command.commandId),[later.id]);
  assert.equal((await pool.query("SELECT record FROM arbi_command_jobs WHERE id=$1",[early.id])).rows[0].record.cloudDisposition,"expired");

  // Separate process crashes before COMMIT and after admission COMMIT/before delivery; recovery never mints a new envelope.
  const c = await setup(), csite = c.f.registry.siteId;
  const cl = await c.a.lease(c.one.context,"acquire",request), ci = { ...input,key: "crash-intent",leaseId: cl.id,fence: cl.fence };
  async function child(code: string) {
    const processChild = spawn(process.execPath,["--import","tsx","--input-type=module","--eval",code],{ stdio: ["ignore","pipe","pipe"] });
    let error = "";processChild.stderr.on("data",(data) => { error += data; });
    await new Promise<void>((resolve,reject) => { processChild.stdout.once("data",() => resolve());processChild.once("error",reject);processChild.once("exit",() => reject(new Error(error))); });
    processChild.kill("SIGKILL");await once(processChild,"exit");
  }
  await child(`import pg from 'pg';const p=new pg.Pool(${JSON.stringify(config)});const c=await p.connect();await c.query('BEGIN');
    await c.query("UPDATE arbi_job_sites SET fence=fence+100 WHERE site_id=$1",[${JSON.stringify(csite)}]);process.stdout.write('uncommitted');setInterval(()=>{},1000);`);
  assert.equal((await pool.query("SELECT fence FROM arbi_job_sites WHERE site_id=$1",[csite])).rows[0].fence,cl.fence);
  await child(`import pg from 'pg';import { postgresDatabase } from ${JSON.stringify(new URL("../enrollment/store.ts",import.meta.url).href)};
    import { PostgresJobStore } from ${JSON.stringify(new URL("./store.ts",import.meta.url).href)};
    const p=new pg.Pool(${JSON.stringify(config)});const s=new PostgresJobStore(postgresDatabase(p),${JSON.stringify(realm)},async previous=>previous);
    await s.submit(${JSON.stringify(c.one.context)},${JSON.stringify(ci)});process.stdout.write('committed');setInterval(()=>{},1000);`);
  const recovered = await c.b.submit(c.one.context,ci);
  assert.deepEqual((await c.b.device(csite,c.f.upload("poll",{})) as { commands: Command[] }).commands,[recovered.command]);
  assert.equal((await pool.query("SELECT count(*) FROM arbi_command_jobs WHERE site_id=$1",[csite])).rows[0].count,"1");
  await c.a.audit.verify(realm,csite);
});
