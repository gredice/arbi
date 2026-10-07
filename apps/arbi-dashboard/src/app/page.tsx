import { dashboardRuntime } from "../dashboard/runtime";
import { Brand } from "../dashboard/brand";
export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const runtime = dashboardRuntime();
  const denied = (await searchParams).session === "denied";
  return <main className="welcome"><Brand />
    <div className="welcome-card"><p className="eyebrow">Automatic raised bed imaging</p><h1>A clearer view of your garden.</h1>
      <p>Site status, available observations and engineering context in one place.</p>
      <div className="notice"><strong>{runtime ? "Isolated test application" : "Provider unavailable"}</strong><p>{runtime ? "Synthetic sites only. No physical devices, live camera or motion authority." : "Identity, current site membership and durable audit must be configured before any site can be opened."}</p></div>
      {runtime?.login ? <form action="/api/dashboard/session" method="post"><label htmlFor="code">Test access code</label>
        <input id="code" name="code" type="password" autoComplete="current-password" required maxLength={256} />
        {denied && <p role="alert">Access denied. Use the code provisioned for this isolated test application.</p>}
        <button type="submit">Open test dashboard <span aria-hidden="true">→</span></button></form> : <p role="status">Sign-in unavailable. No site data has been loaded.</p>}
    </div><p className="fine">Source and simulation evidence do not establish physical safety or installation acceptance.</p>
  </main>;
}
