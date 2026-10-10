import { createJobsServer } from '../jobs/server';
import { UsageHttp } from './http';
import { UsageStore } from './store';
export function createUsageServer(config:Parameters<typeof createJobsServer>[0]):UsageHttp {
  const jobs=createJobsServer(config);return new UsageHttp(new UsageStore(jobs.store),jobs.humans);
}
