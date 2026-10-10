import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { SqlDatabase, SqlSession } from '../enrollment/store';
import { migrations, commonTests } from './test-support';
test('usage ingestion and billing periods on embedded PostgreSQL',{timeout:45000},async t=>{
  const pg=new PGlite();await pg.waitReady;t.after(()=>pg.close());
  const session=(client:Pick<PGlite,'query'|'exec'>):SqlSession=>({async query<T extends Record<string,unknown>>(query:string,params?:unknown[]){
    const rows=params?(await client.query<T>(query,params)).rows:(await client.exec(query)).at(-1)?.rows??[];return {rows:rows as T[]};
  }});
  const sql=session(pg),db:SqlDatabase={transaction:work=>pg.transaction(tx=>work(session(tx)))};
  await migrations(sql);await commonTests(t,db,sql,false);
});
