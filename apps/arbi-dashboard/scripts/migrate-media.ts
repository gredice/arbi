import { readFile } from "node:fs/promises";
import pg from "pg";
import { postgresDatabase } from "../src/enrollment/store";

// Explicit operator operation; never log connection strings or provider errors.
const connectionString = process.env.ARBI_MEDIA_DATABASE_URL;
if (!connectionString) { process.stderr.write("Media database is unprovisioned.\n"); process.exitCode = 1; }
else {
  const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000 });
  try {
    const migration = await readFile(new URL("../migrations/0002-media.sql", import.meta.url), "utf8");
    await postgresDatabase(pool).transaction(async (sql) => { await sql.query(migration); });
    process.stdout.write("Media schema migrated.\n");
  } catch { process.stderr.write("Media migration unavailable.\n"); process.exitCode = 1; }
  finally { await pool.end(); }
}
