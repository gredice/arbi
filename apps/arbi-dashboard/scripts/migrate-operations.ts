import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { isRealm, isId } from '@arbi/gredice';
import { postgresOperatorDatabase } from '../src/enrollment/store';
const connectionString=process.env.ARBI_OPERATIONS_DATABASE_URL,role=process.env.ARBI_OPERATIONS_DATABASE_ROLE;
const realm={environment:process.env.ARBI_OPERATIONS_REALM,namespaceId:process.env.ARBI_OPERATIONS_NAMESPACE};
let pool:pg.Pool|undefined;
try{
  if(!connectionString||!isRealm(realm)||!isId(role))throw Error();const url=new URL(connectionString);
  if(!['postgres:','postgresql:'].includes(url.protocol)||!url.pathname||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&url.searchParams.get('sslmode')!=='verify-full')throw Error();
  pool=new pg.Pool({connectionString,max:1,connectionTimeoutMillis:5000});
  await postgresOperatorDatabase(pool).transaction(async sql=>{
    const user=(await sql.query<{name:string}>('SELECT current_user::text name')).rows[0];if(user.name!==role)throw Error();
    const foreign=Number((await sql.query<{n:string}>('SELECT count(*)::text n FROM arbi_device_registry WHERE environment<>$1 OR namespace_id<>$2',[realm.environment,realm.namespaceId])).rows[0].n);if(foreign)throw Error();
    await sql.query(await readFile(new URL('../migrations/0010-operations.sql',import.meta.url),'utf8'));
  });
  process.stdout.write('Owner operations schema migrated; existing quarantine preserved.\n');
}catch{process.stderr.write('Operations migration unavailable or private role/realm configuration invalid.\n');process.exitCode=1;}
finally{await pool?.end();}
