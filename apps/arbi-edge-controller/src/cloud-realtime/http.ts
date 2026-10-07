import { sign } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { configurationDigest, validateMessage } from '@arbi/protocol';
import { ApplicationMeter } from '@arbi/traffic';
import type { Scope, TransferSpec } from '@arbi/traffic';
import { VERSION } from './contracts.js';
import type { Admission, ConsumerConfig, Recovery, RecoveryApi } from './contracts.js';
async function* chunk(bytes: Uint8Array) { yield bytes; }
/** Real attempted JSON application bytes, including failed submissions and every
 * received response chunk. SDK framing/TLS/DNS/WAN/provider counters are separate. */
export class HttpsRecoveryApi implements RecoveryApi {
  #busy=false;#window=0;#bytes=0;#calls=0;
  readonly origin: string;
  constructor(readonly config: ConsumerConfig & { credentialId: string; key: KeyObject; origin: string },readonly meter: ApplicationMeter,
    readonly trafficScope: Scope, readonly transport: typeof fetch=fetch, isolatedLoopback=false) {
    const url=new URL(config.origin);
    if (url.origin!==config.origin || config.realm.environment==='production' || config.key.asymmetricKeyType!=='ed25519' ||
      (url.protocol!=='https:' && !(isolatedLoopback && url.protocol==='http:' && url.hostname==='127.0.0.1' && trafficScope.boundary==='lan')) ||
      trafficScope.siteId!==config.siteId || JSON.stringify(trafficScope.realm)!==JSON.stringify(config.realm) || trafficScope.executionMode!=='simulation' ||
      trafficScope.source.deviceId!==config.identity.deviceId) throw new Error('INVALID_CONFIGURATION');
    this.origin=url.origin;
  }
  spec(direction: 'upload' | 'download', category: TransferSpec['category']): TransferSpec {
    return { scope: this.trafficScope,direction,category,includes: ['payload'],maxAgeMs: 10000,retryOf: null,media: null };
  }
  count(bytes: number): void { this.#bytes+=bytes;if(this.#bytes>2*1024*1024) throw new Error('TRAFFIC_BUDGET'); }
  async request(version: string, action: string, payload: unknown, path: string): Promise<unknown> {
    const now=Date.now();
    if(now-this.#window>=60000) {this.#window=now;this.#bytes=0;this.#calls=0;}
    if(this.#busy || this.#calls>=60 || this.#bytes>=2*1024*1024) throw new Error('RECOVERY_BUDGET');
    this.#busy=true;this.#calls++;
    const controller=new AbortController();const timer=setTimeout(() => controller.abort(),4000);
    try {
      const unsigned={version,realm:this.config.realm,siteId:this.config.siteId,deviceId:this.config.identity.deviceId,credentialId:this.config.credentialId,
        identity:this.config.identity,issuedAtMs:now,expiresAtMs:now+10000,action,payload};
      const signature=sign(null,Buffer.from(`arbi-device-proof/1.0:${configurationDigest(unsigned)}`),this.config.key).toString('base64url');
      const bytes=Buffer.from(JSON.stringify({...unsigned,signature}));if(bytes.length>16384) throw new Error('REQUEST_CAPACITY');
      let response: Response | undefined;
      await this.meter.upload(this.spec('upload',action==='attach' ? 'reconnect' : 'control'),chunk(bytes),async (body) => {
        this.count(body.byteLength);
        response=await this.transport(`${this.origin}/api/sites/${encodeURIComponent(this.config.siteId)}/${path}/device`,{
          method:'POST',headers:{'content-type':'application/json'},body:Buffer.from(body),signal:controller.signal,redirect:'error',cache:'no-store'});
      });
      if(!response?.body) throw new Error('HTTP_UNAVAILABLE');
      const chunks: Uint8Array[]=[];let size=0;
      const stream=response.body as unknown as AsyncIterable<Uint8Array>;
      try {
        for await(const part of this.meter.download(this.spec('download',action==='attach' ? 'reconnect' : 'telemetry'),stream)) {
          this.count(part.byteLength);size+=part.byteLength;if(size>65536) throw new Error('RESPONSE_CAPACITY');chunks.push(part);
        }
      } finally { controller.abort(); }
      if(!response.ok) throw new Error('HTTP_DENIED');
      return JSON.parse(Buffer.concat(chunks).toString());
    } finally {clearTimeout(timer);controller.abort();this.#busy=false;}
  }
  async attach(): Promise<Admission> { return await this.request(VERSION,'attach',{grantId:null},'realtime') as Admission; }
  async recover(grantId: string,epoch: string|null,cursor: string|null): Promise<Recovery> {
    return await this.request(VERSION,'recover',{grantId,epoch,cursor},'realtime') as Recovery;
  }
  async pollJobs(): Promise<number> {
    const value=await this.request('arbi.jobs-device/1.0','poll',{},'jobs') as {commands?: unknown[]};
    if(!Array.isArray(value.commands) || value.commands.length>8) throw new Error('INVALID_JOBS');
    for(const command of value.commands) {
      const checked=validateMessage(command);
      if(!checked.ok || checked.value.kind!=='command' || JSON.stringify(checked.value.realm)!==JSON.stringify(this.config.realm) ||
        checked.value.siteId!==this.config.siteId || checked.value.executionMode!=='simulation' ||
        JSON.stringify(checked.value.command.target)!==JSON.stringify(this.config.identity)) throw new Error('INVALID_JOB_SCOPE');
    }
    // Deliberately discard envelopes. No acceptance/outcome or dispatch occurs.
    return value.commands.length;
  }
}
