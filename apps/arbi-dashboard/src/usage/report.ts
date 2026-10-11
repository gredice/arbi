import { billingPeriod, type UsageLayer, type UsageObservation } from '@arbi/protocol';
import { JobError } from '../jobs/contracts';
import { periodReport, rollup } from './rollup';
import type { Rule, UsageSettings } from './settings-contracts';

export function usageReport(settings:UsageSettings,atMs:number,rows:UsageObservation[],recent:UsageObservation[],nowMs:number){
  const cycle=billingPeriod(settings.plan.cycle,new Date(atMs).toISOString());if(!cycle.ok || atMs>nowMs)throw new JobError('INVALID_REQUEST');
  const carry=settings.carryForward?.forPeriodStart===cycle.value.start?settings.carryForward.unusedBaseBytes:null;
  const period=periodReport(settings.plan,atMs,rows,nowMs,carry);
  const expected=settings.plan.chargedDirections==='both'?2:1;
  const selected=(totals:ReturnType<typeof rollup>,layer:UsageLayer)=>totals.filter(r=>r.boundary==='garden-sim'&&r.layer===layer&&r.scope==='boundary-total'&&
    (settings.plan.chargedDirections==='both'||r.direction===settings.plan.chargedDirections));
  const layers=period.layers.map(layer=>{
    const totals=selected(period.totals,layer.layer);
    return {...layer,coverageComplete:totals.length===expected&&totals.every(r=>r.coverage==='complete'),stale:totals.some(r=>r.stale),
      unknown:totals.length!==expected||totals.some(r=>r.bytes===null||r.coverage!=='complete'),quality:totals.some(r=>r.quality==='estimated')?'estimated':totals.length&&!totals.some(r=>r.quality==='unavailable')?'measured':'unavailable'};
  });
  const start=Math.max(0,Math.min(nowMs,Date.parse(cycle.value.end))-settings.forecast.lookbackHours*3600000),end=Math.min(nowMs,Date.parse(cycle.value.end));
  const basis=selected(rollup(recent,start,end,nowMs),settings.forecast.layer),complete=basis.length===expected&&basis.every(r=>r.bytes!==null&&r.coverage==='complete'&&!r.stale);
  const used=layers.find(r=>r.layer===settings.forecast.layer)!;
  const knownBytes=complete?basis.reduce((n,r)=>n+BigInt(r.bytes!),0n):null,remainingMs=Math.max(0,Date.parse(cycle.value.end)-end);
  const projected=settings.forecast.method==='constant-average'&&complete&&used.coverageComplete&&used.bytes!==null&&end>start?
    String(BigInt(used.bytes)+knownBytes!*BigInt(remainingMs)/BigInt(end-start)):null;
  const currentBitrate=[];
  for(const layer of ['application-payload','interface-wan','provider'] as const)for(const direction of ['upload','download'] as const){
    const candidates=rows.filter(r=>r.boundary==='garden-sim'&&r.layer===layer&&r.direction===direction&&r.scope==='boundary-total');
    const last=candidates.sort((a,b)=>Date.parse(b.interval.end)-Date.parse(a.interval.end))[0];
    const stale=!last||last.evidence.observedAt===null||nowMs-Date.parse(last.evidence.observedAt)>last.evidence.maxAgeMs||Date.parse(last.evidence.observedAt)>nowMs;
    let bitsPerSecond:string|null=null;
    if(last&&!stale&&last.bytes!==null&&last.evidence.coverage==='complete'){
      const scaled=BigInt(last.bytes)*8000000000n/BigInt(Date.parse(last.interval.end)-Date.parse(last.interval.start));
      bitsPerSecond=`${scaled/1000000n}.${String(scaled%1000000n).padStart(6,'0')}`;
    }
    currentBitrate.push({layer,direction,bitsPerSecond,interval:last?.interval??null,stale,quality:bitsPerSecond===null?'unavailable':'interval-average-estimate',
      sourceQuality:last?.evidence.quality??'unavailable',observationId:last?.observationId??null});
  }
  return {...period,layers,settingsRevision:settings.revision,currentBitrate,
    forecast:{method:settings.forecast.method,layer:settings.forecast.layer,lookbackHours:settings.forecast.lookbackHours,window:{start:new Date(start).toISOString(),end:new Date(end).toISOString()},
      projectedCycleBytes:projected,available:projected!==null,sourceObservationIds:recent.map(r=>r.observationId),assumption:'constant interval-average consumption; complete fresh lookback and cycle coverage required; no price or carrier promise'},
    carryForward:{status:carry===null&&settings.plan.rollover.policy!=='none'?'unknown':'configured',forPeriodStart:settings.carryForward?.forPeriodStart??null},
    configuredTransferMode:settings.transferMode,edgePolicyApplication:'not-observed',
    sessionAttribution:rows.filter(r=>r.media!==null).map(r=>({observationId:r.observationId,boundary:r.boundary,layer:r.layer,direction:r.direction,
      category:r.category,deviceId:r.deviceId,bytes:r.bytes,interval:r.interval,media:r.media,quality:r.evidence.quality,coverage:r.evidence.coverage})),
    sourceRefs:rows.map(r=>({observationId:r.observationId,source:r.source,counterEpoch:r.counterEpoch,interval:r.interval,evidence:r.evidence})),
    attributionNote:'Categories and session windows are already included in their source layers; do not add them or multiply shared streams by viewer count',carrierBillingTruth:false};
}
export type UsageReport=ReturnType<typeof usageReport>;
export function ruleCrossed(rule:Rule,report:UsageReport):boolean {
  const layer=report.layers.find(r=>r.layer===rule.layer)!;
  if(rule.kind==='metering')return rule.condition==='unknown'?layer.unknown:layer.stale;
  if(layer.bytes===null||report.allowanceBytes===null||rule.coverage==='complete'&&!layer.coverageComplete)return false;
  if(BigInt(report.allowanceBytes)===0n)return BigInt(layer.bytes)>0n;
  return BigInt(layer.bytes)*10000n>=BigInt(report.allowanceBytes)*BigInt(rule.thresholdBasisPoints);
}
