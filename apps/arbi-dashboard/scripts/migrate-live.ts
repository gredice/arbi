import {readFile} from 'node:fs/promises';
import pg from 'pg';
const connectionString=process.env.ARBI_DATABASE_URL;if(!connectionString)throw Error('ARBI_DATABASE_URL required');
const pool=new pg.Pool({connectionString,max:1});
try{await pool.query(await readFile(new URL('../migrations/0011-live.sql',import.meta.url),'utf8'));process.stdout.write('Live-session additive schema applied. No producer or deployment authority enabled.\n');}
catch{process.stderr.write('Live-session migration failed; verify the private operator connection and prerequisite migrations.\n');process.exitCode=1;}
finally{await pool.end();}
