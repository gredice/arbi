'use client';
import {useEffect,useRef,useState} from 'react';
import type {LiveProfile} from '../live/contracts';
import type {DashboardContext} from './contracts';
import {activeHistory,sameHistoryRealm} from './history-client';
interface Scope{version:string;realm:DashboardContext['realm'];siteId:string;humanSessionId:string}
interface Inventory extends Scope{devices:{id:string}[];profiles:LiveProfile[];metered:boolean|null;transport:string}
interface Viewer extends Scope{id:string;deviceId:string;producerId:string;profile:LiveProfile;expiresAtMs:number;absoluteExpiresAtMs:number;epoch:number;admission:string;endReason:string|null;token:string|null;observedConnection:string;policy:{reason:string;layer:string};measured:{viewerBytes:string|null;upstreamBytes:string|null;coverage:string}}
const count=(v:string|null)=>v===null?'Unavailable':v+' B';
export function LiveViewing({context}:{context:DashboardContext}){
  const [inventory,setInventory]=useState<Inventory|null>(null),[profile,setProfile]=useState(''),[device,setDevice]=useState(''),[view,setView]=useState<Viewer|null>(null),[notice,setNotice]=useState('Viewing is stopped. Read available profiles to begin.'),[busy,setBusy]=useState(false),[elapsed,setElapsed]=useState(0);
  const pending=useRef<AbortController|null>(null),generation=useRef(0),current=useRef<Viewer|null>(null),startedAt=useRef(0),lastActivity=useRef(0),lastPoll=useRef(0),inventoryRef=useRef<Inventory|null>(null);
  inventoryRef.current=inventory;
  const base='/api/sites/'+encodeURIComponent(context.site.id)+'/dashboard-live/',allowed=context.capabilities.includes('live.view');
  function scope(value:Scope){if(!sameHistoryRealm(value.realm,context.realm)||value.siteId!==context.site.id||value.humanSessionId!==context.identity.sessionId)throw Error('Invalid viewing scope');}
  async function request<T>(action:string,body:unknown,signal:AbortSignal):Promise<T>{
    const response=await fetch(base+action,{method:'POST',cache:'no-store',signal,headers:{'content-type':'application/json','x-arbi-request':'1'},body:JSON.stringify(body)});
    const reader=response.body?.getReader();if(!reader)throw Error('Viewing unavailable');let size=0,raw='';const decoder=new TextDecoder(),cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
    try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>65536)throw Error('Viewing response too large');raw+=decoder.decode(part.value,{stream:true});}if(signal.aborted)throw Error('Viewing ended');raw+=decoder.decode();const value=JSON.parse(raw);
      if(!response.ok)throw Error(response.status===401?'Session expired':response.status===403?value.endReason??'Permission or policy denied':typeof value.error==='string'?value.error:'Viewing unavailable');return value;
    }finally{signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock();}
  }
  function release(v:Viewer){void fetch(base+'end',{method:'POST',cache:'no-store',keepalive:true,signal:AbortSignal.timeout(2000),headers:{'content-type':'application/json','x-arbi-request':'1'},body:JSON.stringify({sessionId:v.id})}).catch(()=>{});}
  function stop(reason:string){generation.current++;pending.current?.abort();pending.current=null;const v=current.current;current.current=null;if(v)release(v);setView(null);setBusy(false);setNotice(reason);}
  async function run(work:(signal:AbortSignal,n:number)=>Promise<void>){if(pending.current||!activeHistory(context))return;const controller=new AbortController(),n=++generation.current;pending.current=controller;setBusy(true);const timer=setTimeout(()=>controller.abort(),2000);
    try{await work(controller.signal,n);}catch(error){if(n===generation.current)stop(error instanceof Error?error.message:'Viewing unavailable');}
    finally{clearTimeout(timer);if(pending.current===controller){pending.current=null;setBusy(false);}}
  }
  function valid(n:number){return n===generation.current&&activeHistory(context);}
  function accept(v:Viewer,n:number){scope(v);if(v.version!=='arbi.live/1.0'||!Number.isSafeInteger(v.expiresAtMs)||!Number.isSafeInteger(v.epoch)||typeof v.id!=='string'||!inventoryRef.current?.profiles.some(p=>p.id===v.profile.id)||!inventoryRef.current.devices.some(d=>d.id===v.deviceId))throw Error('Invalid viewing session');
    if(!valid(n)){if(v.admission==='granted')release(v);return false;}if(current.current&&current.current.id!==v.id)throw Error('Viewing session changed');
    if(v.admission!=='granted'||!v.token||v.expiresAtMs<=Date.now()){stop('Viewing ended: '+(v.endReason??'expired'));return false;}current.current=v;setView(v);return true;
  }
  async function read(){await run(async(signal,n)=>{const value=await request<Inventory>('inventory',{},signal);scope(value);if(value.version!=='arbi.live-dashboard/1.0'||value.profiles.length>4||value.devices.length>128)throw Error('Invalid viewing inventory');if(valid(n)){setInventory(value);inventoryRef.current=value;setProfile(value.profiles[0]?.id??'');setDevice(value.devices[0]?.id??'');setNotice(value.devices.length?'Choose a profile and explicitly start viewing.':'No approved media source available.');}});}
  async function start(){if(!inventory||current.current||!allowed)return;await run(async(signal,n)=>{const v=await request<Viewer>('start',{key:crypto.randomUUID(),deviceId:device,profileId:profile},signal);if(accept(v,n)){startedAt.current=performance.now();lastActivity.current=performance.now();lastPoll.current=performance.now();setElapsed(0);setNotice('Permission granted. Playback remains unobserved.');await request('signal',{sessionId:v.id,token:v.token,sequence:1,message:{type:'offer',data:'explicit-isolated-viewer'}},signal);}});}
  useEffect(()=>{const hide=()=>{if(!activeHistory(context))stop('Viewing stopped when the panel became inactive.');},end=()=>stop('Viewing stopped. Start again explicitly.'),activity=()=>{lastActivity.current=performance.now();};
    const timer=setInterval(()=>{const v=current.current;if(!v)return;
      if(!activeHistory(context)||Date.now()>=v.expiresAtMs-1000||Date.now()>=v.absoluteExpiresAtMs||performance.now()-lastActivity.current>=30000){stop('Viewing ended: expired or idle.');return;}
      setElapsed(Math.floor((performance.now()-startedAt.current)/1000));if(pending.current||performance.now()-lastPoll.current<Math.min(1500,Math.max(250,(v.expiresAtMs-Date.now()-1000)/2)))return;lastPoll.current=performance.now();
      void run(async(signal,n)=>{let state=await request<Viewer>('state',{sessionId:v.id},signal);if(!accept(state,n))return;
        if(state.expiresAtMs-Date.now()<12000){state=await request<Viewer>('renew',{sessionId:state.id,token:state.token},signal);if(!accept(state,n))return;await request('signal',{sessionId:state.id,token:state.token,sequence:1,message:{type:'offer',data:'explicit-isolated-viewer'}},signal);}
        if(valid(n))setNotice('Session '+state.admission+' · '+state.observedConnection);
      });
    },250);
    addEventListener('offline',end);addEventListener('pagehide',end);document.addEventListener('visibilitychange',hide);document.addEventListener('pointerdown',activity);document.addEventListener('keydown',activity);
    return()=>{clearInterval(timer);generation.current++;pending.current?.abort();const v=current.current;current.current=null;if(v)release(v);removeEventListener('offline',end);removeEventListener('pagehide',end);document.removeEventListener('visibilitychange',hide);document.removeEventListener('pointerdown',activity);document.removeEventListener('keydown',activity);};
  },[context.site.id,context.identity.sessionId,context.identity.expiresAtMs]);
  const selected=inventory?.profiles.find(p=>p.id===profile);
  return <section className="panel"><h2>On-demand viewing</h2><p>Viewing starts only after your action. A granted session and observed playback are separate.</p>
    <button disabled={busy||!allowed||!!view} onClick={()=>void read()}>Read viewing profiles</button>
    {inventory&&<><p>Network {inventory.metered===null?'metering unavailable':inventory.metered?'metered':'unmetered'}. Transport {inventory.transport} · physical media unavailable.</p>
      <div className="history-form"><label>Media source<select disabled={busy||!!view} value={device} onChange={e=>setDevice(e.target.value)}>{inventory.devices.map(d=><option key={d.id}>{d.id}</option>)}</select></label>
        <label>Viewing quality<select disabled={busy||!!view} value={profile} onChange={e=>setProfile(e.target.value)}>{inventory.profiles.map(p=><option key={p.id} value={p.id}>{p.id} · {p.maxUpstreamBps} bit/s upstream</option>)}</select></label>
        <button disabled={busy||!!view||!device||!selected||!allowed} onClick={()=>void start()}>Start viewing</button><button disabled={!view&&!busy} onClick={()=>stop('Viewing stopped by you.')}>Stop viewing</button></div>
      <p>Expected maximum payload {selected?Math.ceil(selected.maxUpstreamBps*60/8)+' B/min shared upstream; '+Math.ceil(selected.maxDownstreamBps*60/8)+' B/min per viewer':'Unavailable'}. Expected rates exclude network/provider overhead.</p></>}
    <p aria-live="polite">{notice}</p>{view&&<><p>Viewer session <code>{view.id}</code> · epoch {view.epoch} · shared producer <code>{view.producerId}</code></p><p>Permission {view.admission} · connection {view.observedConnection} · elapsed locally {elapsed} s · authorization expires {new Date(view.expiresAtMs).toISOString()}</p>
      <p>Measured viewer payload {count(view.measured.viewerBytes)} · measured shared upstream {count(view.measured.upstreamBytes)} · coverage {view.measured.coverage}. Playback duration and carrier bytes unavailable.</p><p>Policy {view.policy.reason} · layer {view.policy.layer}. A heartbeat rechecks permission and policy; idle closes after 30 s.</p></>}
    <p>Camera controls require fresh supported local motion and settling policy. Use the <a href={'/sites/'+context.site.id+'/user/controls'}>observed control panel</a> for authorized camera gestures; video availability grants no control.</p>
  </section>;
}
