import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Own a fresh cluster/socket directory. Never connect to or stop an existing database.
const bin = execFileSync("pg_config", ["--bindir"], { encoding: "utf8", timeout: 5_000 }).trim();
const root = mkdtempSync(join(process.platform === "darwin" ? "/private/tmp" : tmpdir(), "arbi-enrollment-pg-"));
const data = join(root, "data");
let started = false;
try {
  execFileSync(join(bin, "initdb"), ["-D", data, "-U", "arbi_test", "--auth=trust", "--no-locale", "--encoding=UTF8"],
    { stdio: "ignore", timeout: 30_000 });
  execFileSync(join(bin, "pg_ctl"), ["-D", data, "-l", join(root, "postgres.log"), "-o", `-k ${root} -p 54321 -c listen_addresses=''`, "-w", "start"],
    { stdio: "ignore", timeout: 30_000 });
  started = true;
  execFileSync(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1", "src/enrollment/postgres.test.ts", "src/media/postgres.test.ts", "src/audit/postgres.test.ts", "src/jobs/postgres.test.ts"],
    { stdio: "inherit", timeout: 60_000, env: { ...process.env, ARBI_ENROLLMENT_TEST_SOCKET: root } });
} catch {
  process.stderr.write("Isolated PostgreSQL enrollment/media checks failed; pg_config/initdb/pg_ctl and local socket access are required.\n");
  process.exitCode = 1;
} finally {
  if (started) execFileSync(join(bin, "pg_ctl"), ["-D", data, "-w", "-m", "immediate", "stop"], { stdio: "ignore", timeout: 15_000 });
  rmSync(root, { recursive: true, force: true });
}
