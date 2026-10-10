import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";

const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
const preview = process.argv.includes("--preview");
if (preview) { env.VERCEL_ENV = "preview"; delete env.VERCEL_TARGET_ENV; }
// This launcher verifies the ordinary secret-free start, even in an operator shell.
for (const name of Object.keys(env)) if (name.startsWith("ARBI_DASHBOARD_")) delete env[name];
const child = spawn(process.execPath, ["--no-experimental-require-module", "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
  { env, stdio: ["ignore", "pipe", "ignore"] });
let timer;
try {
  await new Promise((resolve, reject) => {
    let output = "";
    timer = setTimeout(() => reject(new Error()), 10_000);
    child.on("error", reject); child.on("exit", () => reject(new Error()));
    child.stdout.on("data", (chunk) => { output += chunk; if (output.includes("Ready")) resolve(); });
  });
  clearTimeout(timer);
  for (const [method, path] of [["GET", "enrollment/inventory"], ["POST", "enrollment/challenge"],
    ["POST", "media/upload"], ["POST", "media/complete"], ["POST", "images/synthetic-image/access"], ["GET", "images/synthetic-image/metadata"], ["POST", "audit/ingest"], ["POST", "jobs/acquire"], ["POST", "jobs/renew"], ["POST", "jobs/release"], ["POST", "jobs/revoke"], ["POST", "jobs/submit"], ["POST", "jobs/cancel"], ["GET", "jobs/status?jobId=synthetic-job"], ["POST", "jobs/device"], ["POST", "realtime/attach"], ["POST", "realtime/recover"], ["POST", "realtime/device"]]) {
    const response = await fetch(`http://127.0.0.1:${port}/api/sites/synthetic-site/${path}`, {
      method, signal: AbortSignal.timeout(5_000), ...(method === "POST" ? { headers: { "content-type": "application/json" }, body: "{}" } : {}),
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const body = await response.json();
    assert.equal(body.error, "UNAVAILABLE");
    assert.deepEqual(Object.keys(body).sort(), ["correlationId", "error"]);
  }
  for (const view of ["context", "state", "diagnostics", "releases"]) {
    const response = await fetch(`http://127.0.0.1:${port}/api/sites/synthetic-site/dashboard/${view}`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), { error: "UNAVAILABLE" });
  }
  const login = await fetch(`http://127.0.0.1:${port}/api/dashboard/session`, { method: "POST", headers: { origin: `http://127.0.0.1:${port}` }, body: "code=synthetic", signal: AbortSignal.timeout(5000) });
  assert.equal(login.status, 503); assert.equal(login.headers.get("set-cookie"), null);
  for (const path of ["/", "/sites/synthetic-site/engineering/overview"]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200); const html = await response.text();
    assert.match(html, /Provider unavailable/); assert.doesNotMatch(html, /name="code"/); assert.doesNotMatch(html, /synthetic-engineer/);
    if (preview) assert.match(html, /NONPRODUCTION PREVIEW/);
  }
  process.stdout.write("Built Next.js enrollment/media/audit/jobs/realtime/dashboard boundaries fail closed, with no fixture login or protected site data on the ordinary start.\n");
} catch { process.stderr.write("Built enrollment/media HTTP checks failed.\n"); process.exitCode = 1; }
finally {
  clearTimeout(timer);
  if (child.exitCode === null) { child.kill("SIGTERM"); await once(child, "exit"); }
}
