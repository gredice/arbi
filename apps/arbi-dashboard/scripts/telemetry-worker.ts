import pg from 'pg';
import { isId } from '@arbi/gredice';
import { postgresDatabase } from '../src/enrollment/store';
import { PostgresJobStore } from '../src/jobs/store';
import { TelemetryStore } from '../src/telemetry/store';
const connectionString=process.env.ARBI_TELEMETRY_DATABASE_URL,siteId=process.env.ARBI_TELEMETRY_SITE_ID,
  namespaceId=process.env.ARBI_TELEMETRY_NAMESPACE,environment=process.env.ARBI_TELEMETRY_ENVIRONMENT;
if(!connectionString || !isId(siteId) || !isId(namespaceId) || (environment!=='test' && environment!=='preview')) {
  process.stderr.write('Telemetry maintenance is unprovisioned.\n');process.exitCode=1;
} else {
  const pool=new pg.Pool({connectionString,max:1,connectionTimeoutMillis:5000});
  try {
    const store=new TelemetryStore(new PostgresJobStore(postgresDatabase(pool),{environment,namespaceId},async()=>null));
    await store.maintain(siteId);process.stdout.write('Bounded site telemetry retention maintained.\n');
  } catch {process.stderr.write('Telemetry maintenance unavailable.\n');process.exitCode=1;}
  finally {await pool.end();}
}
