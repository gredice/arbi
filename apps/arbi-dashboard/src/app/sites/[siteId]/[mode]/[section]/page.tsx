import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { dashboardRoute } from "../../../../../dashboard/runtime";
import { DashboardShell } from "../../../../../dashboard/shell";
import type { DashboardContext, DashboardMode, DashboardResult } from "../../../../../dashboard/contracts";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ siteId: string; mode: string; section: string }> }) {
  const { siteId, mode, section } = await params;
  if (!["user", "engineering"].includes(mode) || !["overview", "devices", "images", "activity", "diagnostics", "live"].includes(section)) notFound();
  const incoming = await headers();
  // URL is an internal composition address, never an outgoing fetch or user-selected upstream.
  const response = await dashboardRoute(new Request(`http://localhost/api/sites/${encodeURIComponent(siteId)}/dashboard/context`, { headers: incoming }), siteId, section === "diagnostics" ? "diagnostics" : "context");
  const body = await response.json();
  const result: DashboardResult = response.ok ? { ok: true, context: body as DashboardContext } : { ok: false, status: response.status, error: body.error };
  return <DashboardShell key={`${siteId}:${mode}:${section}`} siteId={siteId} mode={mode as DashboardMode} section={section} initial={result} />;
}
