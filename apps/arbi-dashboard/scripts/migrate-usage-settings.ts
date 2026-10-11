import { readFile } from 'node:fs/promises';
import pg from 'pg';
const connectionString=process.env.ARBI_USAGE_DATABASE_URL;
if(!connectionString)throw Error('Operator usage database configuration required');
const pool=new pg.Pool({connectionString,max:1,connectionTimeoutMillis:1500});
try{await pool.query(await readFile(new URL('../migrations/0009-usage-settings.sql',import.meta.url),'utf8'));console.log('Usage settings/alert migration applied; no settings or notification destinations provisioned.');}finally{await pool.end();}
