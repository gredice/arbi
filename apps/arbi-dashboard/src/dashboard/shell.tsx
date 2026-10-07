"use client";
import { useEffect, useRef, useState } from "react";
import { DASHBOARD_VERSION, displayedSample, freshness } from "./contracts";
import type { DashboardContext, DashboardMode, DashboardResult } from "./contracts";
import { Brand } from "./brand";

const sections = [{ id: "overview", name: "Overview", icon: "◫" }, { id: "devices", name: "Devices", icon: "◇" },
  { id: "images", name: "Images", icon: "▧" }, { id: "activity", name: "Activity", icon: "≋" }, { id: "live", name: "Live readiness", icon: "○" }, { id: "diagnostics", name: "Diagnostics", icon: "⌁" }];
export function DashboardShell({ siteId, mode, section, initial }: { siteId: string; mode: DashboardMode; section: string; initial: DashboardResult }) {
  const [result, setResult] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const context = result.ok ? result.context : null;
  const base = `/sites/${encodeURIComponent(siteId)}/${mode}`;
  useEffect(() => {
    const update = () => { setNow(Date.now()); };
    const hide = () => { pending.current?.abort(); setResult({ ok: false, status: 0, error: "LOADING" }); };
    const show = (event: PageTransitionEvent) => { update(); if (event.persisted) hide(); };
    const offline = () => { pending.current?.abort(); setResult({ ok: false, status: 0, error: "OFFLINE" }); setLoading(false); };
    const timer = setInterval(update, 1000);
    addEventListener("offline", offline);
    addEventListener("pageshow", show);
    addEventListener("pagehide", hide);
    return () => { clearInterval(timer); removeEventListener("offline", offline); removeEventListener("pageshow", show); removeEventListener("pagehide", hide); pending.current?.abort(); };
  }, []);
  // Credentials and site data never enter localStorage, client caches or shared layout state.
  const expired = context !== null && now >= context.identity.expiresAtMs;
  const visible = expired ? null : context;
  async function refresh() {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    setResult({ ok: false, status: 0, error: "LOADING" }); setLoading(true);
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/dashboard/${section === "diagnostics" ? "diagnostics" : "context"}`, { cache: "no-store", signal: controller.signal });
      const body = await response.json();
      if (controller.signal.aborted) return;
      if (response.ok && (body.version !== DASHBOARD_VERSION || body.site?.id !== siteId ||
        (initial.ok && (body.realm?.environment !== initial.context.realm.environment || body.realm?.namespaceId !== initial.context.realm.namespaceId || body.identity?.sessionId !== initial.context.identity.sessionId)))) throw new Error();
      setResult(response.ok ? { ok: true, context: body } : { ok: false, status: response.status, error: body.error });
    } catch { if (controller.signal.aborted && !navigator.onLine) setResult({ ok: false, status: 0, error: "OFFLINE" }); else setResult({ ok: false, status: 503, error: "UNAVAILABLE" }); }
    finally { clearTimeout(timeout); pending.current = null; setLoading(false); setNow(Date.now()); }
  }
  function navigate(href: string) { pending.current?.abort(); setResult({ ok: false, status: 0, error: "LOADING" }); location.assign(href); }
  const status = visible ? freshness(visible.state, now) : "unavailable";
  return <div className="dashboard"><a className="skip-link" href="#content">Skip to content</a>
    <aside id="primary-navigation" className={`sidebar ${menuOpen ? "is-open" : ""}`}><Brand />
      <p className="nav-label">Workspace</p><nav aria-label="Primary navigation">{sections.filter(item => item.id !== "diagnostics" || mode === "engineering").map(item => <a key={item.id} href={`${base}/${item.id}`} aria-current={section === item.id ? "page" : undefined} onClick={() => setMenuOpen(false)}><span aria-hidden="true">{item.icon}</span>{item.name}</a>)}</nav>
      <div className="sidebar-note"><span className="dot" /><strong>Local safety stays local</strong><p>Cloud status cannot establish a safe physical state.</p></div>
      <form action="/api/dashboard/session" method="post"><input type="hidden" name="action" value="logout" /><button className="quiet" type="submit">End session</button></form>
    </aside>
    <div className="workspace"><header className="topbar"><button className="menu-button quiet" aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
      <div id="mobile-navigation" className="context-controls"><div className="site-control"><label htmlFor="site-selector">Site</label><select id="site-selector" value={siteId} disabled={!visible} onChange={e => navigate(`/sites/${encodeURIComponent(e.target.value)}/${mode}/${section}`)}>{visible ? visible.sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>) : <option value={siteId}>Access check required</option>}</select></div>
        <nav className="mode-switch" aria-label="Display mode"><a href={`/sites/${encodeURIComponent(siteId)}/user/overview`} aria-current={mode === "user" ? "page" : undefined}>User</a><a href={`/sites/${encodeURIComponent(siteId)}/engineering/overview`} aria-current={mode === "engineering" ? "page" : undefined}>Engineering</a></nav></div>
      <span className="identity">{visible ? visible.identity.actorId : "Session unavailable"}</span></header>
      <div className="environment" role="status"><strong>{visible ? `${visible.executionMode === "simulation" ? "SIMULATION" : "LIVE"} · ${visible.realm.environment} / ${visible.realm.namespaceId}` : "Environment unavailable"}</strong><span>Site {siteId} · {mode === "engineering" ? "Engineering" : "User"} mode · {visible ? `${visible.state.connection} · ${status}` : "No authorized data"}</span></div>
      <main id="content" tabIndex={-1}><div className="page-heading"><div><p className="eyebrow">Garden observatory / {mode}</p><h1>{sections.find(s => s.id === section)?.name}</h1><p>{visible?.site.name ?? "Current site access must be confirmed."}</p></div><button className="quiet refresh" disabled={loading} onClick={refresh}>{loading ? "Checking access…" : "Refresh status"}</button></div>
        {!visible ? <Failure status={expired ? 401 : result.ok ? 503 : result.status} error={expired ? "EXPIRED_SESSION" : result.ok ? "UNAVAILABLE" : result.error} /> : <>
          <div className="status-strip"><span><span className={`dot ${visible.state.connection === "connected" && status === "fresh" ? "" : "muted"}`} />{visible.state.connection === "no-device" ? "No device enrolled" : visible.state.connection === "offline" ? "Device offline" : "HTTPS snapshot connected"}</span><span>Observation: {status}{visible.state.snapshot ? ` · ${new Date(visible.state.observedAtMs).toISOString().slice(11, 19)} UTC` : ""}</span><span>Config {visible.configuration?.revision ?? "unavailable"}</span></div>
          {visible.state.connection === "no-device" ? <div className="panel empty"><h2>No device is enrolled</h2><p>This site has no current device state. Enrollment and commissioning need an authorized backend workflow.</p></div> : section === "overview" ? <Overview context={visible} now={now} /> : <Section context={visible} section={section} now={now} />}
          <div className="permission-note"><strong>Current access</strong><span>{visible.capabilities.join(" · ")}</span><p>Display mode changes presentation. Every API read and action checks current membership and permissions.</p></div>
        </>}
      </main><footer>ARBI / {visible?.executionMode === "hardware" ? "Physical acceptance remains a separate gate" : "Synthetic software evidence only"}<span>Recording disabled · No automatic media or command replay</span></footer>
    </div></div>;
}
function Failure({ status, error }: { status: number; error: string }) {
  const loading = error === "LOADING";
  return <div className="panel empty" role={loading ? "status" : "alert"}><p className="eyebrow">{loading ? "Checking" : "Access and connection"}</p><h2>{loading ? "Loading site…" : status === 401 ? "Session expired or unavailable" : status === 403 ? "Site access forbidden" : error === "OFFLINE" ? "You are offline" : "Provider unavailable"}</h2><p>{loading ? "Checking current identity, membership and site resource." : status === 401 ? "Sign in again to obtain a current session." : status === 403 ? "The server did not authorize this site or diagnostics read. Changing display mode cannot grant access." : error === "OFFLINE" ? "Reconnect, then refresh to recheck site access." : "The configured identity, data or audit service could not complete this read. Refresh when it is available."}</p>{status === 401 && <a href="/">Return to sign-in →</a>}</div>;
}
function Overview({ context, now }: { context: DashboardContext; now: number }) {
  const state = context.state.snapshot?.body;
  const position = context.state.telemetry?.body.samples.find(sample => sample.metric === "position.z");
  const power = context.state.telemetry?.body.samples.find(sample => sample.metric === "power.voltage");
  return <><div className="cards"><article className="panel"><p className="eyebrow">Reported state</p><h2>{state?.type === "state.snapshot" ? state.state : "Unavailable"}</h2><p>{freshness(context.state, now) === "stale" ? "Stale observation. Refresh before relying on status." : "Observed through the protected HTTPS state read."}</p><span className="tag">{context.executionMode === "simulation" ? "Simulated" : "Reported"}</span></article>
    <article className="panel"><p className="eyebrow">Position Z</p><h2>{position ? reading(position, context, now) : "Unavailable"}</h2><p>Driver encoders provide no measured pod position.</p></article>
    <article className="panel"><p className="eyebrow">Pod power</p><h2>{power ? reading(power, context, now) : "Unavailable"}</h2><p>{context.executionMode === "simulation" ? "Bounded model; no physical measurement." : "Quality is supplied by the reporting adapter."}</p></article></div>
    <div className="overview-grid"><article className="panel garden-panel"><div><p className="eyebrow">Installation context</p><h2>{context.executionMode === "simulation" ? "A synthetic garden" : context.site.name}</h2><p>Four cable paths. One observation point.</p></div><div className="garden-illustration" aria-hidden="true"><div className="garden-lines" /><div className="garden-bed bed-one" /><div className="garden-bed bed-two" /><div className="garden-bed bed-three" /><div className="garden-pod">◉</div></div><p className="fine">Illustration only · no surveyed geometry or measured location</p></article>
      <article className="panel"><p className="eyebrow">Available in this shell</p><h2>Observe with context.</h2><p>Confirm site, environment, session and the age of each observation before continuing.</p><ul className="feature-list"><li>Site and session readback <span>Available</span></li><li>Live camera <span>Unavailable</span></li><li>Motion / capture controls <span>Unavailable</span></li><li>Physical tension <span>Unavailable</span></li><li>Broker subscription <span>Unconfigured</span></li></ul></article></div></>;
}
function reading(sample: NonNullable<DashboardContext["state"]["telemetry"]>["body"]["samples"][number], context: DashboardContext, now: number) {
  const value = displayedSample(sample, context.state, now);
  return <>{value.value === null ? "Unavailable" : `${Number(value.value.toFixed(1))} ${value.unit}`}<small className="quality">{value.quality}{value.originQuality ? ` (was ${value.originQuality})` : ""}</small></>;
}
function Section({ context, section, now }: { context: DashboardContext; section: string; now: number }) {
  if (section === "diagnostics") return <div className="panel"><p className="eyebrow">Engineering context</p><h2>Available sample quality</h2><p>Detailed assembly telemetry belongs to the next diagnostics slice. Missing sensors remain unavailable.</p><div className="table-wrap"><table><caption>Protected state summary</caption><thead><tr><th>Signal</th><th>Value and quality</th></tr></thead><tbody>{context.state.telemetry?.body.samples.filter(sample => ["position.z", "power.voltage", "gimbal.pan", "line.tension.a"].includes(sample.metric)).map(sample => <tr key={sample.metric}><th scope="row">{sample.metric}</th><td>{reading(sample, context, now)}</td></tr>)}</tbody></table></div></div>;
  const content: Record<string, [string, string]> = {
    devices: [context.executionMode === "simulation" ? "Bounded module model" : "Device inventory", "The shell reads current state through the protected backend. Device enrollment, replacement and physical commissioning require their separate workflows. No physical device is represented by the synthetic model."],
    images: ["Camera and images unavailable", "No camera stream starts when this page opens. Authorized image history and explicit bounded viewing will be added in their owning slices."],
    activity: ["Activity history unavailable", "Required authorization evidence is committed before site data is returned. This shell does not yet offer an audited history query or a job timeline."],
    live: ["Live installation unavailable", "This test realm has no production device credentials, actuator endpoints, media resources or installed-system authority. Live operation needs separate provider provisioning and accepted commissioning evidence."],
  };
  const [title, body] = content[section];
  return <div className="panel empty"><p className="eyebrow">{context.executionMode === "simulation" ? "Simulation / test realm" : "Live / protected realm"}</p><h2>{title}</h2><p>{body}</p><a href={`/sites/${context.site.id}/user/overview`}>Return to site status →</a></div>;
}
