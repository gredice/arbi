import type {AuthorizedContext} from '@arbi/gredice';
import type {AuditEvent,Identity} from '@arbi/protocol';
import type {Device,Registry} from '../enrollment/contracts';
import {exact,id,JobError,milliseconds} from '../jobs/contracts';
export const LIVE_VERSION='arbi.live/1.0',LIVE_LEASE_MS=15000,LIVE_MAX_LIFETIME_MS=300000;
export type {LiveProducerProfile as LiveProfile,LiveProducerDemand as ProducerDemand} from '@arbi/protocol/live-demand';
import type {LiveProducerProfile as LiveProfile,LiveProducerDemand as ProducerDemand} from '@arbi/protocol/live-demand';
export interface LivePolicy {allow:boolean;reason:'within-budget'|'budget-exhausted'|'metering-unavailable'|'profile-denied';revision:string;
  layer:'wan'|'application-payload'|'provider'|'unknown';remainingBytes:string|null;maxUpstreamBps:number|null}
export type LivePolicyEvaluator=(query:{context:AuthorizedContext;device:Device;profile:LiveProfile;sharedUpstream:boolean;viewers:number;signal:AbortSignal})=>Promise<LivePolicy>;
export type MediaDeviceApproval=(registry:Registry,device:Device)=>boolean;
export interface LiveViewer {version:typeof LIVE_VERSION;id:string;producerId:string;authority:AuthorizedContext;currentAuthority:AuthorizedContext;
  target:Identity;configRevision:string;profile:LiveProfile;policy:LivePolicy;createdAtMs:number;expiresAtMs:number;absoluteExpiresAtMs:number;
  epoch:number;endedAtMs:number|null;endReason:string|null;intent:AuditEvent;signal:{sequence:number;fingerprint:string;reply:LiveSignal|null}|null;
  observedConnection?:'device-reported-connected'|'device-reported-ended';observationEventId?:string;
  policyHistory?:{epoch:number;atMs:number;policy:LivePolicy;viewers:number;sharedUpstream:boolean}[];
  browserAdvisory?:{sequence:number;receivedAtMs:number;state:'playing'|'ended';reports:number};
  delivery?:{receivedAtMs:number;startMonotonicMs:number;endMonotonicMs:number;reports:number;lastReportId:string;viewerUsageId:string;upstreamUsageId:string|null;relayUsageId:string|null};
  closure?:{authorityDurationUpperBoundMs:number;deliveryCoverage:'partial'|'unknown';playbackDurationMs:null;remoteStopObserved:false}}
export interface LiveSignal {type:'offer'|'answer'|'candidate';data:string}
export interface LiveAdapter {
  /** Implementations must independently expire demand and fence old generations, including after reconnect. */
  apply(demand:ProducerDemand,signal:AbortSignal):Promise<{id:string;generation:string;state:'leased'|'stopped'}>;
  /** Adapters deduplicate the viewer/epoch/sequence tuple. No raw video passes through HTTP handlers. */
  signal(query:{demand:ProducerDemand;viewerId:string;epoch:number;sequence:number;expiresAtMs:number;message:LiveSignal},signal:AbortSignal):Promise<LiveSignal>;
}
export function profile(input:LiveProfile):LiveProfile{
  exact(input,['id','transport','maxUpstreamBps','maxDownstreamBps','maxViewers']);id(input.id);
  if(input.transport!=='isolated-signaling')throw new JobError('DENIED');
  milliseconds(input.maxUpstreamBps,1,2000000);milliseconds(input.maxDownstreamBps,1,8000000);milliseconds(input.maxViewers,1,4);return structuredClone(input);
}
export function policy(input:unknown):LivePolicy{
  exact(input,['allow','reason','revision','layer','remainingBytes','maxUpstreamBps']);id(input.revision);
  if(typeof input.allow!=='boolean'||!['within-budget','budget-exhausted','metering-unavailable','profile-denied'].includes(String(input.reason))||
    !['wan','application-payload','provider','unknown'].includes(String(input.layer))||
    (input.allow?(input.reason!=='within-budget'||input.layer==='unknown'||input.remainingBytes===null):input.reason==='within-budget')||
    (input.remainingBytes!==null&&(typeof input.remainingBytes!=='string'||!/^(0|[1-9][0-9]{0,19})$/.test(input.remainingBytes))))throw new JobError('INVALID_REQUEST');
  if(input.maxUpstreamBps!==null)milliseconds(input.maxUpstreamBps,1,2000000);return input as unknown as LivePolicy;
}
export function liveSignal(input:unknown):LiveSignal{
  exact(input,['type','data']);if(!['offer','answer','candidate'].includes(String(input.type))||typeof input.data!=='string'||!input.data.length||Buffer.byteLength(input.data)>4096)throw new JobError('INVALID_REQUEST');
  return input as unknown as LiveSignal;
}
