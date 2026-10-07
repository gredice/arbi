import { readFile } from "node:fs/promises";
import pg from "pg";
import { postgresDatabase } from "../src/enrollment/store";

// Explicit manual operation. No configuration, URL or provider errors are logged.
const connectionString = process.env.ARBI_ENROLLMENT_DATABASE_URL;
if (!connectionString) { process.stderr.write("Enrollment database is unprovisioned.\n"); process.exitCode = 1; }
else {
  const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000 });
  try {
    const sql = await readFile(new URL("../migrations/0001-enrollment.sql", import.meta.url), "utf8");
    await postgresDatabase(pool).transaction(async (connection) => { await connection.query(sql); });
    process.stdout.write("Enrollment schema migrated.\n");
  } catch { process.stderr.write("Enrollment migration unavailable.\n"); process.exitCode = 1; }
  finally { await pool.end(); }
}
