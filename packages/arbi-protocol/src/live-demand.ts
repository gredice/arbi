/** Private Node control-plane projection shared by the cloud and isolated
 * producer. It grants no actuator authority or production media transport. */
import type { Identity,Realm } from './messages.js';
import { closedTransfer,transferId,transferIdentity,transferFail } from './capture-transfer.js';
export interface LiveProducerProfile {id:string;transport:'isolated-signaling';maxUpstreamBps:number;maxDownstreamBps:number;maxViewers:number}
export interface LiveProducerDemand {version:'arbi.live/1.0';realm:Realm;siteId:string;id:string;generation:string;target:Identity;configRevision:string;
  profile:LiveProducerProfile;viewers:number;issuedAtMs:number;expiresAtMs:number;sharedUpstream:true}
const integer=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
export function validateLiveProducerDemand(d:LiveProducerDemand):void {
  closedTransfer(d,['version','realm','siteId','id','generation','target','configRevision','profile','viewers','issuedAtMs','expiresAtMs','sharedUpstream']);
  closedTransfer(d.realm,['environment','namespaceId']);transferIdentity(d.target);
  if(d.version!=='arbi.live/1.0'||d.realm.environment!=='test'||![d.realm.namespaceId,d.siteId,d.id,d.configRevision].every(transferId)||d.sharedUpstream!==true||typeof d.generation!=='string'||!(/^[1-9][0-9]{0,19}$/).test(d.generation)||BigInt(d.generation)>(1n<<64n)-1n)transferFail('LIVE_DEMAND_INVALID');
  const p=d.profile;closedTransfer(p,['id','transport','maxUpstreamBps','maxDownstreamBps','maxViewers']);
  if(!transferId(p.id)||p.transport!=='isolated-signaling'||!integer(p.maxUpstreamBps,1,2000000)||!integer(p.maxDownstreamBps,1,8000000)||!integer(p.maxViewers,1,4)||!integer(d.viewers,0,p.maxViewers)||!integer(d.issuedAtMs,0,Number.MAX_SAFE_INTEGER)||!integer(d.expiresAtMs,d.issuedAtMs,d.issuedAtMs+15000))transferFail('LIVE_DEMAND_INVALID');
}
