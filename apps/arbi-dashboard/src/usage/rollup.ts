import { billingPeriod, cycleAllowance, directionIsCharged, validateAccounting, type MobilePlan, type UsageObservation } from '@arbi/protocol';
import { JobError } from '../jobs/contracts';
import { MAX_ROWS } from './contracts';

export interface Rollup {
  boundary: UsageObservation['boundary']; layer: UsageObservation['layer']; direction: UsageObservation['direction'];
  scope: UsageObservation['scope']; deviceId: string|null; category: UsageObservation['category']; attributionRevision: string|null;
  start: string; end: string; bytes: string|null; quality: UsageObservation['evidence']['quality'];
  coverage: 'complete'|'partial'|'unknown'; gaps: {start:string;end:string}[]; gapsTruncated: boolean;
  stale: boolean; observedAt: string|null; observationIds: string[]; allocation: 'exact'|'time-proportional-estimate';
  counterEpochs: string[]; collectors: UsageObservation['source'][]; componentScopes: UsageObservation['evidence']['includes'][];
}
const iso=(ms:number)=>new Date(ms).toISOString();
/** Delta bytes are never presented as measured when a requested boundary cuts a source interval. */
export function rollup(rows: UsageObservation[], fromMs: number, toMs: number, nowMs: number): Rollup[] {
  if (rows.length>MAX_ROWS) throw new JobError('CAPACITY');
  const groups=new Map<string,{rows:UsageObservation[]; template:UsageObservation}>();
  for(const o of rows) {
    const key=JSON.stringify([o.boundary,o.layer,o.direction,o.scope,o.deviceId,o.category,o.attributionRevision]);
    let g=groups.get(key);if(!g){g={rows:[],template:o};groups.set(key,g);}g.rows.push(o);
  }
  if(groups.size>256) throw new JobError('CAPACITY');
  return [...groups.values()].map(({rows,template:o})=>{
    let total=0n,known=false,estimated=false,partial=false,unknown=false,stale=false,latest:string|null=null,covered=fromMs;
    const gaps:{start:string;end:string}[]=[],ids:string[]=[];
    for(const row of rows.sort((a,b)=>a.interval.start.localeCompare(b.interval.start))) {
      const start=Date.parse(row.interval.start),end=Date.parse(row.interval.end),left=Math.max(fromMs,start),right=Math.min(toMs,end);
      if(right<=left)continue;ids.push(row.observationId);
      if(row.evidence.observedAt!==null) {
        latest=iso(Math.max(latest===null?0:Date.parse(latest),Date.parse(row.evidence.observedAt)));
        stale ||= nowMs-Date.parse(row.evidence.observedAt)>row.evidence.maxAgeMs || nowMs<Date.parse(row.evidence.observedAt);
      }
      if(row.bytes===null){unknown=true;continue;}
      known=true;
      // Cumulative integer allocation conserves bytes across adjacent query/day/cycle slices.
      const delta=BigInt(row.bytes),width=BigInt(end-start);
      total+=delta*BigInt(right-start)/width-delta*BigInt(left-start)/width;
      estimated ||= row.evidence.quality==='estimated' || left!==start || right!==end;
      partial ||= row.evidence.coverage!=='complete';
      if(left>covered)gaps.push({start:iso(covered),end:iso(left)});
      covered=Math.max(covered,right);
    }
    if(covered<toMs)gaps.push({start:iso(covered),end:iso(toMs)});
    // Attribution windows can be concurrent attempts; their temporal coverage cannot prove link coverage.
    return {boundary:o.boundary,layer:o.layer,direction:o.direction,scope:o.scope,deviceId:o.deviceId,category:o.category,
      attributionRevision:o.attributionRevision,start:iso(fromMs),end:iso(toMs),bytes:known?String(total):null,
      quality:known?(estimated?'estimated':'measured'):'unavailable',coverage:!known?'unknown':unknown || partial || gaps.length || o.scope==='attributed'?'partial':'complete',
      gaps:gaps.slice(0,32),gapsTruncated:gaps.length>32,stale,observedAt:latest,observationIds:ids,
      allocation:rows.some(r=>Date.parse(r.interval.start)<fromMs || Date.parse(r.interval.end)>toMs)?'time-proportional-estimate':'exact',
      counterEpochs:[...new Set(rows.map(r=>r.counterEpoch))],collectors:[...new Map(rows.map(r=>[JSON.stringify(r.source),r.source])).values()],
      componentScopes:[...new Map(rows.map(r=>[JSON.stringify([...r.evidence.includes].sort()),r.evidence.includes])).values()]};
  });
}

