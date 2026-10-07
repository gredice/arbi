import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";

const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
  { env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "ignore"] });
let timer;
try {
  await new Promise((resolve, reject) => {
    let output = "";
    timer = setTimeout(() => reject(new Error()), 10_000);
    child.on("error", reject); child.on("exit", () => reject(new Error()));
    child.stdout.on("data", (chunk) => { output += chunk; if (output.includes("Ready")) resolve(); });
  });
  clearTimeout(timer);
  for (const [method, action] of [["GET", "inventory"], ["POST", "challenge"]]) {
    const response = await fetch(`http://127.0.0.1:${port}/api/sites/synthetic-site/enrollment/${action}`, {
      method, signal: AbortSignal.timeout(5_000), ...(method === "POST" ? { headers: { "content-type": "application/json" }, body: "{}" } : {}),
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const body = await response.json();
    assert.equal(body.error, "UNAVAILABLE");
    assert.deepEqual(Object.keys(body).sort(), ["correlationId", "error"]);
  }
  process.stdout.write("Built Next.js enrollment routes deny unprovisioned HTTP reads and commissioning.\n");
} catch { process.stderr.write("Built enrollment HTTP checks failed.\n"); process.exitCode = 1; }
finally {
  clearTimeout(timer);
  if (child.exitCode === null) { child.kill("SIGTERM"); await once(child, "exit"); }
}
