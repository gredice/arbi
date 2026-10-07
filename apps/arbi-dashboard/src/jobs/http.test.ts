import assert from "node:assert/strict";
import test from "node:test";
import { jobsRoute } from "./runtime";
import { jobView } from "./http";
import { PostgresJobStore } from "./store";
import type { Job } from "./contracts";

test("mounted default job boundary fails closed and never fabricates completion or fixture authority",async () => {
  for (const action of ["submit","device","acquire","renew","release","revoke","cancel","status"]) {
    const r = await jobsRoute(new Request("https://synthetic.test/jobs"),{ siteId: "synthetic-site",action });
    assert.equal(r.status,503);assert.equal(r.headers.get("cache-control"),"private, no-store");
    assert.deepEqual(Object.keys(await r.json()).sort(),["correlationId","error"]);
  }
  const view = jobView({ id: "job",cloudDisposition: "admitted",deviceStatus: null,terminal: null,command: {},expiresAtMs: 1000 } as Job);
  assert.equal(view.deviceStatus,null);assert.equal(view.terminal,null);assert.equal("completed" in view,false);
  assert.throws(() => new PostgresJobStore({ transaction: async () => { throw new Error(); } },{ environment: "production",namespaceId: "real" },async () => null),{ code: "DENIED" });
});
