import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { AuditEvent } from "@arbi/protocol";
import { SqliteAuditSpool } from "./spool.js";
import type { SpoolOptions } from "./spool.js";
import { contentHash, missingRanges } from "./integrity.js";

const fixtures = JSON.parse(readFileSync(new URL("../../arbi-protocol/fixtures/audit-events.json",import.meta.url),"utf8"));
function event(id = "local-intent", sequence = "1"): AuditEvent {
  const value: AuditEvent = structuredClone(fixtures.valid["capture-intent"]);
  value.source = structuredClone(fixtures.valid.edge.source); value.actor = { kind: "device",id: "edge-1" };
  value.eventId = id; value.links.intentEventId = id; value.sequence = sequence; return value;
}
function options(path: string): SpoolOptions {
  const e = event(); return { path,realm: e.realm,siteId: e.siteId,executionMode: e.executionMode,source: e.source,maxEvents: 8,maxBytes: 16384,maxPages: 64 };
}
const ingestTime = { utc: "2026-10-07T01:00:00.000Z",uncertaintyMs: 1000,deviceId: "ingest-1" };
async function killed(script: string): Promise<void> {
  const child = spawn(process.execPath,["--input-type=module","--eval",script],{ stdio: ["ignore","pipe","pipe"] });
  let stderr = ""; child.stderr.on("data",(chunk) => { stderr += chunk; });
  await new Promise<void>((resolve,reject) => {
    child.stdout.on("data",() => resolve()); child.once("error",reject);
    child.once("exit",(code) => { if (code !== null) reject(new Error(`child exited ${code}: ${stderr}`)); });
  });
  child.kill("SIGKILL"); await new Promise((resolve) => child.once("exit",resolve));
}
test("real SQLite COMMIT survives process kill and unfinished transaction rolls back; replay is durable",async (t) => {
  const root = mkdtempSync(join(tmpdir(),"arbi-spool-")); t.after(() => rmSync(root,{ recursive: true,force: true }));
  const opts = options(join(root,"audit.sqlite")); const input = event();
  await killed(`import { SqliteAuditSpool } from ${JSON.stringify(new URL("./spool.js",import.meta.url).href)};
    const s=new SqliteAuditSpool(${JSON.stringify(opts)});s.admit(${JSON.stringify(input)});process.stdout.write('committed');setInterval(()=>{},1000);`);
  await killed(`import { DatabaseSync } from 'node:sqlite';const d=new DatabaseSync(${JSON.stringify(opts.path)});
    d.exec('BEGIN IMMEDIATE;UPDATE spool_state SET tail=99');process.stdout.write('uncommitted');setInterval(()=>{},1000);`);
  const restarted = new SqliteAuditSpool(opts); t.after(() => restarted.close()); assert.deepEqual(restarted.pending(),[input]);
  let calls = 0; const received = new Set<string>();
  await assert.rejects(restarted.replay(async (e) => { received.add(e.eventId);calls++;throw new Error("response lost"); }));
  assert.equal(restarted.status().pending,1);
  const count = await restarted.replay(async (e) => { received.add(e.eventId);calls++;
    return { durable: true,eventId: e.eventId,contentHash: contentHash(e),ingestTime }; });
  assert.equal(count,1); assert.equal(calls,2); assert.equal(received.size,1); assert.equal(restarted.status().pending,0);
  assert.equal(restarted.verify().ordinal,1);
});
test("bound admission, prefix receipt checks, immutable events and append-only correction",async (t) => {
  const root = mkdtempSync(join(tmpdir(),"arbi-spool-")); t.after(() => rmSync(root,{ recursive: true,force: true }));
  const opts = { ...options(join(root,"audit.sqlite")),maxEvents: 1 }; const s = new SqliteAuditSpool(opts); t.after(() => s.close());
  const first = event(); s.admit(first); s.admit(first);
  assert.throws(() => s.append({ ...first,eventId: "same-sequence",links: { ...first.links,intentEventId: "same-sequence" } }),{ code: "CAPACITY" });
  assert.throws(() => s.append({ ...first,sourceTime: { ...first.sourceTime,monotonicMs: 2000 } }),{ code: "CONFLICT" });
  assert.throws(() => s.admit(event("blocked","2")),{ code: "CAPACITY" });
  let stopCalled = false;
  const result = s.localSafetyStop(() => { stopCalled = true;return "stopped"; },() => { assert.ok(stopCalled);return event("stop","2"); });
  assert.deepEqual(result,{ result: "stopped",recorded: false }); assert.equal(s.status().lost,1); assert.equal(s.status().blocked,1);
  assert.throws(() => s.acknowledge({ durable: true,eventId: first.eventId,contentHash: "forged",ingestTime }),{ code: "CONFLICT" });
  assert.equal(s.pending().length,1);
  s.acknowledge({ durable: true,eventId: first.eventId,contentHash: contentHash(first),ingestTime });
  s.admit(event("correction","3")); assert.equal(s.pending()[0].eventId,"correction");
  const d = new DatabaseSync(opts.path); t.after(() => d.close());
  assert.throws(() => d.exec("UPDATE spool_events SET hash='tampered'"));
  d.exec("DROP TRIGGER spool_no_update;UPDATE spool_events SET hash='tampered'");
  assert.throws(() => s.pending(),{ code: "TAMPER" });
  assert.throws(() => s.admit(event("after-tamper","4")),{ code: "TAMPER" });
  assert.equal(s.localSafetyStop(() => "stopped",() => event("after-tamper-stop","5")).recorded,false);
});
test("SQLite page limit produces real SQLITE_FULL; records survive and local stopping stays available",(t) => {
  const root = mkdtempSync(join(tmpdir(),"arbi-spool-")); t.after(() => rmSync(root,{ recursive: true,force: true }));
  const opts = { ...options(join(root,"full.sqlite")),maxEvents: 1000,maxBytes: 10_000_000,maxPages: 32 };
  const s = new SqliteAuditSpool(opts); t.after(() => s.close());
  let i = 1;
  for (;i < 1000;i++) { try { s.admit(event(`intent-${i}`,String(i))); } catch (error) { assert.equal((error as { code: string }).code,"UNAVAILABLE");break; } }
  assert.ok(i > 1 && i < 1000); assert.equal(s.pending(64).length,Math.min(i-1,64));
  const before = s.verify(); let stopped = false;
  assert.equal(s.localSafetyStop(() => { stopped = true; },() => event("full-stop",String(i))).recorded,false);
  assert.ok(stopped);assert.ok(s.status().degraded);assert.deepEqual(s.verify(),before);
  s.close(); const reopen = new SqliteAuditSpool(opts); assert.deepEqual(reopen.verify(),before);reopen.close();
  // close is intentionally called twice by cleanup only if still open.
});
test("uint64 gaps preserve decimal precision and tolerate reordering",() => {
  assert.deepEqual(missingRanges(["3","1","3"]),[{ from: "2",to: "2" }]);
  assert.deepEqual(missingRanges(["1","2","3"]),[]);
  assert.deepEqual(missingRanges(["18446744073709551615"]),[{ from: "1",to: "18446744073709551614" }]);
});
test("successful local safety report follows the callback; unavailable storage exposes volatile losses",(t) => {
  const root = mkdtempSync(join(tmpdir(),"arbi-spool-"));t.after(() => rmSync(root,{ recursive: true,force: true }));
  const s = new SqliteAuditSpool(options(join(root,"stop.sqlite")));t.after(() => s.close());
  const stopIntent = event("stop-intent");stopIntent.action = "control.stop";
  stopIntent.resource = { kind: "device",id: "edge-1",deviceId: "edge-1" };s.admit(stopIntent);
  let stopped = false;
  const result = s.localSafetyStop(() => { stopped = true;return "local-stop-requested"; },() => {
    assert.ok(stopped);
    const report: AuditEvent = { ...structuredClone(fixtures.valid.edge),eventId: "stop-report",sequence: "2",actor: stopIntent.actor,
      action: "control.stop",resource: stopIntent.resource,record: { kind: "local-record",id: "stop-record" },
      links: { ...fixtures.valid.edge.links,intentEventId: stopIntent.eventId,causationEventId: stopIntent.eventId } };
    return report;
  });
  assert.equal(result.recorded,true);assert.equal(s.pending()[1].action,"control.stop");
  s.close();stopped = false;
  assert.equal(s.localSafetyStop(() => { stopped = true; },() => event("stop-unavailable","3")).recorded,false);
  assert.ok(stopped);assert.equal(s.status().volatileLosses,1);assert.equal(s.status().pending,null);
  assert.throws(() => s.admit(event("blocked-unavailable","4")),{ code: "UNAVAILABLE" });assert.equal(s.status().volatileBlocked,1);
});
