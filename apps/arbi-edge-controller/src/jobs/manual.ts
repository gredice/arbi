import { type AuditEvent, type Command, type ErrorCode } from '@arbi/protocol';
import { canonical } from '@arbi/audit';
import { policy, same } from './admission.js';
import type { JobJournal } from './journal.js';
import { JobError, type LocalAuthority } from './types.js';

export interface ManualOptions {
  journal:JobJournal; authority:()=>LocalAuthority; localStop:()=>void;
  deadmanMs:number; maxJogMs:number; maxLeaseMs:number;
}
interface Session {root:AuditEvent; binding:string; lastPulseAtMs:number; lastSequence:bigint; expiresAtMs:number}
/** Explicit trusted local composition only. No browser, token parser, credential or network endpoint. */
export class ManualControl {
  #session:Session|null=null;
  #lastAtMs=0;
  #failed=false;
  #rejected=0;
  constructor(readonly options:ManualOptions) {
    if(!Number.isSafeInteger(options.deadmanMs) || options.deadmanMs<50 || options.deadmanMs>1000 ||
      !Number.isSafeInteger(options.maxJogMs) || options.maxJogMs<1 || options.maxJogMs>500 ||
      !Number.isSafeInteger(options.maxLeaseMs) || options.maxLeaseMs<options.deadmanMs || options.maxLeaseMs>15000)throw new JobError('INVALID_RANGE');
    this.restart();
  }
  get status(){return {active:this.#session?.root.resource.id??null,actor:this.#session?.root.actor??null,expiresMonotonicMs:this.#session?.expiresAtMs??null,
    lastPulseMonotonicMs:this.#session?.lastPulseAtMs??null,deadmanMs:this.options.deadmanMs,rejected:this.#rejected,degraded:this.#failed,physicalActuationEnabled:false};}
  restart():void {
    this.options.localStop();this.#session=null;
    try{const a=this.options.authority();this.#lastAtMs=a.gate.nowMonotonicMs;this.options.journal.endManual(a,'source-restarted');}
    catch{this.#failed=true;}
  }
  #clock(a:LocalAuthority):boolean {
    const now=a.gate.nowMonotonicMs;
    if(!a.clockReliable || !Number.isSafeInteger(now) || now<0 || now<this.#lastAtMs)return false;this.#lastAtMs=now;return true;
  }
  #binding(a:LocalAuthority):string {
    const {gate}=a;return canonical([gate.realm,gate.siteId,gate.authenticatedSource,gate.authorizedActor,gate.receiver,
      gate.lease && {id:gate.lease.id,holderId:gate.lease.holderId,fence:gate.lease.fence,receiver:gate.lease.receiver},gate.configRevision,
      a.applied.configurationDigest,a.applied.request.transactionId,a.modules]);
  }
  #authorized(a:LocalAuthority):boolean {
    const g=a.gate,l=g.lease,now=g.nowMonotonicMs;
    return !this.#failed && a.mode==='manual' && a.cloudConnected && g.executionMode==='simulation' && g.realm.environment==='test' &&
      g.authorizedActor.kind==='human' && !!l && l.holderId===g.authorizedActor.id && same(l.receiver,g.receiver) &&
      Number.isSafeInteger(l.expiresMonotonicMs) && l.expiresMonotonicMs>now && l.expiresMonotonicMs-now<=this.options.maxLeaseMs &&
      g.allowedTypes.some(t=>t==='motion.move' || t==='camera.gimbal') && !g.faultInhibited && a.state!=='Maintenance';
  }
  #reject(code:ErrorCode):never {this.#rejected=Math.min(Number.MAX_SAFE_INTEGER,this.#rejected+1);throw new JobError(code);}
  acquire() {
    const a=this.options.authority();this.tick(a);if(!this.#clock(a))this.#reject('CLOCK_INVALID');if(!this.#authorized(a))this.#reject('NOT_AUTHORIZED');
    if(this.#session){if(this.#binding(a)!==this.#session.binding)this.#reject('LEASE_STALE');return this.status;}
    // Start does not supply a pulse: each gesture must carry fresh increasing local admission evidence.
    const root=this.options.journal.startManual(a);
    this.#session={root,binding:this.#binding(a),lastPulseAtMs:a.gate.nowMonotonicMs,lastSequence:-1n,expiresAtMs:a.gate.lease!.expiresMonotonicMs};
    return this.status;
  }
  pulse(sequence:unknown):void {
    const a=this.options.authority();this.tick(a);
    if(!this.#session || !this.#authorized(a) || this.#binding(a)!==this.#session.binding)this.#reject('LEASE_STALE');
    if(typeof sequence!=='string' || !/^(0|[1-9][0-9]{0,19})$/.test(sequence) || BigInt(sequence)>(1n<<64n)-1n)this.#reject('INVALID_RANGE');
    const next=BigInt(sequence);if(next<=this.#session.lastSequence)this.#reject('SEQUENCE_REPLAY');
    this.#session.lastSequence=next;this.#session.lastPulseAtMs=a.gate.nowMonotonicMs;this.#session.expiresAtMs=a.gate.lease!.expiresMonotonicMs;
  }
  check(c:Command,a:LocalAuthority,active=false):ErrorCode|null {
    if(c.body.type==='control.stop')return null;
    if(c.command.actor.kind!=='human')return null;
    if(!['motion.move','camera.gimbal'].includes(c.body.type))return null;
    if(a.mode!=='manual')return 'NOT_AUTHORIZED';
    const expired=this.tick(a);if(expired)return expired;
    const s=this.#session,g=a.gate;
    if(!s || s.lastSequence<0n || !this.#authorized(a) || this.#binding(a)!==s.binding || !same(c.command.actor,s.root.actor) ||
      !same(c.command.lease,g.lease && {id:g.lease.id,holderId:g.lease.holderId,fence:g.lease.fence}))return 'LEASE_STALE';
    if('maxDurationMs' in c.body && c.body.maxDurationMs>this.options.maxJogMs)return 'INVALID_RANGE';
    return policy(c,a,active);
  }
  tick(a=this.options.authority()):ErrorCode|null {
    if(!this.#clock(a)){this.lost('timeout');return 'CLOCK_INVALID';}
    const s=this.#session;if(!s)return this.#failed?'RESOURCE_LIMIT':null;
    const changed=this.#binding(a)!==s.binding || !this.#authorized(a);
    const expired=a.gate.nowMonotonicMs>=Math.min(s.expiresAtMs,s.lastPulseAtMs+this.options.deadmanMs);
    if(changed || expired){this.lost(changed?'revoked':'timeout');return changed?'LEASE_STALE':'LEASE_EXPIRED';}
    return null;
  }
  release():void {
    const a=this.options.authority();if(!this.#session)return;
    if(!this.#authorized(a) || this.#binding(a)!==this.#session.binding)this.#reject('NOT_AUTHORIZED');this.lost('ended');
  }
  /** A local stop/transport teardown may always remove authority; it never grants a replacement. */
  lost(reason:'ended'|'timeout'|'revoked'='revoked'):void {
    this.options.localStop();this.#session=null;
    try{this.options.journal.endManual(this.options.authority(),reason);}catch{this.#failed=true;}
  }
}
