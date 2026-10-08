import pg from "pg";
import { postgresDatabase } from "../src/enrollment/store";
import { provisionDashboardTest } from "../src/dashboard/provision-test";
import { isId } from "@arbi/gredice";

const connectionString = process.env.ARBI_DASHBOARD_TEST_DATABASE_URL;
const namespaceId = process.env.ARBI_DASHBOARD_NAMESPACE;
if (!connectionString || !isId(namespaceId) || process.env.ARBI_DASHBOARD_REALM !== "test") {
  process.stderr.write("Dedicated dashboard test database/realm is unprovisioned.\n"); process.exitCode = 1;
} else {
  const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 2000 });
  try { await provisionDashboardTest(postgresDatabase(pool), { environment: "test", namespaceId }); process.stdout.write("Synthetic dashboard directory and required audit schema provisioned.\n"); }
  catch { process.stderr.write("Dashboard test provisioning failed; use a dedicated empty database.\n"); process.exitCode = 1; }
  finally { await pool.end(); }
}
