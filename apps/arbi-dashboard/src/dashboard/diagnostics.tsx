"use client";
import { useEffect, useRef, useState } from 'react';
import type { DashboardContext } from './contracts';
import { DASHBOARD_VERSION } from './contracts';
import { appendObservation, diagnosticExport, diagnosticReadings } from './assemblies';
import type { DetailObservation } from './assemblies';

export function AssemblyInventory({context}:{context:DashboardContext}){
  return <div className="panel"><h2>Assembly inventory</h2><p>Passive parts and unsupported sensing remain visible. Firmware versions are configured references, not observed installation receipts.</p>
    <div className="table-wrap"><table className="assembly-inventory"><caption>All baseline assemblies</caption><thead><tr><th>Assembly</th><th>Identity / kind</th><th>Capabilities</th><th>Firmware / calibration</th></tr></thead><tbody>{context.assemblies.map(a=><tr key={a.id}>
      <th scope="row">{a.name}</th><td><code>{a.id}</code> · {a.kind}<br/>{a.componentIds.join(', ')||'No instrumented component'}</td><td>{a.capabilities.map(c=>`${c.metric}: ${c.qualities.join('/')||'unavailable'}`).join('; ')||'Available sensing not declared'}<br/>{a.unsupported.join('; ')}: unavailable</td>
      <td>{a.firmware.map(f=>`${f.id}: ${f.version??'unavailable'}`).join('; ')||'Firmware unavailable / passive'}<br/>Calibration {a.calibrationRevision??'unavailable'}</td></tr>)}</tbody></table></div></div>;
}
async function boundedJson(response:Response){
  const reader=response.body?.getReader();if(!reader)throw Error('Unavailable');let size=0;const parts:Uint8Array[]=[];
  try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>32768)throw Error('Detail response exceeds bound');parts.push(p.value);}
    const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return JSON.parse(new TextDecoder().decode(bytes));
  }finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function AssemblyDiagnostics({context,now}:{context:DashboardContext;now:number}){
  const [selected,setSelected]=useState('');const [history,setHistory]=useState<DetailObservation[]>([]);const [message,setMessage]=useState('Select an assembly to request detail');const [filter,setFilter]=useState('');
  const observed=useRef<DetailObservation[]>([]);
  useEffect(()=>{
    if(!selected)return;
    let alive=true,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined,generation=0,nextAllowedAt=0;
    const close=()=>{generation++;clearTimeout(timer);controller?.abort();};
    const active=()=>alive && document.visibilityState==='visible' && navigator.onLine && Date.now()<context.identity.expiresAtMs;
    async function poll(){
      if(!active()){if(alive)setMessage('Detail paused: hidden, offline or expired');return;}
      if(Date.now()<nextAllowedAt){timer=setTimeout(()=>void poll(),nextAllowedAt-Date.now());return;}
      nextAllowedAt=Date.now()+5000;
      const local=new AbortController(),current=++generation;controller=local;const timeout=setTimeout(()=>local.abort(),4000);let delay=5000;
      try{
        const response=await fetch(`/api/sites/${encodeURIComponent(context.site.id)}/dashboard/detail?assembly=${encodeURIComponent(selected)}`,{cache:'no-store',signal:local.signal});
        if(!response.ok)throw Error(response.status===401||response.status===403?'Detail authorization unavailable':'Detail provider unavailable');
        const body=await boundedJson(response);
        if(body.version!==DASHBOARD_VERSION || body.siteId!==context.site.id || body.executionMode!==context.executionMode || JSON.stringify(body.realm)!==JSON.stringify(context.realm) ||
          body.detail?.assembly?.id!==selected || !Array.isArray(body.detail.readings) || body.detail.readings.length>32 || !Number.isSafeInteger(body.detail.pollAfterMs) || body.detail.pollAfterMs<5000 || body.detail.pollAfterMs>60000 ||
          !Number.isSafeInteger(body.detail.observedAtMs) || body.detail.maxPoints!==60 || body.detail.maxResponseBytes!==32768 || body.detail.protocol && !/^(0|[1-9][0-9]{0,19})$/.test(body.detail.protocol.sequence))throw Error('Invalid detail contract');
        if(!active() || local.signal.aborted || current!==generation)return;
        delay=body.detail.pollAfterMs;nextAllowedAt=Date.now()+delay;const next=body.detail as DetailObservation;
        const result=appendObservation(observed.current,next);observed.current=result.history;setHistory(result.history);setMessage(result.reason??'Selected detail active · 5 second minimum refresh · bounded history');
      }catch(e){if(alive && current===generation){observed.current=[];setHistory([]);setMessage(e instanceof Error?e.message:'Detail unavailable');}}
      finally{clearTimeout(timeout);if(current===generation){controller=undefined;if(active())timer=setTimeout(()=>void poll(),delay);}}
    }
    const visibility=()=>{close();if(active())void poll();else setMessage('Detail paused: hidden, offline or expired');};
    document.addEventListener('visibilitychange',visibility);addEventListener('offline',visibility);addEventListener('online',visibility);addEventListener('pagehide',close);
    void poll();return()=>{alive=false;close();document.removeEventListener('visibilitychange',visibility);removeEventListener('offline',visibility);removeEventListener('online',visibility);removeEventListener('pagehide',close);};
  },[selected,context.site.id,context.identity.expiresAtMs,context.executionMode,context.realm.environment,context.realm.namespaceId]);
  const assembly=context.assemblies.find(a=>a.id===selected);
  const latest=history.at(-1);const originalRows=assembly?latest?.readings??diagnosticReadings(assembly,context.state,now):[];
  const rows=originalRows.map(r=>latest && now-latest.observedAtMs>=context.state.staleAfterMs && !['stale','unavailable'].includes(r.quality)?{...r,quality:'stale',originQuality:r.quality,reason:'expired'}:r);
  const events=history.filter(p=>!filter || JSON.stringify(p.protocol).includes(filter)||p.state?.includes(filter));
  function download(){const json=JSON.stringify(diagnosticExport(context.site.id,context.realm,history),null,2);if(new TextEncoder().encode(json).length>1048576){setMessage('Export exceeds 1 MiB bound');return;}
    const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`arbi-diagnostics-${selected}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);}
  return <div className="panel"><h2>Selected assembly diagnostics</h2><label htmlFor="assembly-detail">Detail demand</label><select id="assembly-detail" value={selected} onChange={e=>{observed.current=[];setHistory([]);setSelected(e.target.value);}}>
    <option value="">No active detail subscription</option>{context.assemblies.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><p aria-live="polite">{message}</p>
    {!selected && <div className="table-wrap"><table><caption>Protected sample summary</caption><thead><tr><th>Signal</th><th>Value / quality</th></tr></thead><tbody>{context.assemblies.filter(a=>['pod','gimbal','line-a'].includes(a.id)).flatMap(a=>diagnosticReadings(a,context.state,now)).map(r=><tr key={r.metric}><th scope="row">{r.metric}</th><td>{r.value===null?'Unavailable':`${r.value} ${r.unit}`} · {r.quality}</td></tr>)}</tbody></table></div>}
    {assembly && <><div className="table-wrap"><table className="diagnostic-values"><caption>{assembly.name} · values and provenance</caption><thead><tr><th>Signal</th><th>Value / quality</th><th>Source / sequence</th><th>Time / uncertainty</th></tr></thead><tbody>{rows.map(r=><tr key={r.metric}><th scope="row">{r.metric}</th>
      <td>{r.value===null?'Unavailable':`${r.value} ${r.unit??''}`} · {r.quality}{r.originQuality?` (was ${r.originQuality})`:''}<br/>{r.reason}</td><td>{r.source?`${r.source.deviceId} / ${r.source.bootId} / ${r.source.sessionId}`:'Unavailable'}<br/>Sequence {r.sequence??'unavailable'}</td>
      <td>UTC {r.sourceTime?.utc??'unknown'}<br/>Source monotonic {r.sampleMonotonicMs??'unknown'} ms<br/>Clock uncertainty {r.sourceTime?.uncertaintyMs??'unknown'} ms · age {r.ageMs??'unknown'} ms<br/>Value uncertainty {r.uncertainty??'unknown'} {r.unit}</td></tr>)}</tbody></table></div>
      {assembly.metrics.map(metric=><DiagnosticPlot key={metric} metric={metric} history={history}/>)}
      <h3>Bounded protocol and state observations</h3><label htmlFor="diagnostic-filter">Filter type, state, source or command ID</label><input id="diagnostic-filter" maxLength={128} value={filter} onChange={e=>setFilter(e.target.value)}/>
      <ol>{events.map((p,i)=><li key={`${p.protocol?.messageId??'missing'}-${i}`}>{new Date(p.observedAtMs).toISOString()} · {p.state??'State unavailable'} · {p.protocol?.type??'No protocol event'} · {p.protocol?.sequence??'No sequence'} · {p.protocol?.commandId??'No command correlation'}</li>)}</ol>
      <h3>Fault and command history</h3>{latest?.events===null || !latest?<p>Authoritative event history unavailable; no event adapter is configured.</p>:<ol>{latest.events.filter(e=>!filter || JSON.stringify(e).includes(filter)).map(e=><li key={e.id}>{e.type} · {e.state??e.outcome??'Unknown'} · {e.faultId??e.commandId??'No correlation'} · {e.severity??''} {e.code??''} · {e.source.deviceId}/{e.source.bootId} · sequence {e.sequence} · UTC {e.sourceTime.utc??'unknown'} / monotonic {e.sourceTime.monotonicMs} ms</li>)}</ol>}
      <p>At most 60 partial observations; sequence gaps, source changes and stale samples remain visible. No raw log, credentials or private media export.</p><button type="button" disabled={!history.length} onClick={download}>Export selected diagnostics</button>
    </>}
  </div>;
}
function DiagnosticPlot({metric,history}:{metric:string;history:DetailObservation[]}){
  const points=history.map(p=>({p,r:p.readings.find(r=>r.metric===metric)}));const numeric=points.flatMap(x=>typeof x.r?.value==='number' && x.r.quality!=='stale'?[x.r.value]:[]);
  if(!numeric.length)return <p>{metric}: no fresh numeric plot data</p>;
  const low=Math.min(...numeric),high=Math.max(...numeric),range=high-low||1;
  return <figure><figcaption>{metric} · {points.at(-1)?.r?.unit} · {history.length}/60 observations · {low}–{high}</figcaption><svg viewBox="0 0 600 120" role="img" aria-label={`${metric} bounded observations`} style={{width:'100%',maxHeight:180}}>
    {points.map(({p,r},i)=>typeof r?.value==='number' && r.quality!=='stale'?<circle key={`point-${i}`} cx={i*600/Math.max(1,points.length-1)} cy={110-(r.value-low)/range*100} r="3" fill="currentColor"><title>{new Date(p.observedAtMs).toISOString()} · {r.value} {r.unit} · {r.quality} · sequence {r.sequence}</title></circle>:null)}
    {points.map(({p,r},i)=>{const previous=points[i-1],old=previous?.r;const gap=previous?.p.protocol && p.protocol && BigInt(p.protocol.sequence)>BigInt(previous.p.protocol.sequence)+1n;
      if(typeof r?.value!=='number' || r.quality==='stale' || !old || typeof old.value!=='number' || old.quality==='stale' || gap)return null;
      return <line key={i} x1={(i-1)*600/Math.max(1,points.length-1)} y1={110-(old.value-low)/range*100} x2={i*600/Math.max(1,points.length-1)} y2={110-(r.value-low)/range*100} stroke="currentColor" strokeWidth="2"><title>{p.observedAtMs} · {r.quality} · sequence {r.sequence}</title></line>;})}</svg></figure>;
}
