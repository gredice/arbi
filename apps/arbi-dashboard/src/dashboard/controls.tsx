'use client';
import {useEffect,useRef,useState} from 'react';
import type {Command,Event} from '@arbi/protocol';
import type {DashboardContext} from './contracts';
type Job={id:string;cloudDisposition:string;deviceStatus:string|null;terminal:Event|null;command:Command;expiresAtMs:number};
type Observation={version:string;snapshot:Event;observedAtMs:number;lease:{id:string;fence:string;operatorId:string;owned:boolean;expiresAtMs:number;endedAtMs:number|null}|null;jobs:Job[]};
type Submission={key:string;deviceId:string;leaseId:string|null;fence:string|null;timeoutMs:number;body:Command['body']};
const final=(job:Job)=>job.terminal!==null||job.cloudDisposition!=='admitted';
/** One bounded job per gesture. Browser storage never supplies command or lease authority. */
export function ControlPlayground({context}:{context:DashboardContext}){
  const [observation,setObservation]=useState<Observation|null>(null),[now,setNow]=useState(Date.now),[message,setMessage]=useState('Read observed control state to begin.'),[busy,setBusy]=useState(false);
  const [entered,setEntered]=useState(false),[retry,setRetry]=useState<Submission|null>(null),[selected,setSelected]=useState('bed-a-plant-1'),[job,setJob]=useState<Job|null>(null);
  const pending=useRef<AbortController|null>(null),epoch=useRef(0),gesture=useRef(false),current=useRef({observation,entered,job});current.current={observation,entered,job};
  const base=`/api/sites/${encodeURIComponent(context.site.id)}/dashboard-control`;
  const permitted=now<context.identity.expiresAtMs&&context.executionMode==='simulation'&&context.realm.environment==='test'&&context.capabilities.includes('manipulation.request');
  const fresh=observation!==null&&now>=observation.observedAtMs&&now-observation.observedAtMs<3000;
  const ready=fresh&&observation.snapshot.body.type==='state.snapshot'&&observation.snapshot.body.state==='Ready';
  const leased=entered&&observation?.lease?.owned===true&&observation.lease.expiresAtMs>now;
  const enabled=permitted&&ready&&leased&&!busy&&(!job||final(job));
  const supports=(type:Command['body']['type'])=>observation?.snapshot.body.type==='state.snapshot'&&observation.snapshot.body.supportedCommands.includes(type);
  function command(type:'jog-up'|'jog-down'|'home'|'gimbal'|'capture'|'stop'):Command['body']{
    if(type==='stop')return {type:'control.stop',reason:'operator'};
    if(type==='capture')return {type:'camera.capture',resourceId:selected,maxDurationMs:2500};
    if(type==='gimbal')return {type:'camera.gimbal',panDeg:0,tiltDeg:0,frame:{name:'pod-gimbal',revision:'gimbal-1'},maxDurationMs:400};
    return {type:'motion.move',positionMm:{x:1000,y:2000,z:type==='jog-up'?2491:type==='jog-down'?2489:2490},frame:{name:'site',revision:'frame-1'},maxSpeedMmPerS:50,maxDurationMs:400};
  }
  async function api(action:string,payload?:unknown,query=''){
    if(pending.current)throw new Error('BUSY');const controller=new AbortController();pending.current=controller;const timer=setTimeout(()=>controller.abort(),2500);
    try{const response=await fetch(`${base}/${action}${query}`,{method:payload===undefined?'GET':'POST',cache:'no-store',signal:controller.signal,
      ...(payload===undefined?{}:{headers:{'content-type':'application/json','x-arbi-request':'1'},body:JSON.stringify(payload)})});
      const reader=response.body?.getReader();if(!reader)throw Error('UNAVAILABLE');let bytes=0;const chunks:Uint8Array[]=[];
      try{for(;;){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.length;if(bytes>65536)throw Error('CAPACITY');chunks.push(chunk.value);}
        const data=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
        const value=JSON.parse(new TextDecoder().decode(data));if(!response.ok)throw new Error(value.error??'UNAVAILABLE');return value;
      }finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
    }finally{clearTimeout(timer);if(pending.current===controller)pending.current=null;}
  }
  async function read(){const generation=epoch.current;setBusy(true);
    try{const value:Observation=await api('controls');if(generation!==epoch.current)return;
      if(value.version!=='arbi.controls/1.0'||value.snapshot.siteId!==context.site.id||value.snapshot.realm.namespaceId!==context.realm.namespaceId||value.snapshot.realm.environment!==context.realm.environment||value.snapshot.executionMode!=='simulation')throw new Error('UNAVAILABLE');
      setObservation(value);setNow(Date.now());setJob(value.jobs[0]??null);setRetry(null);setMessage('Observed state refreshed. Reading does not enter manual control.');
    }catch(error){if(generation===epoch.current){setObservation(null);setEntered(false);setMessage(error instanceof Error?error.message:'UNAVAILABLE');}}
    finally{if(generation===epoch.current)setBusy(false);}
  }
  async function enter(){if(!permitted||!ready||busy)return;const generation=epoch.current;setBusy(true);setRetry(null);
    try{
      // Explicit re-entry retires an owned old lease and obtains a higher fence.
      // The local journal will not reopen a fence whose gesture timed out.
      if(observation?.lease?.owned){await api('release',{key:crypto.randomUUID(),leaseId:observation.lease.id,fence:observation.lease.fence});if(generation!==epoch.current)return;}
      const value=await api('acquire',{key:crypto.randomUUID(),deviceId:observation!.snapshot.source.deviceId,ttlMs:4500});if(generation!==epoch.current)return;
      if(value.endedAtMs!==null||value.expiresAtMs<=Date.now())throw new Error('EXPIRED');
      setObservation(o=>o?{...o,lease:{...value,operatorId:context.identity.actorId,owned:true}}:null);setEntered(true);setMessage('Manual control entered. This lease is never renewed automatically.');
    }catch(error){if(generation===epoch.current){setEntered(false);setMessage(error instanceof Error?error.message:'UNAVAILABLE');}}
    finally{if(generation===epoch.current)setBusy(false);}
  }
  async function submit(type:Parameters<typeof command>[0],original?:Submission){if(type!=='stop'&&!enabled&&!original)return;const seen=current.current.observation;if(!seen)return;
    const generation=epoch.current,payload=original??{key:crypto.randomUUID(),deviceId:seen.snapshot.source.deviceId,leaseId:type==='stop'?null:seen.lease?.id??null,
      fence:type==='stop'?null:seen.lease?.fence??null,timeoutMs:type==='capture'?3500:1500,body:command(type)};
    setBusy(true);setRetry(null);setMessage('Submitting intent; controller outcome is unconfirmed.');
    try{const value:Job=await api('submit',payload);if(generation===epoch.current){setJob(value);if(final(value)){setObservation(null);setEntered(false);}setMessage(`Cloud ${value.cloudDisposition}; controller ${value.deviceStatus??'unconfirmed'}.`);}}
    catch(error){if(generation===epoch.current){setRetry(type==='stop'?null:payload);setEntered(false);setMessage(`Acknowledgement unavailable: ${error instanceof Error?error.message:'UNAVAILABLE'}. Refresh observed jobs or retry this exact request explicitly.`);}}
    finally{if(generation===epoch.current)setBusy(false);}
  }
  function interrupt(reason:string){const seen=current.current,active=gesture.current;gesture.current=false;epoch.current++;pending.current?.abort();setBusy(false);setEntered(false);setRetry(null);setObservation(null);setJob(null);setMessage(`${reason}. Manual intent ended; refresh and enter again.`);
    // Best effort only; the local deadman and bounded command have their own clock.
    if(active&&seen.observation&&navigator.onLine)void fetch(`${base}/submit`,{method:'POST',headers:{'content-type':'application/json','x-arbi-request':'1'},keepalive:true,
      body:JSON.stringify({key:crypto.randomUUID(),deviceId:seen.observation.snapshot.source.deviceId,leaseId:null,fence:null,timeoutMs:1500,body:{type:'control.stop',reason:'operator'}})}).catch(()=>{});
  }
  function releaseGesture(){if(!gesture.current)return;gesture.current=false;setEntered(false);setMessage('Gesture released. Manual intent ended; enter again for another gesture.');
    if(current.current.job&&!final(current.current.job)&&!pending.current)void submit('stop');
  }
  useEffect(()=>{const timer=setInterval(()=>{const time=Date.now();setNow(time);if(current.current.entered&&current.current.observation?.lease&&current.current.observation.lease.expiresAtMs<=time)interrupt('Lease expired');},100);
    const hide=()=>{if(document.visibilityState==='hidden')interrupt('Page hidden');},lost=()=>interrupt('Connection lost'),blur=()=>interrupt('Focus lost');
    document.addEventListener('visibilitychange',hide);addEventListener('offline',lost);addEventListener('blur',blur);addEventListener('pagehide',blur);
    addEventListener('pointerup',releaseGesture);addEventListener('pointercancel',releaseGesture);addEventListener('keyup',releaseGesture);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',hide);removeEventListener('offline',lost);removeEventListener('blur',blur);removeEventListener('pagehide',blur);
      removeEventListener('pointerup',releaseGesture);removeEventListener('pointercancel',releaseGesture);removeEventListener('keyup',releaseGesture);epoch.current++;pending.current?.abort();gesture.current=false;};
  },[base]);
  useEffect(()=>{if(!job||final(job)||document.visibilityState!=='visible'||!navigator.onLine)return;const generation=epoch.current,jobId=job.id,deadline=Date.now()+8000;
    const timer=setInterval(async()=>{if(pending.current||generation!==epoch.current||document.visibilityState!=='visible')return;
      if(Date.now()>deadline){clearInterval(timer);setMessage('Outcome still unconfirmed. Refresh observed state explicitly.');return;}
      try{const value:Job=await api('status',undefined,`?jobId=${encodeURIComponent(jobId)}`);if(generation===epoch.current){setJob(value);if(final(value)){clearInterval(timer);setObservation(null);setEntered(false);setMessage(`Cloud ${value.cloudDisposition}; controller ${value.deviceStatus??'unconfirmed'}. Read fresh control state before another action.`);}}}
      catch{clearInterval(timer);if(generation===epoch.current){setEntered(false);setMessage('Status unavailable. No command will be resent.');}}
    },500);return()=>clearInterval(timer);
  },[job?.id,base]);
  return <div className="panel control-playground"><p className="eyebrow">Simulation / bounded controls</p><h2>Control playground</h2><p>Each gesture requests one short simulated job. Remote stop is best effort; local stopping remains independent.</p>
    <label>Bed / plant<select value={selected} onChange={e=>setSelected(e.target.value)} disabled={busy}><option value="bed-a-plant-1">Bed A / Plant 1</option><option value="bed-b-plant-1">Bed B / Plant 1</option></select></label>
    <div className="control-actions"><button onClick={read} disabled={busy}>Read observed control state</button><button onClick={enter} disabled={!permitted||!ready||busy||leased}>Enter simulated manual control</button></div><p aria-live="polite">{message}</p>
    <dl><dt>Controller state</dt><dd>{fresh&&observation?.snapshot.body.type==='state.snapshot'?observation.snapshot.body.state:'Unavailable / stale'}</dd><dt>Current operator</dt><dd>{observation?.lease?.operatorId??'No observed lease'}</dd>
      <dt>Lease expiry</dt><dd>{observation?.lease?new Date(observation.lease.expiresAtMs).toISOString():'Unavailable'}</dd><dt>Blocking state</dt><dd>{!permitted?'Current role / live acceptance gate':!ready?'Stopped / Ready evidence unavailable':!leased?'Explicit manual entry required':busy?'Acknowledgement pending':'Bounded simulated action permitted'}</dd></dl>
    <div className="control-actions">{(['jog-up','jog-down'] as const).map(type=><button key={type} disabled={!enabled||!supports('motion.move')} onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);gesture.current=true;void submit(type);}}
      onKeyDown={e=>{if(!e.repeat&&[' ','Enter'].includes(e.key)){e.preventDefault();gesture.current=true;void submit(type);}}}>{type==='jog-up'?'Jog +Z once':'Jog −Z once'}</button>)}
      <button disabled={!enabled||!supports('motion.move')} onClick={()=>submit('home')}>Return to simulated home</button><button disabled={!enabled||!supports('camera.gimbal')} onClick={()=>submit('gimbal')}>Gimbal neutral</button><button disabled={!enabled||!supports('camera.capture')} onClick={()=>submit('capture')}>Request capture</button>
      <button disabled={!permitted||busy||!fresh||!supports('control.stop')} onClick={()=>submit('stop')}>Request remote stop</button><button disabled>Maintenance unavailable</button></div>
    {retry&&<button disabled={busy} onClick={()=>submit('home',retry)}>Retry exact submission</button>}
    {job&&<div aria-live="polite"><h3>Observed command result</h3><p><code>{job.id}</code> · {job.command.body.type}</p><p>Cloud: {job.cloudDisposition} · Controller: {job.deviceStatus??'unconfirmed'}</p>
      <p>Expires: {new Date(job.expiresAtMs).toISOString()}{job.terminal?.body.type==='command.outcome'&&job.terminal.body.error?` · ${job.terminal.body.error.code}`:''}</p></div>}
    <p className="fine">Simulation only. Refresh and reconnect read durable jobs; they never replay gestures or capture requests. No live motor authority is configured.</p></div>;
}
