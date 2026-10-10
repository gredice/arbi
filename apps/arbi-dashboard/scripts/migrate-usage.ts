import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { postgresDatabase } from '../src/enrollment/store';
const connectionString=process.env.ARBI_USAGE_DATABASE_URL;
if(!connectionString){process.stderr.write('Usage database is unprovisioned.\n');process.exitCode=1;}
else {
  const pool=new pg.Pool({connectionString,max:1,connectionTimeoutMillis:5000});
  try {
    const migration=await readFile(new URL('../migrations/0007-usage.sql',import.meta.url),'utf8');
    await postgresDatabase(pool).transaction(async sql=>{await sql.query(migration);});
    process.stdout.write('Usage schema migrated.\n');
  }catch{process.stderr.write('Usage migration unavailable.\n');process.exitCode=1;}
  finally{await pool.end();}
}
