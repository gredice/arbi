import pg from "pg";
import { isId } from "@arbi/gredice";
import { postgresDatabase } from "../enrollment/store";
import type { DashboardServer } from "./server";
import { createDashboardTestProvider } from "./test-provider";

export const SESSION_COOKIE = "arbi_dashboard_session";
interface DashboardRuntime { server: DashboardServer; login?: (code: string) => Promise<string | null>; revoke?: (token: string) => Promise<void> }
let configured: DashboardRuntime | undefined;
let attempted = false;
/** Live composition supplies the existing trusted provider; it never uses fixture identity. */
export function configureDashboard(runtime: DashboardRuntime) { configured = runtime; }
export function dashboardRuntime(): DashboardRuntime | undefined {
  if (configured || attempted) return configured;
  attempted = true;
  try {
    // Never infer simulator authority from NODE_ENV, a browser mode, an absent provider or a fork build.
    if (process.env.ARBI_DASHBOARD_PROVIDER !== "isolated-test-simulation" || process.env.ARBI_DASHBOARD_REALM !== "test" ||
      process.env.VERCEL_ENV === "production") return undefined;
    const namespaceId = process.env.ARBI_DASHBOARD_NAMESPACE;
    const origin = process.env.ARBI_DASHBOARD_ORIGIN;
    const connectionString = process.env.ARBI_DASHBOARD_TEST_DATABASE_URL;
    const key = process.env.ARBI_DASHBOARD_TEST_SIGNING_KEY;
    const accessCode = process.env.ARBI_DASHBOARD_TEST_ACCESS_CODE;
    if (!isId(namespaceId) || !origin || !connectionString || !key || !accessCode) return undefined;
    const url = new URL(origin);
    if (url.origin !== origin || (url.protocol !== "https:" && !["http://127.0.0.1", "http://localhost"].includes(`${url.protocol}//${url.hostname}`))) return undefined;
    if (process.env.VERCEL && (url.protocol !== "https:" || !new URL(connectionString).hostname.endsWith(".neon.tech"))) return undefined;
    if (!/^[A-Za-z0-9_-]{43,}$/.test(key)) return undefined;
    const pool = new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 1500, statement_timeout: 1500, idleTimeoutMillis: 10_000 });
    const origins = [origin, ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [])];
    configured = createDashboardTestProvider({ realm: { environment: "test", namespaceId }, verificationKey: Buffer.from(key, "base64url"),
      accessCode, viewerCode: process.env.ARBI_DASHBOARD_TEST_VIEWER_CODE, browserOrigins: origins, db: postgresDatabase(pool) });
    return configured;
  } catch { return undefined; }
}
/** Explicit BFF bridge: the HttpOnly ARBI credential is passed to the shared bearer boundary. */
export function dashboardRequest(request: Request): Request {
  const headers = new Headers(request.headers);
  if (!headers.has("authorization")) {
    const token = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    if (token) headers.set("authorization", `Bearer ${token}`);
  }
  return new Request(request.url, { method: request.method, headers });
}
export function unavailable() { return Response.json({ error: "UNAVAILABLE" }, { status: 503, headers: { "cache-control": "private, no-store" } }); }
export function dashboardRoute(request: Request, siteId: string, view: string) {
  return dashboardRuntime()?.server.handle(dashboardRequest(request), siteId, view) ?? Promise.resolve(unavailable());
}
