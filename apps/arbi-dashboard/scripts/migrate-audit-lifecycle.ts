import { readFile } from 'node:fs/promises';
import pg from 'pg';
const connectionString=process.env.ARBI_AUDIT_LIFECYCLE_DATABASE_URL;
if(!connectionString)throw Error('Operator lifecycle migration database configuration required');
const pool=new pg.Pool({connectionString,max:1,connectionTimeoutMillis:1500});
try{await pool.query(await readFile(new URL('../migrations/0008-audit-lifecycle.sql',import.meta.url),'utf8'));console.log('Audit lifecycle migration applied; no retention sweep or role grants performed.');}finally{await pool.end();}
