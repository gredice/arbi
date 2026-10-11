"use client";
import { useEffect, useRef, useState } from 'react';
import type { DashboardContext } from './contracts';
import type { AuditQuery } from '../audit/query-contracts';
import type { AuditQueryStore } from '../audit/query-store';
import { sameHistoryRealm, activeHistory, downloadHistory, historyJson, historyUrl } from './history-client';
type Result=Awaited<ReturnType<AuditQueryStore['search']>>;
type Field='actorId'|'deviceId'|'action'|'resourceId'|'outcome'|'correlationId'|'sessionId';
const labels:Record<Field,string>={actorId:'Original actor ID',deviceId:'Device ID',action:'Action',resourceId:'Resource ID',outcome:'Result',correlationId:'Correlation ID',sessionId:'Session ID'};
const day=(n:number)=>new Date(n).toISOString().slice(0,10);
export function AuditTimeline({context}:{context:DashboardContext}){
  const [fields,setFields]=useState<Partial<Record<Field,string>>>({}),[from,setFrom]=useState(day(Date.now()-7*86400000)),[to,setTo]=useState(day(Date.now()));
  const [page,setPage]=useState<Result|null>(null),[applied,setApplied]=useState<AuditQuery|null>(null),[notice,setNotice]=useState('Search persisted audit records; no background polling'),[busy,setBusy]=useState(false);
  const pending=useRef<AbortController|null>(null),generation=useRef(0),canRead=context.capabilities.includes('audit.read'),canExport=context.capabilities.includes('audit.export');
  useEffect(()=>{const query=new URL(location.href).searchParams;setFields(Object.fromEntries(['sessionId','correlationId'].flatMap(key=>query.get(key)?[[key,query.get(key)!]]:[])));
    const close=()=>{generation.current++;pending.current?.abort();pending.current=null;setPage(null);setApplied(null);setBusy(false);};
    const visibility=()=>{if(!activeHistory(context))close();};addEventListener('offline',close);addEventListener('pagehide',close);document.addEventListener('visibilitychange',visibility);
    return()=>{generation.current++;pending.current?.abort();removeEventListener('offline',close);removeEventListener('pagehide',close);document.removeEventListener('visibilitychange',visibility);};
  },[context.site.id,context.identity.sessionId,context.identity.expiresAtMs]);
  async function run(work:(signal:AbortSignal,n:number)=>Promise<void>){
    if(pending.current||!activeHistory(context))return;const controller=new AbortController(),n=++generation.current;pending.current=controller;setBusy(true);const timeout=setTimeout(()=>controller.abort(),6000);
    try{await work(controller.signal,n);}catch(error){if(n===generation.current){setPage(null);setApplied(null);setNotice(error instanceof Error?error.message:'Audit unavailable');}}
    finally{clearTimeout(timeout);if(n===generation.current){pending.current=null;setBusy(false);}}
  }
  async function search(next=false){if(!canRead)return;
    const filter:AuditQuery=next&&applied?{...applied,cursor:page?.nextCursor??undefined}:{fromMs:Date.parse(`${from}T00:00:00.000Z`),toMs:Date.parse(`${to}T00:00:00.000Z`)+86400000,limit:40,
      ...Object.fromEntries(Object.entries(fields).filter(([,value])=>value))};
    await run(async(signal,n)=>{const query=new URLSearchParams(Object.entries(filter).filter(([,value])=>value!==undefined).map(([key,value])=>[key,String(value)]));
      const result=await historyJson<Result>(`${historyUrl(context,'audit','search')}?${query}`,signal,undefined,1048576);
      if(n!==generation.current||!activeHistory(context))return;if(result.siteId!==context.site.id||!sameHistoryRealm(result.realm,context.realm)||result.version!=='arbi.audit-query/1.0'||result.events.length>40)throw Error('Invalid audit scope');
      setPage(result);setApplied({...filter,cursor:undefined});setNotice(`${result.events.length} persisted records · frozen receipt snapshot ${result.snapshot.upper}`);
    });
  }
  const invalidate=()=>{setPage(null);setApplied(null);};
  return <section className="panel"><h2>Searchable audit timeline</h2><p>Trace request and authorization through reported local results. Stream authorization, observed connection/liveness and inferred termination are separate evidence. Displayed actor identities are site-scoped pseudonyms; the actor filter uses the original trusted ID.</p>
    <form className="history-form" onSubmit={e=>{e.preventDefault();void search();}}>
      <label>Receipt date from<input type="date" value={from} disabled={busy} onChange={e=>{setFrom(e.target.value);invalidate();}} required/></label>
      <label>Receipt date through<input type="date" value={to} disabled={busy} onChange={e=>{setTo(e.target.value);invalidate();}} required/></label>
      {(Object.keys(labels) as Field[]).map(key=><label key={key}>{labels[key]}<input maxLength={128} value={fields[key]??''} disabled={busy} onChange={e=>{setFields(old=>({...old,[key]:e.target.value}));invalidate();}}/></label>)}
      <button disabled={busy||!canRead}>Search audit</button></form><p aria-live="polite">{notice}</p>{!canRead&&<p>Current audit-read permission is required.</p>}
    {page&&<><p>Window uses {page.coverage.timeBasis}. Original UTC may be unknown; source monotonic values are meaningful only within their boot/session. {page.coverage.retiredPayloadsInWindow} retired payloads; their filter matches are {page.coverage.retiredFilterMatches}.</p>
      <div className="table-wrap"><table className="audit-timeline"><caption>Audit evidence and correlation</caption><thead><tr><th>Action / evidence / result</th><th>Actor / resource / device</th><th>Original clocks and source</th><th>Trace links</th></tr></thead><tbody>{page.events.map(e=><tr key={`${e.origin}-${e.id}`}>
        <th scope="row">{e.action??'Retired payload'}<br/>{e.evidence??'Content unavailable'} · {e.outcome??'Unknown'} · {e.reason??'Unknown reason'}<br/>{e.effect??'Unknown effect'}<br/>{e.metadata?.observation??(e.evidence==='connection-loss'?'Inferred end / connection loss':e.action==='live.end'&&e.evidence==='service-outcome'?'Cloud policy end; media termination unobserved':'')}</th>
        <td>{e.actor?`${e.actor.kind} / ${e.actor.id}`:'Identity retired'}<br/>{e.resource?`${e.resource.kind}/${e.resource.id}`:'Resource unavailable'}<br/>Device {e.resource?.deviceId??'unavailable'}</td>
        <td>UTC {e.sourceTime?.utc??'unknown'} · uncertainty {e.sourceTime?.uncertaintyMs??'unknown'} ms<br/>Monotonic {e.sourceTime?.monotonicMs??'unknown'} ms · sequence {e.sequence??'unknown'}<br/>{e.source?`${e.source.identity.deviceId}/${e.source.identity.bootId}/${e.source.identity.sessionId}`:'Source retired'}<br/>Receipt {e.ingestTime?.utc??'legacy / unknown'}<br/>{e.origin} · {e.chain?'durable hash chain':'legacy unchained / retired'}</td>
        <td><code>{e.id}</code><br/>Correlation {e.links?.correlationId??'unknown'}<br/>Intent {e.links?.intentEventId??'none'}<br/>Cause {e.links?.causationEventId??'none'}<br/>Job {e.links?.jobId??'none'} · command {e.links?.commandId??'none'}<br/>Session {e.links?.sessionId??'none'}</td></tr>)}</tbody></table></div>
      <div className="history-actions"><button disabled={busy||!page.nextCursor} onClick={()=>void search(true)}>Next audit page</button>
        <button disabled={busy||!canExport||!applied} onClick={()=>void run(async(signal,n)=>{const payload=await historyJson(historyUrl(context,'audit','export'),signal,{...applied,cursor:page.snapshot.cursor});
          if(n===generation.current&&activeHistory(context))downloadHistory(payload,'arbi-audit-export.json');})}>Export audit snapshot</button></div>
      <p>Exports contain at most 1,000 records / 8 MiB, retain the frozen filter/snapshot and omit credentials, raw request bodies and private media. Export access is separately authorized and audited.</p></>}
    <p>Manipulation, configuration, viewing and release/update vocabulary can appear when their owning adapters supply evidence. Future recording unavailable until deferred prerequisites are complete.</p>
  </section>;
}
