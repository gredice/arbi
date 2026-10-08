import { readFile } from "node:fs/promises";
import type { Realm } from "@arbi/protocol";
import type { SqlDatabase } from "../enrollment/store";
import { PostgresRegistryStore } from "../enrollment/store";
import { VERSION } from "../enrollment/contracts";
import { simulationSites } from "./simulator";

/** Operator-only setup of a dedicated empty synthetic database; never called on app startup. */
export async function provisionDashboardTest(db: SqlDatabase, realm: Realm) {
  if (realm.environment !== "test") throw new Error("DENIED");
  for (const file of ["0001-enrollment.sql", "0002-media.sql", "0003-audit.sql", "0006-dashboard.sql"]) {
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
    });
  }
}
