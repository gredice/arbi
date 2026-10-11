import type { DashboardContext } from './contracts';
export const byteText=(value:string|null)=>value===null?'Unknown':`${BigInt(value).toLocaleString()} B`;
export function historyUrl(context:DashboardContext,feature:'usage'|'audit',action:string){return `/api/sites/${encodeURIComponent(context.site.id)}/dashboard-tools/${feature}/${action}`;}
/** Bounded reads; credentials stay in the HttpOnly cookie and exports never enter browser persistence. */
export async function historyJson<T>(url:string,signal:AbortSignal,body?:unknown,maxBytes=8388608):Promise<T>{
  const response=await fetch(url,{cache:'no-store',signal,...(body===undefined?{}:{method:'POST',headers:{'content-type':'application/json','x-arbi-request':'1'},body:JSON.stringify(body)})});
  if(!response.ok)throw Error(response.status===401?'Session expired':response.status===403?'Permission denied':response.status===400?'Invalid query or settings; check dates, identifiers and timezone':response.status===429?'Request capacity reached; refresh when ready':'History provider unavailable');
  const reader=response.body?.getReader();if(!reader)throw Error('History provider unavailable');const chunks:Uint8Array[]=[];let bytes=0;
  try{for(;;){const next=await reader.read();if(next.done)break;bytes+=next.value.length;if(bytes>maxBytes)throw Error('Response exceeds limit');chunks.push(next.value);}
    const value=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){value.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(value));
  }finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function downloadHistory(payload:unknown,name:string){const json=JSON.stringify(payload);if(new TextEncoder().encode(json).length>8388608)throw Error('Export exceeds limit');
  const url=URL.createObjectURL(new Blob([json],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);}
export function activeHistory(context:DashboardContext){return document.visibilityState==='visible'&&navigator.onLine&&Date.now()<context.identity.expiresAtMs;}

export const sameHistoryRealm=(a:DashboardContext['realm'],b:DashboardContext['realm'])=>a?.environment===b.environment&&a?.namespaceId===b.namespaceId;
