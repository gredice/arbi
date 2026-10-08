import { test, expect } from "@playwright/test";
import pg from "pg";
import { createServer } from "node:http";
import { once } from "node:events";
import { protectHostedPage } from "../scripts/hosted-protection";
const origin = process.env.ARBI_DASHBOARD_ORIGIN!;
async function login(page: import("@playwright/test").Page, viewer = false) {
  await page.goto("/");
  await page.getByLabel("Test access code").fill(process.env[viewer ? "ARBI_DASHBOARD_TEST_VIEWER_CODE" : "ARBI_DASHBOARD_TEST_ACCESS_CODE"]!);
  await page.getByRole("button", { name: "Open test dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("SIMULATION · test / synthetic-dashboard");
}
test("protected login and every operational screen retain site, realm, mode and connection", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await login(page);
  for (const name of ["Devices", "Images", "Activity", "Live readiness", "Overview"]) {
    await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page.getByLabel("Site", { exact: true })).toHaveValue("synthetic-site");
    await expect(page.getByRole("status")).toContainText("User mode · connected · fresh");
  }
  await page.getByRole("link", { name: "Engineering", exact: true }).click();
  await page.getByRole("link", { name: "Diagnostics", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Engineering mode");
  await expect(page.getByRole("row", { name: /line.tension.a/ }).getByRole("cell")).toContainText("Unavailable");
  await expect(page.getByRole("button", { name: /capture|motion|play|record/i })).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("browser offline and elapsed session lifetime remove displayed values", async ({ page, context }) => {
  await page.clock.install(); await login(page);
  await page.clock.fastForward(301000);
  await expect(page.getByRole("heading", { name: "Session expired or unavailable" })).toBeVisible();
  await expect(page.getByText("Position Z", { exact: true })).toHaveCount(0);
  await page.clock.setSystemTime(Date.now()); await login(page);
  await context.setOffline(true);
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  await expect(page.getByText("Position Z", { exact: true })).toHaveCount(0);
  await context.setOffline(false);
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(page.getByText("Position Z", { exact: true })).toBeVisible();
});
test("responsive keyboard navigation reaches status and explicit unavailable operations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page);
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).resolves.toBe(true);
  await page.keyboard.press("Tab"); await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter"); await expect(page.locator("#content")).toBeFocused();
  await page.getByRole("button", { name: "Menu", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Menu", exact: true })).toHaveAttribute("aria-expanded", "true");
  const images = page.getByRole("link", { name: "Images", exact: true }); await images.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Camera and images unavailable" })).toBeVisible();
  await page.screenshot({ path: "test-results/shell-mobile.png", fullPage: true });
});
test("site changes show offline/stale/no-device and never retain another site's values", async ({ page }) => {
  await login(page);
  await page.getByLabel("Site", { exact: true }).selectOption("synthetic-offline");
  await expect(page.getByRole("status")).toContainText("offline · stale");
  await expect(page.getByText("stale (was estimated)").first()).toBeVisible();
  await page.getByLabel("Site", { exact: true }).selectOption("synthetic-stale");
  await expect(page.getByRole("status")).toContainText("connected · stale");
  await page.getByLabel("Site", { exact: true }).selectOption("synthetic-empty");
  await expect(page.getByRole("heading", { name: "No device is enrolled" })).toBeVisible();
  await expect(page.getByText("Position Z", { exact: true })).toHaveCount(0);
});
test("loading, dependency failure, forbidden and session expiry clear previously authorized data", async ({ page }) => {
  await login(page);
  let resolve!: () => void; const pause = new Promise<void>(r => { resolve = r; });
  await page.route("**/dashboard/context", async route => { await pause; await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "UNAVAILABLE" }) }); });
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(page.getByRole("heading", { name: "Loading site…" })).toBeVisible();
  await expect(page.getByText("Position Z", { exact: true })).toHaveCount(0);
  resolve(); await expect(page.getByRole("heading", { name: "Provider unavailable" })).toBeVisible();
  await page.unroute("**/dashboard/context"); await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(page.getByText("Position Z", { exact: true })).toBeVisible();
  for (const status of [403, 401]) {
    await page.route("**/dashboard/context", route => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: status === 401 ? "EXPIRED_SESSION" : "FORBIDDEN" }) }));
    await page.getByRole("button", { name: "Refresh status" }).click();
    await expect(page.getByRole("heading", { name: status === 401 ? "Session expired or unavailable" : "Site access forbidden" })).toBeVisible();
    await expect(page.getByText("Position Z", { exact: true })).toHaveCount(0);
    await page.unroute("**/dashboard/context");
  }
});
test("direct HTTP rejects site/role spoofing, diagnostics escalation and current revocation", async ({ page, request }) => {
  await login(page, true);
  const unauthorized = await request.get(`${origin}/api/sites/synthetic-site/dashboard/context`); expect(unauthorized.status()).toBe(401);
  const denied = await page.request.get(`${origin}/api/sites/synthetic-offline/dashboard/context`, { headers: { "x-arbi-role": "engineer", "x-arbi-account": "another-account" } }); expect(denied.status()).toBe(403);
  expect((await page.request.get(`${origin}/api/sites/synthetic-site/dashboard/diagnostics`)).status()).toBe(403);
  await page.goto("/sites/synthetic-site/engineering/diagnostics");
  await expect(page.getByRole("heading", { name: "Site access forbidden" })).toBeVisible();
  const data = await (await page.request.get(`${origin}/api/sites/synthetic-site/dashboard/context`)).json();
  expect(data.capabilities).not.toContain("manipulation.request"); expect(data.identity.actorId).toBe("synthetic-viewer");
  // Private ephemeral fixture database only; no test HTTP mutation/backdoor endpoint exists.
  const db = new pg.Pool({ connectionString: process.env.ARBI_DASHBOARD_TEST_DATABASE_URL, max: 1 });
  try { await db.query("UPDATE arbi_dashboard_sessions SET revoked=true WHERE namespace_id=$1 AND id=$2", ["synthetic-dashboard", data.identity.sessionId]); }
  finally { await db.end(); }
  expect((await page.request.get(`${origin}/api/sites/synthetic-site/dashboard/context`)).status()).toBe(401);
  expect((await page.request.post(`${origin}/api/sites/synthetic-site/jobs/submit`, { data: { actor: { kind: "human", id: "synthetic-engineer" }, mode: "engineering" } })).status()).toBe(503);
});
test("hosted protection stays on the selected origin across native redirect hops", async ({ page, context }) => {
  let received = 0, leaked = false, protectedRequests = 0;
  const external = createServer((request, response) => {
    received++; leaked ||= Boolean(request.headers["x-vercel-trusted-oidc-idp-token"]);
    response.end("External synthetic origin");
  });
  external.listen(0, "127.0.0.1"); await once(external, "listening");
  const other = `http://127.0.0.1:${(external.address() as import("node:net").AddressInfo).port}`;
  const selected = createServer((request, response) => {
    if (request.headers["x-vercel-trusted-oidc-idp-token"] === "synthetic-protection-token") protectedRequests++;
    if (request.url === "/redirect") { response.writeHead(302, { location: "/hop" }); response.end(); }
    else if (request.url === "/hop") { response.writeHead(302, { location: other }); response.end(); }
    else response.end("Selected synthetic origin");
  });
  selected.listen(0, "127.0.0.1"); await once(selected, "listening");
  const target = new URL(`http://127.0.0.1:${(selected.address() as import("node:net").AddressInfo).port}`);
  try {
    await protectHostedPage(page, target, "synthetic-protection-token");
    expect((await page.goto(target.origin))?.status()).toBe(200);
    expect((await page.goto(`${target.origin}/redirect`))?.status()).toBe(200);
    expect(protectedRequests).toBeGreaterThanOrEqual(3); expect(received).toBeGreaterThan(0); expect(leaked).toBe(false);
    expect((await page.goto(other))?.status()).toBe(200);
    expect(received).toBeGreaterThan(0); expect(leaked).toBe(false);
  } finally {
    await context.close();
    await Promise.all([selected, external].map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  }
});
