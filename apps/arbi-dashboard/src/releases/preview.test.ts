import assert from "node:assert/strict";
import { test } from "node:test";
import { configureEnrollment, enrollmentRoute } from "../enrollment/runtime";
import { configureMedia, mediaRoute } from "../media/runtime";
import { configureJobs, jobsRoute } from "../jobs/runtime";
import { configureRealtime, realtimeRoute } from "../realtime/runtime";
import { configureAudit, auditRoute } from "../audit/runtime";
import { dashboardRuntime, configureDashboard } from "../dashboard/runtime";

test("a Vercel branch preview denies installed provider adapters before any production resource call", async () => {
  const previous = process.env.VERCEL_ENV, target = process.env.VERCEL_TARGET_ENV;
  process.env.VERCEL_ENV = "preview"; delete process.env.VERCEL_TARGET_ENV;
  let calls = 0;
  const forbidden = { handle: async () => { calls++; throw new Error("PRODUCTION_CALLED"); } };
  configureEnrollment(forbidden as unknown as Parameters<typeof configureEnrollment>[0]);
  configureMedia(forbidden as unknown as Parameters<typeof configureMedia>[0]);
  configureJobs(forbidden as unknown as Parameters<typeof configureJobs>[0]);
  configureRealtime(forbidden as unknown as Parameters<typeof configureRealtime>[0]);
  configureAudit(forbidden as unknown as Parameters<typeof configureAudit>[0]);
  configureDashboard({ server: forbidden } as unknown as Parameters<typeof configureDashboard>[0]);
  try {
    const request = new Request("https://preview.invalid/api/sites/production-site/jobs/submit", { method: "POST" });
    for (const response of await Promise.all([enrollmentRoute(request, { siteId: "production-site", action: "challenge" }),
      mediaRoute(request, { siteId: "production-site", action: "upload" }), jobsRoute(request, { siteId: "production-site", action: "submit" }),
      realtimeRoute(request, { siteId: "production-site", action: "device" }), auditRoute(request, "production-site")])) {
      assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "private, no-store");
    }
    assert.equal(dashboardRuntime(), undefined); assert.equal(calls, 0);
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous;
    if (target === undefined) delete process.env.VERCEL_TARGET_ENV; else process.env.VERCEL_TARGET_ENV = target;
  }
});
