import { randomBytes,randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync,writeFileSync,readFileSync,mkdirSync } from "node:fs";
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
  ARBI_DASHBOARD_TEST_VIEWER_CODE: randomBytes(32).toString("base64url"),ARBI_DASHBOARD_TEST_OPERATOR_CODE:randomBytes(32).toString('base64url') };
env.ARBI_PLAYGROUND_FAULT_PATH=join(root,'protocol-fault.json');env.ARBI_PLAYGROUND_TRACE_PATH=join(root,'protocol-trace.json');
writeFileSync(env.ARBI_PLAYGROUND_FAULT_PATH,JSON.stringify({version:'arbi.playground-fault/1.0',revision:randomUUID(),mode:'normal',untilMs:null}),{mode:0o600});
delete env.VERCEL; delete env.VERCEL_ENV; delete env.VERCEL_URL;
const updateReservation=createServer();updateReservation.listen(0,'127.0.0.1');await once(updateReservation,'listening');const updatePort=updateReservation.address().port;await new Promise(resolve=>updateReservation.close(resolve));
env.ARBI_DASHBOARD_TEST_UPDATE_CODE=randomBytes(32).toString('base64url');env.ARBI_DASHBOARD_UPDATE_ORIGIN=`http://127.0.0.1:${updatePort}`;env.ARBI_DASHBOARD_UPDATE_CREDENTIAL=`Bearer ${randomBytes(32).toString('base64url')}`;env.ARBI_UPDATE_FAULT_PATH=join(root,'update-fault.json');
writeFileSync(env.ARBI_UPDATE_FAULT_PATH,JSON.stringify({version:'arbi.update-browser-fault/1.0',revision:randomUUID(),mode:'normal'}),{mode:0o600});
let started = false, server,controller,updates;
try {
  execFileSync(join(bin, "initdb"), ["-D", join(root, "data"), "-U", "arbi_test", "--auth=trust", "--no-locale", "--encoding=UTF8"], { stdio: "ignore", timeout: 30000 });
  execFileSync(join(bin, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "postgres.log"), "-o", `-k ${root} -p 54322 -c listen_addresses=''`, "-w", "start"], { stdio: "ignore", timeout: 30000 }); started = true;
  execFileSync(process.execPath, ["--import", "tsx", "scripts/provision-dashboard-test.ts"], { env, stdio: "inherit", timeout: 30000 });
  updates=spawn(process.execPath,['--import','tsx','scripts/update-worker.ts'],{env,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('UPDATES_TIMEOUT')),12000);updates.once('error',reject);updates.once('exit',()=>reject(Error('UPDATES_EXIT')));updates.stdout.on('data',chunk=>{if(String(chunk).includes('UPDATES_READY')){clearTimeout(timer);resolve();}});});
  server = spawn(process.execPath, ["--no-experimental-require-module", "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("START_TIMEOUT")), 15000);
    server.on("error", reject); server.on("exit", () => reject(new Error("SERVER_EXIT")));
    server.stdout.on("data", chunk => { if (String(chunk).includes("Ready")) { clearTimeout(timer); resolve(); } });
  });
  controller=spawn(process.execPath,['--import','tsx','scripts/playground-worker.ts'],{env,stdio:['ignore','pipe','pipe']});
  controller.stderr.on('data',chunk=>{const match=String(chunk).match(/ISOLATED_PLAYGROUND_FAILED(?: (?:composition|scope|network|(?:snapshot|poll|outcome|ingest)-[0-9]{3}))?/);if(match)process.stderr.write(`${match[0]}\n`);});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('CONTROLLER_TIMEOUT')),12000);controller.on('error',reject);controller.on('exit',()=>reject(new Error('CONTROLLER_EXIT')));
    controller.stdout.on('data',chunk=>{if(String(chunk).includes('PLAYGROUND_READY')){clearTimeout(timer);resolve();}});});
  execFileSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--config", "playwright.config.ts", ...process.argv.slice(2)], { env, stdio: "inherit", timeout: 180000 });
  mkdirSync('test-results',{recursive:true});writeFileSync('test-results/protocol-trace.json',readFileSync(env.ARBI_PLAYGROUND_TRACE_PATH),{mode:0o600});
} catch { process.stderr.write("Dashboard browser checks failed; built app, PostgreSQL tools and Chromium are required.\n"); process.exitCode = 1; }
finally {
  if(updates&&updates.exitCode===null){updates.kill('SIGTERM');await once(updates,'exit');}
  if(controller&&controller.exitCode===null){controller.kill('SIGTERM');await once(controller,'exit');}
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
  if (started) execFileSync(join(bin, "pg_ctl"), ["-D", join(root, "data"), "-w", "-m", "immediate", "stop"], { stdio: "ignore", timeout: 15000 });
  rmSync(root, { recursive: true, force: true });
}
