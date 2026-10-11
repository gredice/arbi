import { billingPeriod, validateAccounting, type MobilePlan, type UsageLayer } from '@arbi/protocol';
import { sameRealm } from '@arbi/gredice';
import { exact, id, JobError, milliseconds } from '../jobs/contracts';

export const REPORT_VERSION='arbi.usage-report/1.0';
export interface Destination {id:string;kind:'operator-inbox'|'external-adapter'}
export type Rule = {id:string;layer:UsageLayer;destinationIds:string[]} & (
  {kind:'threshold';thresholdBasisPoints:number;coverage:'complete'|'allow-partial'} |
  {kind:'metering';condition:'unknown'|'stale'});
export interface UsageSettings {
  revision:string;plan:MobilePlan;rules:Rule[];destinations:Destination[];
  forecast:{method:'disabled'|'constant-average';layer:UsageLayer;lookbackHours:number};
  carryForward:{forPeriodStart:string;unusedBaseBytes:string}|null;
  transferMode:'normal'|'low-data'|'essential-only';
}
const layers=['application-payload','interface-wan','provider'];
export function usageSettings(input:unknown,realm:MobilePlan['realm'],siteId:string):UsageSettings {
  exact(input,['revision','plan','rules','destinations','forecast','carryForward','transferMode']);id(input.revision);
  const p=validateAccounting(input.plan);if(!p.ok || p.value.kind!=='mobile-plan' || !sameRealm(p.value.realm,realm) || p.value.siteId!==siteId)throw new JobError('INVALID_REQUEST');
  if(!Array.isArray(input.rules) || input.rules.length>16 || !Array.isArray(input.destinations) || input.destinations.length>8)throw new JobError('INVALID_REQUEST');
  const destinationIds=new Set<string>(),ruleIds=new Set<string>();
  for(const d of input.destinations){exact(d,['id','kind']);id(d.id);if(!['operator-inbox','external-adapter'].includes(String(d.kind)) || destinationIds.has(d.id))throw new JobError('INVALID_REQUEST');destinationIds.add(d.id);}
  for(const r of input.rules){
    exact(r,r?.kind==='threshold'?['id','kind','layer','destinationIds','thresholdBasisPoints','coverage']:['id','kind','layer','destinationIds','condition']);id(r.id);
    if(ruleIds.has(r.id) || !layers.includes(String(r.layer)) || !Array.isArray(r.destinationIds) || !r.destinationIds.length || r.destinationIds.length>8 ||
      new Set(r.destinationIds).size!==r.destinationIds.length || r.destinationIds.some(d=>typeof d!=='string'||!destinationIds.has(d)))throw new JobError('INVALID_REQUEST');ruleIds.add(r.id);
    if(r.kind==='threshold'){milliseconds(r.thresholdBasisPoints,1,100000);if(!['complete','allow-partial'].includes(String(r.coverage)))throw new JobError('INVALID_REQUEST');}
    else if(r.kind!=='metering' || !['unknown','stale'].includes(String(r.condition)))throw new JobError('INVALID_REQUEST');
  }
  exact(input.forecast,['method','layer','lookbackHours']);milliseconds(input.forecast.lookbackHours,1,168);
  if(!layers.includes(String(input.forecast.layer)) || !['disabled','constant-average'].includes(String(input.forecast.method)) || !['normal','low-data','essential-only'].includes(String(input.transferMode)))throw new JobError('INVALID_REQUEST');
  if(input.carryForward!==null){exact(input.carryForward,['forPeriodStart','unusedBaseBytes']);
    const carry=input.carryForward;if(typeof carry.forPeriodStart!=='string' || typeof carry.unusedBaseBytes!=='string' || !/^(0|[1-9][0-9]{0,19})$/.test(carry.unusedBaseBytes) || BigInt(carry.unusedBaseBytes)>18446744073709551615n)throw new JobError('INVALID_REQUEST');
    const period=billingPeriod(p.value.cycle,carry.forPeriodStart);if(!period.ok || period.value.start!==carry.forPeriodStart)throw new JobError('INVALID_REQUEST');
  }
  if(Buffer.byteLength(JSON.stringify(input))>16384)throw new JobError('CAPACITY');return structuredClone(input) as unknown as UsageSettings;
}
export function reportQuery(input:unknown):{linkId:string;atMs:number}{
  exact(input,['linkId','atMs']);id(input.linkId);milliseconds(input.atMs,0,253402300799999);return input as unknown as {linkId:string;atMs:number};
}
