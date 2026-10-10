import { randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createServer } from "node:net";

const bin = execFileSync("pg_config", ["--bindir"], { encoding: "utf8" }).trim();
const root = mkdtempSync(join(process.platform === "darwin" ? "/private/tmp" : tmpdir(), "arbi-shell-pg-"));
const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", ARBI_DASHBOARD_PROVIDER: "isolated-test-simulation", ARBI_DASHBOARD_REALM: "test",
  ARBI_DASHBOARD_NAMESPACE: "synthetic-dashboard", ARBI_DASHBOARD_ORIGIN: `http://127.0.0.1:${port}`,
  ARBI_DASHBOARD_TEST_DATABASE_URL: `postgresql://arbi_test@localhost/postgres?host=${encodeURIComponent(root)}&port=54322`,
  ARBI_DASHBOARD_TEST_SIGNING_KEY: randomBytes(32).toString("base64url"), ARBI_DASHBOARD_TEST_ACCESS_CODE: randomBytes(32).toString("base64url"),
  ARBI_DASHBOARD_TEST_VIEWER_CODE: randomBytes(32).toString("base64url") };
delete env.VERCEL; delete env.VERCEL_ENV; delete env.VERCEL_URL;
let started = false, server;
try {
  execFileSync(join(bin, "initdb"), ["-D", join(root, "data"), "-U", "arbi_test", "--auth=trust", "--no-locale", "--encoding=UTF8"], { stdio: "ignore", timeout: 30000 });
  execFileSync(join(bin, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "postgres.log"), "-o", `-k ${root} -p 54322 -c listen_addresses=''`, "-w", "start"], { stdio: "ignore", timeout: 30000 }); started = true;
  execFileSync(process.execPath, ["--import", "tsx", "scripts/provision-dashboard-test.ts"], { env, stdio: "inherit", timeout: 30000 });
  server = spawn(process.execPath, ["--no-experimental-require-module", "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("START_TIMEOUT")), 15000);
    server.on("error", reject); server.on("exit", () => reject(new Error("SERVER_EXIT")));
    server.stdout.on("data", chunk => { if (String(chunk).includes("Ready")) { clearTimeout(timer); resolve(); } });
  });
  execFileSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--config", "playwright.config.ts", ...process.argv.slice(2)], { env, stdio: "inherit", timeout: 120000 });
} catch { process.stderr.write("Dashboard browser checks failed; built app, PostgreSQL tools and Chromium are required.\n"); process.exitCode = 1; }
finally {
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
  if (started) execFileSync(join(bin, "pg_ctl"), ["-D", join(root, "data"), "-w", "-m", "immediate", "stop"], { stdio: "ignore", timeout: 15000 });
  rmSync(root, { recursive: true, force: true });
}
