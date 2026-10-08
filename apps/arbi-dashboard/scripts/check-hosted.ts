import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { protectHostedPage } from "./hosted-protection";
const target = new URL(process.env.ARBI_HOSTED_URL ?? "");
assert.equal(target.protocol, "https:"); assert.ok(target.hostname.endsWith(".vercel.app"));
const oidc = process.env.VERCEL_OIDC_TOKEN;
// Vercel's pull leaves sensitive preview values empty; use the operator's private file.
const code = process.env.ARBI_DASHBOARD_TEST_ACCESS_CODE || await readFile(new URL("../../../.vercel/ARBI_DASHBOARD_TEST_ACCESS_CODE.txt", import.meta.url), "utf8");
const browser = await chromium.launch();
let stage = "landing", landingStatus: number | undefined;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage(); const errors: string[] = [];
  await protectHostedPage(page, target, oidc);
  page.on("pageerror", error => errors.push(error.name));
  const opened = await page.goto(target.origin); landingStatus = opened?.status(); assert.equal(landingStatus, 200);
  stage = "sign-in";
  await page.getByLabel("Test access code").fill(code);
  await page.getByRole("button", { name: "Open test dashboard" }).click();
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
  assert.match(await page.getByRole("status").innerText(), /SIMULATION · test \/ synthetic-dashboard/);
  assert.equal(await page.getByLabel("Site", { exact: true }).inputValue(), "synthetic-site");
  stage = "protected refresh";
  await page.getByRole("button", { name: "Refresh status" }).click();
  await page.getByText("Position Z", { exact: true }).waitFor();
  await page.screenshot({ path: "/private/tmp/arbi-dashboard-hosted.png", fullPage: true });
  stage = "diagnostics";
  await page.getByRole("link", { name: "Engineering", exact: true }).click();
  await page.getByRole("link", { name: "Diagnostics", exact: true }).click();
  await page.getByRole("row", { name: /line.tension.a/ }).waitFor();
  assert.match(await page.getByRole("row", { name: /line.tension.a/ }).innerText(), /Unavailable/);
  stage = "mobile and alternate sites";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("link", { name: "Images", exact: true }).focus(); await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Camera and images unavailable" }).waitFor();
  await page.getByLabel("Site", { exact: true }).selectOption("synthetic-offline");
  await page.waitForURL("**/synthetic-offline/**");
  assert.match(await page.getByRole("status").innerText(), /offline · stale/);
  await page.getByLabel("Site", { exact: true }).selectOption("synthetic-empty");
  await page.getByRole("heading", { name: "No device is enrolled" }).waitFor();
  assert.equal(await page.locator("video").count(), 0); assert.deepEqual(errors, []);
  stage = "direct scope denial";
  const read = await page.evaluate(async () => {
    const denied = await fetch("/api/sites/other-site/dashboard/context", { cache: "no-store" });
    return denied.status;
  }); assert.equal(read, 403);
  stage = "logout";
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "End session" }).click();
  await page.getByLabel("Test access code").waitFor();
  await page.goto(`${target.origin}/sites/synthetic-site/user/overview`);
  await page.getByRole("heading", { name: "Session expired or unavailable" }).waitFor();
  process.stdout.write("Hosted protected preview: sign-in, current site/mode/realm, HTTPS refresh, diagnostics, mobile/keyboard, offline/no-device, direct scope denial and logout passed.\n");
} catch { process.stderr.write(`Hosted protected dashboard check failed at ${stage} (landing HTTP ${landingStatus ?? "unavailable"}); no credentials or request payloads logged.\n`); process.exitCode = 1; }
finally { await browser.close(); }
