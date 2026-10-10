import { createJobsServer } from '../jobs/server';
import { TelemetryHttp } from './http';
import { TelemetryStore } from './store';

/** Reuses the trusted current site/account resolver, authorization audit and inventory-first transaction boundary. */
export function createTelemetryServer(config:Parameters<typeof createJobsServer>[0]):TelemetryHttp {
  const jobs=createJobsServer(config);
  return new TelemetryHttp(new TelemetryStore(jobs.store),jobs.humans);
}
