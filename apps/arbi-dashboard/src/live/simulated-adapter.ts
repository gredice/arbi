import {performance} from 'node:perf_hooks';
import {isRealm} from '@arbi/gredice';
import {digest} from '@arbi/audit';
import {JobError,id,milliseconds} from '../jobs/contracts';
import {LIVE_LEASE_MS,liveSignal,profile,type LiveAdapter,type ProducerDemand,type LiveSignal} from './contracts';
/** No encoder, network media or actuator. Independent lease/fence behavior for isolated signaling integration. */
export class SimulatedLiveAdapter implements LiveAdapter{
  readonly #entries=new Map<string,{demand:ProducerDemand;fingerprint:string;expiresMono:number}>();
  readonly #signals=new Map<string,{sequence:number;fingerprint:string;reply:LiveSignal}>();
  #wallFloor=Date.now();#closed=false;
  #valid(){const now=Date.now();if(this.#closed||now<this.#wallFloor){this.close();throw new JobError('CLOCK_UNCERTAIN');}this.#wallFloor=now;return now;}
  get status(){this.#valid();return {producers:[...this.#entries.values()].filter(e=>e.demand.viewers>0&&e.expiresMono>performance.now()).map(e=>({id:e.demand.id,generation:e.demand.generation,viewers:e.demand.viewers,expiresAtMs:e.demand.expiresAtMs})),physicalMediaEnabled:false};}
  async apply(input:ProducerDemand,signal:AbortSignal){
    const now=this.#valid();if(signal.aborted||!isRealm(input.realm)||input.realm.environment!=='test'||input.version!=='arbi.live/1.0'||input.sharedUpstream!==true)throw new JobError('DENIED');
    for(const value of [input.id,input.siteId,input.configRevision,input.target.deviceId,input.target.bootId,input.target.sessionId])id(value);
    if(!/^[1-9][0-9]{0,19}$/.test(input.generation))throw new JobError('INVALID_REQUEST');profile(input.profile);
    milliseconds(input.viewers,0,input.profile.maxViewers);milliseconds(input.issuedAtMs,0,Number.MAX_SAFE_INTEGER);milliseconds(input.expiresAtMs,0,Number.MAX_SAFE_INTEGER);
    if(input.issuedAtMs>now+100||input.expiresAtMs-input.issuedAtMs>LIVE_LEASE_MS||input.expiresAtMs<input.issuedAtMs)throw new JobError('DENIED');
    const key=JSON.stringify([input.realm,input.siteId,input.id]),previous=this.#entries.get(key),fingerprint=digest(input);
    if(previous&&BigInt(input.generation)<BigInt(previous.demand.generation))throw new JobError('STALE_FENCE');
    if(previous&&input.generation===previous.demand.generation&&fingerprint!==previous.fingerprint)throw new JobError('CONFLICT');
    if(!previous&&this.#entries.size>=32)throw new JobError('CAPACITY');
    if(!previous||input.generation!==previous.demand.generation){
      this.#entries.set(key,{demand:structuredClone(input),fingerprint,expiresMono:performance.now()+Math.max(0,input.expiresAtMs-now-100)});
      for(const id of this.#signals.keys())if(id.startsWith(`${key}:`))this.#signals.delete(id);
    }
    const current=this.#entries.get(key)!;
    return {id:input.id,generation:input.generation,state:current.demand.viewers&&current.expiresMono>performance.now()?'leased' as const:'stopped' as const};
  }
  async signal(query:Parameters<LiveAdapter['signal']>[0],signal:AbortSignal){
    const now=this.#valid(),key=JSON.stringify([query.demand.realm,query.demand.siteId,query.demand.id]),entry=this.#entries.get(key);
    if(signal.aborted||!entry||!entry.demand.viewers||entry.expiresMono<=performance.now()||entry.demand.generation!==query.demand.generation||query.expiresAtMs<=now||query.expiresAtMs>entry.demand.expiresAtMs)throw new JobError('EXPIRED');
    id(query.viewerId);milliseconds(query.epoch,1,10000);milliseconds(query.sequence,1,10000);liveSignal(query.message);
    const viewer=`${key}:${query.viewerId}:${query.epoch}`,old=this.#signals.get(viewer),fingerprint=digest(query.message);
    if(old&&query.sequence<old.sequence)throw new JobError('STALE_FENCE');
    if(old&&query.sequence===old.sequence){if(old.fingerprint!==fingerprint)throw new JobError('CONFLICT');return structuredClone(old.reply);}
    if(!old&&this.#signals.size>=128)throw new JobError('CAPACITY');
    const reply:LiveSignal={type:'answer',data:'isolated-simulation-answer'};this.#signals.set(viewer,{sequence:query.sequence,fingerprint,reply});return structuredClone(reply);
  }
  close(){this.#closed=true;this.#entries.clear();this.#signals.clear();}
}
