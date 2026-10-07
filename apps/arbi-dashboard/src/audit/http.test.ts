import assert from "node:assert/strict";
import test from "node:test";
import { AuditHttp } from "./http";
import type { DeviceAuditIngest } from "./ingest";
import { auditRoute } from "./runtime";
test("device HTTP excludes browser authority, bounds body and stays unconfigured by default",async () => {
  let called = false;
  const http = new AuditHttp({ ingest: async () => { called = true;throw new Error(); } } as unknown as DeviceAuditIngest);
  const request = (headers: Record<string,string>,body = "{}") => new Request("https://synthetic.test/api/sites/s/audit/ingest",{ method: "POST",headers: { "content-type": "application/json",...headers },body });
  for (const headers of <Record<string,string>[]>[{ origin: "https://synthetic.test" },{ cookie: "session=opaque" },{ authorization: "Bearer opaque" }]) {
    assert.equal((await http.handle(request(headers),"s")).status,403);
  }
  assert.equal((await http.handle(request({},"x".repeat(12_289)),"s")).status,400);assert.equal(called,false);
  assert.equal((await auditRoute(request({}),"s")).status,503);
});
