'use client';
import {useEffect,useRef,useState} from 'react';
import type {DashboardContext} from './contracts';
import type {CaptureEntry,CapturePage,FramingReview} from './capture-contracts';
import {activeHistory,sameHistoryRealm} from './history-client';
export function framingDiff(a:unknown,b:unknown,path='',out:string[]=[]):string[]{if(out.length>=64||JSON.stringify(a)===JSON.stringify(b))return out;
  if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){for(const key of new Set([...Object.keys(a),...Object.keys(b)]))framingDiff((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key],`${path}/${key}`,out);}else out.push(path||'/');return out;}
async function historyJson<T>(url:string,signal:AbortSignal,body?:unknown,maxBytes=262144):Promise<T>{
  const response=await fetch(url,{cache:'no-store',signal,...(body===undefined?{}:{method:'POST',headers:{'content-type':'application/json','x-arbi-request':'1'},body:JSON.stringify(body)})});
  const reader=response.body?.getReader();if(!reader)throw Error('Capture provider unavailable');const chunks:Uint8Array[]=[];let size=0;
  const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>maxBytes)throw Error('Capture response exceeds limit');chunks.push(part.value);}if(signal.aborted)throw Error('Capture read ended');
    const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}const value=JSON.parse(new TextDecoder().decode(bytes));
    if(!response.ok)throw Error(response.status===401?'Session expired':response.status===403?'Permission denied':typeof value.error==='string'&&/^[A-Za-z0-9._:-]{1,128}$/.test(value.error)?`Backend rejected: ${value.error}`:'Capture provider unavailable');return value;
  }finally{signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
const text=(value:unknown)=>value===undefined||value===null?'Unavailable':JSON.stringify(value);
export function CaptureDashboard({context}:{context:DashboardContext}){
  const [page,setPage]=useState<CapturePage|null>(null),[bed,setBed]=useState(''),[plant,setPlant]=useState(''),[notice,setNotice]=useState('Read metadata explicitly. Images stay unloaded.'),[busy,setBusy]=useState(false);
  const [review,setReview]=useState<FramingReview|null>(null),[draft,setDraft]=useState(''),[changes,setChanges]=useState<string[]>([]),[media,setMedia]=useState<Record<string,{url:string;expiresAtMs:number;thumbnail:boolean}>>({});
  const pending=useRef<AbortController|null>(null),generation=useRef(0),base=`/api/sites/${encodeURIComponent(context.site.id)}/dashboard-captures/`;
  const canRead=context.capabilities.includes('history.read'),canMedia=context.capabilities.includes('still.read'),canReview=context.capabilities.includes('configuration.read'),canEdit=context.capabilities.includes('configuration.write');
  useEffect(()=>{const clear=()=>{generation.current++;pending.current?.abort();pending.current=null;setBusy(false);setPage(null);setReview(null);setDraft('');setChanges([]);setMedia({});};
    const hide=()=>{if(!activeHistory(context))clear();},timer=setInterval(()=>{if(Date.now()>=context.identity.expiresAtMs)clear();setMedia(old=>Object.fromEntries(Object.entries(old).filter(([,v])=>v.expiresAtMs>Date.now())));},1000);
    addEventListener('offline',clear);addEventListener('pagehide',clear);document.addEventListener('visibilitychange',hide);return()=>{clearInterval(timer);generation.current++;pending.current?.abort();removeEventListener('offline',clear);removeEventListener('pagehide',clear);document.removeEventListener('visibilitychange',hide);};
  },[context.site.id,context.identity.sessionId,context.identity.expiresAtMs]);
  async function run(work:(signal:AbortSignal,n:number)=>Promise<void>){if(pending.current||!activeHistory(context))return;const controller=new AbortController(),n=++generation.current;pending.current=controller;setBusy(true);const timer=setTimeout(()=>controller.abort(),8000);
    try{await work(controller.signal,n);}catch(error){if(n===generation.current){setNotice(error instanceof Error?error.message:'Capture provider unavailable');setMedia({});setPage(null);setReview(null);}}
    finally{clearTimeout(timer);if(n===generation.current){pending.current=null;setBusy(false);}}}
  const current=(n:number)=>n===generation.current&&activeHistory(context);
  async function history(after:string|null=null,latest=false){setMedia({});await run(async(signal,n)=>{const query=new URLSearchParams();if(after)query.set('afterId',after);if(bed)query.set('bedId',bed);if(plant)query.set('plantId',plant);
    const value=await historyJson<CapturePage>(`${base}${latest?'latest':'history'}?${query}`,signal,undefined,262144);if(!current(n))return;
    if(value.version!=='arbi.capture-history/1.0'||value.siteId!==context.site.id||!sameHistoryRealm(value.realm,context.realm)||!Array.isArray(value.entries)||value.entries.length>4)throw Error('Invalid history scope');
    setPage(value);setNotice(value.order==='cloud-received'?'Latest verified cloud receipt loaded; this is not capture-time ordering.':value.source==='cloud-only'?'Cloud records loaded; current edge outcomes are unavailable.':'Recorded outcomes loaded. No image bytes were requested.');});}
  async function access(entry:CaptureEntry,imageId:string,thumbnail:boolean){if(!canMedia)return;await run(async(signal,n)=>{
    const value=await historyJson<{state:string;reason?:string;url?:string;expiresAtMs?:number}>(`${base}access`,signal,{imageId,variant:thumbnail?'thumbnail':'full',operation:thumbnail?'view':'download'},16384);if(!current(n))return;
    if(value.state==='deferred'){setNotice(`Image access deferred: ${value.reason??'budget unavailable'}. Retry explicitly when ready.`);return;}
    if(value.state!=='granted'||!value.url||!Number.isSafeInteger(value.expiresAtMs)||value.expiresAtMs!<=Date.now())throw Error('Image grant unavailable');
    const url=new URL(value.url);if(url.protocol!=='https:'&&!(context.realm.environment==='test'&&url.protocol==='http:'&&url.hostname==='127.0.0.1'))throw Error('Invalid media grant');
    setMedia(old=>({...old,[entry.id]:{url:value.url!,expiresAtMs:value.expiresAtMs!,thumbnail}}));setNotice(thumbnail?'Requested thumbnail uses a short audited grant.':'Open the image link explicitly to download.');});}
  async function readReview(){await run(async(signal,n)=>{const value=await historyJson<FramingReview>(`${base}review`,signal,undefined,262144);if(!current(n))return;
    if(value.status.siteId!==context.site.id||!sameHistoryRealm(value.status.realm,context.realm))throw Error('Invalid configuration scope');setReview(value);setDraft(JSON.stringify(value.staged??value.active,null,2));setChanges([]);setNotice('Recorded configuration loaded; staging and activation have separate backend checks.');});}
  function compare(){try{setChanges(framingDiff(review?.active??review?.staged,JSON.parse(draft)));setNotice('Local diff ready. Backend validation remains required.');}catch{setChanges([]);setNotice('Invalid configuration JSON');}}
  async function stage(){if(!canEdit)return;await run(async(signal,n)=>{const proposed=JSON.parse(draft),prior=(review?.active??review?.staged)?.configuration as {revision?:string;calibration?:{revision?:string}}|undefined;
    if(!proposed?.configuration?.revision||proposed.configuration.revision===prior?.revision)throw Error('A new configuration revision is required');
    const old=prior?.calibration,next=proposed.configuration.calibration;if(JSON.stringify(old)!==JSON.stringify(next)&&old?.revision===next?.revision)throw Error('A changed calibration requires a new calibration revision');
    await historyJson(`${base}stage`,signal,{set:proposed,reason:'operator-framing-review'},262144);if(current(n)){setReview(null);setChanges([]);setNotice('Backend accepted staging. Read the recorded revision before explicit local activation.');}});}
  async function activate(){if(!canEdit||!review?.status.staged)return;await run(async(signal,n)=>{await historyJson(`${base}activate`,signal,{reason:'operator-framing-activation'},262144);if(current(n)){setReview(null);setNotice('Read current local reports to confirm activation and readiness.');}});}
  return <div className="capture-dashboard"><section className="panel"><p className="eyebrow">Capture / image history</p><h2>Recorded outcomes</h2><p>Read metadata first. Image bytes require explicit access and current permission.</p>
    <label>Bed identifier<input value={bed} onChange={e=>{setBed(e.target.value);setPage(null);setMedia({});}} disabled={busy}/></label><label>Plant identifier<input value={plant} onChange={e=>{setPlant(e.target.value);setPage(null);setMedia({});}} disabled={busy}/></label>
    <button disabled={!canRead||busy} onClick={()=>history()}>Read capture history</button><button disabled={!canRead||busy} onClick={()=>history(null,true)}>Read latest received image</button><p aria-live="polite">{notice}</p>
    {page&&<><p>Order: {page.order==='cloud-received'?'latest verified cloud receipt':'stable capture identity'}. Upload time does not replace unavailable capture UTC.</p>{page.entries.length===0&&<p>No matching recorded captures.</p>}
      {page.entries.map(entry=><article key={entry.id} className="capture-entry"><h3>{entry.targetId}</h3><p>Capture {entry.id} · Command {entry.commandId} · Correlation {entry.correlationId}</p><p>Bed {entry.association?.bedId??'unavailable'} · Plant {entry.association?.plantId??'unavailable'}</p>
        <dl><dt>Job / progression</dt><dd>{entry.job?`${entry.job.id} · ${entry.job.origin} · priority ${entry.job.priority??'unavailable'} · queue ${entry.job.queue} · ${entry.job.phase} / ${entry.job.outcome}`:'No current job record'}</dd><dt>Scheduled UTC</dt><dd>{entry.job?.scheduledUtcMs?new Date(entry.job.scheduledUtcMs).toISOString():'Unavailable'}</dd>
        <dt>Capture</dt><dd>{entry.camera.state} · {entry.camera.phase}{entry.camera.reason?` · ${entry.camera.reason}`:''}</dd><dt>Focus</dt><dd>{entry.camera.focus}</dd><dt>Retention / delay</dt><dd>{entry.retention}</dd>
        {entry.artifacts.map(a=><div key={a.trace.artifact.id}><dt>{a.trace.artifact.kind} / processing</dt><dd>{a.trace.processing.state} · {a.trace.processing.reason??'No rejection'} · raw source {a.trace.manifest.image.id}</dd><dt>Upload</dt><dd>{a.upload.state} · attempts {a.upload.attempts??'unavailable'} · {a.upload.reason??'No recorded failure'}</dd></div>)}</dl>
        {entry.manifest&&<details><summary>Capture time, pose and revisions</summary><dl>{['capturedAt','requestedPose','availablePose','gimbal','camera','focus','profile','configuration','build'].map(field=><div key={field}><dt>{field}</dt><dd><code>{text(entry.manifest!.metadata[field])}</code></dd></div>)}<dt>Hardware revision</dt><dd>Unavailable unless reported by the capture source</dd></dl></details>}
        <p>Recorded events: {entry.warnings.join(' · ')||'None'}</p>{entry.delivery.map(d=><div key={d.artifactId}><p>Delivery {d.state} · Artifact {d.artifactId} · Image {d.imageId??'unavailable'}</p>
          {d.imageId&&<><button disabled={!canMedia||busy||!d.thumbnail} onClick={()=>access(entry,d.imageId!,true)}>Load thumbnail</button><button disabled={!canMedia||busy} onClick={()=>access(entry,d.imageId!,false)}>Request image download</button></>}</div>)}
        {media[entry.id]&&(media[entry.id].thumbnail?<img src={media[entry.id].url} alt={`Requested thumbnail for ${entry.targetId}`} referrerPolicy="no-referrer"/>:<a href={media[entry.id].url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open authorized image download</a>)}
      </article>)}<button disabled={busy||!page.next} onClick={()=>history(page.next)}>Next capture page</button></>}
    <a href={`/sites/${encodeURIComponent(context.site.id)}/user/controls`}>Open capture controls</a><p className="fine">Stop → gimbal → settle → autofocus → capture → process → upload. Each stage needs its own recorded result.</p></section>
    {canReview&&<section className="panel"><h2>Framing and calibration review</h2><button disabled={busy} onClick={readReview}>Read recorded framing</button>{review&&<><p>Local phase {review.status.phase} · {review.status.blockedReason??'No blocking reason'}</p><p>Active {review.status.active?.revision??'none'} · Staged {review.status.staged?.revision??'none'} · Rejected {review.status.rejected?.reason??'none'}</p>
      <label>Proposed commissioning set<textarea rows={14} value={draft} onChange={e=>{setDraft(e.target.value);setChanges([]);}} readOnly={!canEdit} maxLength={131072}/></label><button onClick={compare} disabled={busy}>Compare revision</button><ul>{changes.map(path=><li key={path}><code>{path}</code></li>)}</ul>
      <button disabled={!canEdit||busy||changes.length===0} onClick={stage}>Submit new framing revision</button><button disabled={!canEdit||busy||!review.status.staged} onClick={activate}>Request local activation</button>
      <p>Activation needs independently reviewed records, local maintenance authority and compatible inhibited devices.</p><h3>Recorded revisions</h3><ul>{review.revisions.map(r=><li key={r.recordId}>{r.active?.revision??r.staged?.revision??'none'} · calibration {r.active?.calibrationRevision??r.staged?.calibrationRevision??'none'} · {r.phase} · {r.reason} · correlation {r.correlationId??r.recordId}</li>)}</ul>
      <details><summary>Authoritative configuration audit</summary><ul>{review.audit.map(a=><li key={a.eventId}>{a.action} · {a.outcome} · {a.links.correlationId}</li>)}</ul></details></>}</section>}
  </div>;
}
