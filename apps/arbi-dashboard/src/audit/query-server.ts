import { PostgresJobStore } from '../jobs/store';
import { createJobsServer } from '../jobs/server';
import type { SqlDatabase } from '../enrollment/store';
import { SiteRequestBoundary, isResourceScope } from '@arbi/gredice';
import { AuditQueryHttp } from './query-http';
import { AuditQueryStore, type QueryStoreOptions } from './query-store';
export function createAuditQueryServer(config:Parameters<typeof createJobsServer>[0]&{
  queryKey:Uint8Array;lifecycleDb?:SqlDatabase;steward?:QueryStoreOptions['steward'];
}):AuditQueryHttp {
  const jobs=createJobsServer(config);const lifecycle=config.lifecycleDb?new PostgresJobStore(config.lifecycleDb,config.realm,jobs.store.currentAuthority,config.receiverUncertaintyMs):undefined;
  const humans=new SiteRequestBoundary({identity:config.identity,browserOrigins:config.browserOrigins,
    resolveResource:async query=>{const scope=await config.resolveSite(query);return isResourceScope(scope)&&scope.executionMode==='simulation'?scope:null;},
    auditAuthorization:(record,signal)=>jobs.store.authorization(record,signal)});
  return new AuditQueryHttp(new AuditQueryStore(jobs.store,{key:config.queryKey,lifecycle,steward:config.steward}),humans);
}
