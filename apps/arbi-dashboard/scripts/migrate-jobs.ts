import { readFile } from "node:fs/promises";
import pg from "pg";
import { postgresDatabase } from "../src/enrollment/store";
// Operator-owned migration credentials; never log private connection values or SQL errors.
const connectionString = process.env.ARBI_JOBS_DATABASE_URL;
if (!connectionString) { process.stderr.write("Jobs database is unprovisioned.\n"); process.exitCode = 1; }
else {
  const pool = new pg.Pool({ connectionString,max: 1,connectionTimeoutMillis: 5000 });
  try {
    const migration = await readFile(new URL("../migrations/0004-jobs.sql",import.meta.url),"utf8");
    await postgresDatabase(pool).transaction(async (sql) => { await sql.query(migration); });
    process.stdout.write("Jobs schema migrated.\n");
  } catch { process.stderr.write("Jobs migration unavailable.\n"); process.exitCode = 1; }
  finally { await pool.end(); }
}
