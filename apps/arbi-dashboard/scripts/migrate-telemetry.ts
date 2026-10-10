import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { postgresDatabase } from '../src/enrollment/store';
const connectionString=process.env.ARBI_TELEMETRY_DATABASE_URL;
if(!connectionString){process.stderr.write('Telemetry database is unprovisioned.\n');process.exitCode=1;}
else {
  const pool=new pg.Pool({connectionString,max:1,connectionTimeoutMillis:5000});
  try {
    const migration=await readFile(new URL('../migrations/0006-telemetry.sql',import.meta.url),'utf8');
    await postgresDatabase(pool).transaction(async sql=>{await sql.query(migration);});
    process.stdout.write('Telemetry schema migrated.\n');
  } catch {process.stderr.write('Telemetry migration unavailable.\n');process.exitCode=1;}
  finally {await pool.end();}
}