/** Compare overlapping layers; neither residual nor classifier rows are added to the selected total. */
export function comparisons(totals: Rollup[]) {
  return totals.filter(r=>r.boundary==='garden-sim' && r.scope==='boundary-total').map(total=>{
    const parts=totals.filter(r=>r.boundary===total.boundary && r.layer===total.layer && r.direction===total.direction && r.scope==='attributed');
    const revisions=[...new Set(parts.map(r=>r.attributionRevision))];
    const byRevision=revisions.map(revision=>{
      const rows=parts.filter(p=>p.attributionRevision===revision),known=rows.filter(p=>p.bytes!==null);
      const classified=known.reduce((n,p)=>n+BigInt(p.bytes!),0n),residual=total.bytes===null?null:BigInt(total.bytes)-classified;
      return {attributionRevision:revision,classifiedBytes:String(classified),unattributedBytes:residual===null || residual<0n?null:String(residual),
        status:residual!==null && residual<0n?'inconsistent':known.length!==rows.length || total.coverage!=='complete'?'partial':'complete'};
    });
    return {layer:total.layer,direction:total.direction,bytes:total.bytes,quality:total.quality,coverage:total.coverage,byRevision,
      applicationComparison:total.layer==='application-payload'?null:totals.filter(r=>r.boundary==='garden-sim' && r.layer==='application-payload' && r.direction===total.direction && r.scope==='boundary-total').map(r=>({bytes:r.bytes,quality:r.quality,coverage:r.coverage}))};
  });
}

export function periodReport(plan: MobilePlan, atMs: number, rows: UsageObservation[], nowMs: number, previousUnusedBaseBytes: string|null) {
  const checked=validateAccounting(plan),period=billingPeriod(plan.cycle,iso(atMs)),allowance=cycleAllowance(plan,previousUnusedBaseBytes);
  if(!checked.ok || !period.ok || !allowance.ok)throw new JobError('INVALID_REQUEST');
  const totals=rollup(rows,Date.parse(period.value.start),Math.min(nowMs,Date.parse(period.value.end)),nowMs);
  const used=totals.filter(r=>r.boundary==='garden-sim' && r.scope==='boundary-total' && directionIsCharged(plan,r.direction).ok &&
    (plan.chargedDirections==='both' || plan.chargedDirections===r.direction));
  const layers=['application-payload','interface-wan','provider'] as const;
  return {period:period.value,timezone:plan.cycle.timezone,timezoneDatabase:process.versions.tz,allowanceBytes:allowance.value,
    totals,comparisons:comparisons(totals),layers:layers.map(layer=>{
      const selected=used.filter(r=>r.layer===layer),expected=plan.chargedDirections==='both'?2:1;
      const bytes=selected.length && selected.every(r=>r.bytes!==null)?String(selected.reduce((n,r)=>n+BigInt(r.bytes!),0n)):null;
      const complete=selected.length===expected && selected.every(r=>r.coverage==='complete' && !r.stale);
      return {layer,bytes,complete,remainingBytes:complete && bytes!==null && allowance.value!==null?String(BigInt(allowance.value)>BigInt(bytes)?BigInt(allowance.value)-BigInt(bytes):0n):null,
        authority:layer==='provider'?'provider-reported':layer==='interface-wan'?'observed-interface':'application-only'};
    })};
}
