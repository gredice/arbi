"use client";
import { useEffect, useRef, useState } from 'react';
import type { DashboardContext } from './contracts';
import type { UsageSettings } from '../usage/settings-contracts';
import type { UsageReport } from '../usage/report';
import type { UsageAlert } from '../usage/settings-store';
import type { UsageStore } from '../usage/store';
import { sameHistoryRealm, activeHistory, byteText, downloadHistory, historyJson, historyUrl } from './history-client';
type History=Awaited<ReturnType<UsageStore['read']>>;
type Report={siteId:string;realm:DashboardContext['realm'];version:string;report:UsageReport;settingsAuditId:string};
const dateInput=(ms:number)=>new Date(ms).toISOString().slice(0,10);
export function Bandwidth({context}:{context:DashboardContext}){
  const [link,setLink]=useState('sim-1'),[at,setAt]=useState(dateInput(Date.now())),[settings,setSettings]=useState<UsageSettings|null>(null);
  const [report,setReport]=useState<Report|null>(null),[history,setHistory]=useState<History|null>(null),[alerts,setAlerts]=useState<UsageAlert[]>([]),[notice,setNotice]=useState('Select a link and read its persisted history');
  const [busy,setBusy]=useState(false),[allowance,setAllowance]=useState(''),[timezone,setTimezone]=useState('UTC'),[anchor,setAnchor]=useState(1),[mode,setMode]=useState<UsageSettings['transferMode']>('normal');
  const [settingsLoaded,setSettingsLoaded]=useState(false);
  const [warning,setWarning]=useState('80');
  const pending=useRef<AbortController|null>(null),generation=useRef(0);
  const base=historyUrl(context,'usage',''),canRead=context.capabilities.includes('history.read'),canWrite=context.capabilities.includes('configuration.write'),canExport=context.capabilities.includes('audit.export');
  const clear=()=>{setReport(null);setHistory(null);setAlerts([]);};
  useEffect(()=>{const close=()=>{generation.current++;pending.current?.abort();pending.current=null;setBusy(false);clear();setSettings(null);setSettingsLoaded(false);setAllowance('');};
    const visibility=()=>{if(!activeHistory(context))close();};addEventListener('offline',close);addEventListener('pagehide',close);document.addEventListener('visibilitychange',visibility);
    return()=>{generation.current++;pending.current?.abort();removeEventListener('offline',close);removeEventListener('pagehide',close);document.removeEventListener('visibilitychange',visibility);};
  },[context.site.id,context.identity.sessionId,context.identity.expiresAtMs]);
  async function run(work:(signal:AbortSignal,current:number)=>Promise<void>){
    if(pending.current||!activeHistory(context))return;const controller=new AbortController(),current=++generation.current;pending.current=controller;setBusy(true);
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{await work(controller.signal,current);}catch(error){if(current===generation.current){clear();setSettings(null);setSettingsLoaded(false);setAllowance('');setNotice(error instanceof Error?error.message:'History unavailable');}}
    finally{clearTimeout(timeout);if(current===generation.current){pending.current=null;setBusy(false);}}
  }
  const current=(n:number)=>n===generation.current&&activeHistory(context);
  async function read(){clear();await run(async(signal,n)=>{
    const configured=await historyJson<{settings:UsageSettings|null;auditId:string|null}>(`${base}settings?linkId=${encodeURIComponent(link)}`,signal,undefined,32768);
    if(!current(n))return;if(configured.settings&&(configured.settings.plan.siteId!==context.site.id||configured.settings.plan.linkId!==link||!sameHistoryRealm(configured.settings.plan.realm,context.realm)))throw Error('Invalid settings scope');setSettings(configured.settings);setSettingsLoaded(true);
    if(configured.settings){setAllowance(configured.settings.plan.allowance.value);setTimezone(configured.settings.plan.cycle.timezone);setAnchor(configured.settings.plan.cycle.anchorDay);setMode(configured.settings.transferMode);
      const rule=configured.settings.rules.find(r=>r.kind==='threshold'&&r.layer==='interface-wan');setWarning(rule?.kind==='threshold'?String(rule.thresholdBasisPoints/100):'80');}
    const atMs=Math.min(Date.parse(`${at}T12:00:00.000Z`),Date.now()),toMs=Date.now(),fromMs=toMs-7*86400000;
    let received:Report|null=null;if(configured.settings)received=await historyJson<Report>(`${base}report`,signal,{linkId:link,atMs});
    const rolling=await historyJson<History>(`${base}history?linkId=${encodeURIComponent(link)}&fromMs=${fromMs}&toMs=${toMs}`,signal);
    const notices=await historyJson<{alerts:UsageAlert[]}>(`${base}alerts?linkId=${encodeURIComponent(link)}&fromMs=${toMs-35*86400000}&toMs=${toMs}`,signal);
    if(!current(n))return;
    if(rolling.siteId!==context.site.id||!sameHistoryRealm(rolling.realm,context.realm)||rolling.version!=='arbi.usage-device/1.0'||received&&(received.siteId!==context.site.id||!sameHistoryRealm(received.realm,context.realm)||received.version!=='arbi.usage-report/1.0'))throw Error('Invalid report scope');
    setReport(received);setHistory(rolling);setAlerts(notices.alerts);setNotice(configured.settings?'Persisted usage loaded; no background polling':'No plan configured; counters remain available without an invented allowance');
  });}
  async function save(){if(!canWrite||!settingsLoaded)return;await run(async(signal,n)=>{
    const previous=settings,revision=crypto.randomUUID();
    const value:UsageSettings=previous?{...structuredClone(previous),revision,transferMode:mode,plan:{...previous.plan,allowance:{value:allowance,unit:'bytes'},cycle:{...previous.plan.cycle,timezone,anchorDay:anchor}}}:
      {revision,plan:{version:'arbi-accounting/1.0',kind:'mobile-plan',planId:crypto.randomUUID(),realm:context.realm,siteId:context.site.id,linkId:link,allowance:{value:allowance,unit:'bytes'},
        cycle:{frequency:'monthly',timezone,anchorDay:anchor,anchorHour:0,anchorMinute:0,shortMonth:'clamp-last-day',dstFold:'earlier',dstGap:'reject'},chargedDirections:'both',reset:'each-cycle',rollover:{policy:'none',cap:null},tariff:null},
        rules:[{id:'wan-80',kind:'threshold',layer:'interface-wan',thresholdBasisPoints:8000,coverage:'complete',destinationIds:['operator-inbox']},{id:'wan-unknown',kind:'metering',layer:'interface-wan',condition:'unknown',destinationIds:['operator-inbox']}],
        destinations:[{id:'operator-inbox',kind:'operator-inbox'}],forecast:{method:'disabled',layer:'interface-wan',lookbackHours:24},carryForward:null,transferMode:mode};
    const threshold=value.rules.find(r=>r.kind==='threshold'&&r.layer==='interface-wan'),basisPoints=Math.round(Number(warning)*100);
    if(threshold?.kind==='threshold')threshold.thresholdBasisPoints=basisPoints;
    else {let destination=value.destinations[0]?.id;if(!destination){destination='operator-inbox';value.destinations.push({id:destination,kind:'operator-inbox'});}
      value.rules.push({id:`wan-warning-${crypto.randomUUID()}`,kind:'threshold',layer:'interface-wan',thresholdBasisPoints:basisPoints,coverage:'complete',destinationIds:[destination]});}
    const saved=await historyJson<{settings:UsageSettings;auditId:string}>(`${base}settings`,signal,value,32768);if(!current(n))return;
    setSettings(saved.settings);clear();setNotice(`Policy saved · audit ${saved.auditId} · edge enforcement not observed. Read usage to see the new revision.`);
  });}
  const auditLink=(sessionId:string)=>`/sites/${encodeURIComponent(context.site.id)}/engineering/activity?sessionId=${encodeURIComponent(sessionId)}`;
  return <div className="history-stack"><section className="panel"><h2>Bandwidth and billing cycle</h2><p>WAN interface observations, application payload estimates and provider reports remain separate. These counters do not establish carrier billing truth.</p>
    <form onSubmit={e=>{e.preventDefault();void read();}} className="history-form"><label>Link ID<input value={link} maxLength={128} disabled={busy||!canRead} onChange={e=>{setLink(e.target.value);setSettings(null);setSettingsLoaded(false);clear();}} required/></label>
      <label>Cycle date (UTC selection)<input type="date" value={at} disabled={busy} onChange={e=>{setAt(e.target.value);clear();}} required/></label><button disabled={busy||!canRead}>Read usage</button></form>
    <p aria-live="polite">{notice}</p>{!canRead&&<p>Current history-read permission is required.</p>}
    {report&&<><p>Allowance {byteText(report.report.allowanceBytes)} · {report.report.period.start} → {report.report.period.end} · {report.report.timezone} · settings {report.report.settingsRevision} · <a href={`/sites/${encodeURIComponent(context.site.id)}/engineering/activity?correlationId=${encodeURIComponent(report.settingsAuditId)}`}>Policy audit</a></p>
      <div className="table-wrap"><table><caption>Independent accounting layers</caption><thead><tr><th>Layer</th><th>Used / remaining</th><th>Confidence / gaps</th></tr></thead><tbody>{report.report.layers.map(r=><tr key={r.layer}><th scope="row">{r.layer}</th><td>{byteText(r.bytes)} / {byteText(r.remainingBytes)}</td><td>{r.authority} · {r.quality} · {r.coverageComplete?'complete':'incomplete'} · {r.stale?'stale':'fresh or no observation'}</td></tr>)}</tbody></table></div>
      <div className="table-wrap"><table><caption>Billing-cycle upload and download</caption><thead><tr><th>Layer / direction</th><th>Bytes / coverage</th><th>Counter epochs</th></tr></thead><tbody>{report.report.totals.filter(r=>r.scope==='boundary-total').map((r,i)=><tr key={i}><th scope="row">{r.layer} / {r.direction}</th><td>{byteText(r.bytes)} · {r.coverage} · {r.quality}</td><td>{r.counterEpochs.join(', ')}</td></tr>)}</tbody></table></div>
      <p>Forecast {byteText(report.report.forecast.projectedCycleBytes)} · {report.report.forecast.assumption} · lookback {report.report.forecast.lookbackHours} hours · rollover {report.report.carryForward.status}</p>
      <p>Configured mode {report.report.configuredTransferMode} · edge application {report.report.edgePolicyApplication}. Paused uploads, degraded media and pending updates require an observed edge adapter; status unavailable.</p>
      <div className="table-wrap"><table><caption>Current interval-average bitrate</caption><thead><tr><th>Layer / direction</th><th>Bits per second</th><th>Source confidence</th></tr></thead><tbody>{report.report.currentBitrate.map(r=><tr key={`${r.layer}-${r.direction}`}><th scope="row">{r.layer} / {r.direction}</th><td>{r.bitsPerSecond??'Unknown'}</td><td>{r.sourceQuality} · {r.quality} · {r.stale?'stale':'fresh'}</td></tr>)}</tbody></table></div>
      <button disabled={busy||!canExport} onClick={()=>void run(async(signal,n)=>{const payload=await historyJson(`${base}export`,signal,{linkId:link,atMs:Math.min(Date.parse(`${at}T12:00:00.000Z`),Date.now())});if(current(n))downloadHistory(payload,'arbi-usage-export.json');})}>Export usage</button></>}
  </section>
  {history&&<section className="panel"><h2>Rolling seven-day history</h2><p>Collection coverage {history.coverage} · sequence gaps {history.sequenceGaps.length}{history.sequenceGapsTruncated?' (more omitted)':''}. Counter reset epochs stay visible after restart.</p>
    <div className="table-wrap"><table><caption>Transfer categories and source totals</caption><thead><tr><th>Layer / direction / category</th><th>Bytes / confidence</th><th>Device / reset epochs</th></tr></thead><tbody>{[...history.totals].sort((a,b)=>a.bytes===b.bytes?0:a.bytes===null?1:b.bytes===null?-1:BigInt(a.bytes)>BigInt(b.bytes)?-1:1).map((r,i)=><tr key={i}><th scope="row">{r.layer} / {r.direction} / {r.category??'boundary total'}</th><td>{byteText(r.bytes)} · {r.quality} · {r.coverage}{r.stale?' · stale':''}<br/>Gaps {r.gaps.length}{r.gapsTruncated?' (more omitted)':''}</td><td>{r.deviceId??'link-wide'}<br/>{r.counterEpochs.join(', ')}</td></tr>)}</tbody></table></div>
    <p>Categories are included in their source totals. Shared media is counted once per observed boundary, never multiplied by viewers.</p>
    <div className="table-wrap"><table><caption>Daily UTC trends</caption><thead><tr><th>Day</th><th>Source observations</th></tr></thead><tbody>{history.days.map(day=><tr key={day.dayUtc}><th scope="row">{day.dayUtc}</th><td>{day.totals.map(r=>`${r.layer}/${r.direction}: ${byteText(r.bytes)} (${r.coverage})`).join('; ')||'Unknown · no counters'}</td></tr>)}</tbody></table></div>
    {history.comparisons.map((r,i)=><p key={i}>{r.layer}/{r.direction} · application {r.applicationComparison?.map(x=>byteText(x.bytes)).join(', ')??'same layer'} · classifier residual {r.byRevision.map(x=>`${byteText(x.unattributedBytes)} (${x.status})`).join(', ')||'Unavailable attribution'}</p>)}
    <h3>Session and viewer attribution</h3>{report?.report.sessionAttribution.length?<ul>{report.report.sessionAttribution.map(r=><li key={r.observationId}><a href={auditLink(r.media!.sessionId)}>Audit session {r.media!.sessionId}</a> · {r.media!.topology} · viewers {r.media!.viewerCount} · {r.layer}/{r.boundary} · {byteText(r.bytes)} · {r.coverage}</li>)}</ul>:<p>Session attribution unavailable.</p>}
  </section>}
  <section className="panel"><h2>Plan and transfer policy</h2><p>Saving appends an authorized audit record. The first WAN threshold is editable; other rules/destinations are preserved. A rule still alerts once per billing cycle. Cloud policy acknowledgement does not establish edge enforcement.</p>
    <form onSubmit={e=>{e.preventDefault();void save();}} className="history-form"><label>Allowance in bytes<input inputMode="numeric" pattern="[0-9]+" value={allowance} onChange={e=>setAllowance(e.target.value)} required disabled={busy||!canWrite}/></label>
      <label>Billing timezone<input value={timezone} maxLength={64} onChange={e=>setTimezone(e.target.value)} required disabled={busy||!canWrite}/></label><label>Anchor day<input type="number" min={1} max={31} value={anchor} onChange={e=>setAnchor(Number(e.target.value))} disabled={busy||!canWrite}/></label>
      <label>WAN warning percent<input type="number" min="0.01" max="1000" step="0.01" value={warning} onChange={e=>setWarning(e.target.value)} disabled={busy||!canWrite} required/></label>
      <label>Transfer mode<select aria-label="Transfer mode" value={mode} onChange={e=>setMode(e.target.value as UsageSettings['transferMode'])} disabled={busy||!canWrite}><option value="normal">Normal</option><option value="low-data">Low data</option><option value="essential-only">Essential only</option></select></label><button disabled={busy||!canWrite||!settingsLoaded}>Save policy</button></form>
    <h3>Persisted alerts</h3>{alerts.length?<ul>{alerts.map(a=><li key={a.id}>{a.ruleId} · {a.layer} · {a.kind} · {byteText(a.bytes)} · {a.quality} / {a.coverageComplete?'complete':'incomplete'} · cycle {a.period.start}</li>)}</ul>:<p>No alerts loaded; unknown metering remains unknown.</p>}
    <p>Future recording unavailable until its deferred device, privacy and storage prerequisites are complete.</p>
  </section></div>;
}
