import { readFile } from "node:fs/promises";
import type { Realm } from "@arbi/protocol";
import type { SqlDatabase } from "../enrollment/store";
import { PostgresRegistryStore } from "../enrollment/store";
import { VERSION } from "../enrollment/contracts";
import { simulationSites } from "./simulator";
import { provisionDashboardHistory } from './history-fixture';

/** Operator-only setup of a dedicated empty synthetic database; never called on app startup. */
export async function provisionDashboardTest(db: SqlDatabase, realm: Realm, options:{history?:boolean;updater?:boolean}={}) {
  if (realm.environment !== "test") throw new Error("DENIED");
  for (const file of ["0001-enrollment.sql", "0002-media.sql", "0003-audit.sql", "0004-jobs.sql", "0005-realtime.sql", "0006-telemetry.sql", "0006-dashboard.sql", "0007-usage.sql", "0008-audit-lifecycle.sql", "0009-usage-settings.sql", "0010-operations.sql", "0011-live.sql", "0012-media-audit.sql", "0013-command-attempts.sql"]) {
    const sql = await readFile(new URL(`../../migrations/${file}`, import.meta.url), "utf8");
    await db.transaction(async connection => { await connection.query(sql); });
  }
  const store = new PostgresRegistryStore(db);
  for (const site of simulationSites) {
    await store.provision({ version: VERSION, realm, siteId: site.id, accountId: "synthetic-account", configRevision: "config-1", hardwareDigest: "synthetic-dashboard-no-devices", components: [], signals: [], devices: [], challenges: [] });
    await db.transaction(async sql => {
      await sql.query("INSERT INTO arbi_dashboard_sites VALUES ($1,$2,$3,$4)", [realm.namespaceId, site.id, "synthetic-account", site.name]);
      await sql.query("INSERT INTO arbi_dashboard_memberships VALUES ($1,$2,$3,true,$4,$5::jsonb)", [realm.namespaceId, site.id, "synthetic-engineer", "membership-1", JSON.stringify(["engineer"])]);
      await sql.query("INSERT INTO arbi_dashboard_memberships VALUES ($1,$2,$3,$4,$5,$6::jsonb)", [realm.namespaceId, site.id, "synthetic-viewer", site.id === "synthetic-site", "membership-1", JSON.stringify(["viewer"])]);
      await sql.query("INSERT INTO arbi_dashboard_memberships VALUES ($1,$2,$3,$4,$5,$6::jsonb)", [realm.namespaceId, site.id, "synthetic-operator", ['synthetic-site','synthetic-controls'].includes(site.id), "membership-1", JSON.stringify(["operator"])]);
      if(options.updater)await sql.query("INSERT INTO arbi_dashboard_memberships VALUES ($1,$2,$3,$4,$5,$6::jsonb)", [realm.namespaceId, site.id, "synthetic-updater", site.id==='synthetic-site', "membership-1", JSON.stringify(["update-admin","engineer"])]);
    });
  }
  // Durable signed history requires native PostgreSQL/WAL, not embedded source fixtures.
  if(options.history)await provisionDashboardHistory(db,realm);
}
