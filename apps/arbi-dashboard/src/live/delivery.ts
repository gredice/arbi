import {isDeepStrictEqual} from 'node:util';
import {validateAccounting,type UsageObservation} from '@arbi/protocol';
import type {SqlSession} from '../enrollment/store';
import {scope} from '../audit/store';
import {exact,id,JobError,milliseconds} from '../jobs/contracts';
import type {LiveViewer} from './contracts';
export interface DeliverySummary {viewerUsageId:string;upstreamUsageId:string|null;relayUsageId:string|null;startMonotonicMs:number;endMonotonicMs:number}
/** References existing immutable accounting windows. It never creates or sums a second traffic ledger. */
export async function deliverySummary(sql:SqlSession,viewer:LiveViewer,input:unknown,sourceTime:UsageSourceTime){
  exact(sourceTime,['utc','uncertaintyMs','monotonicMs']);milliseconds(sourceTime.monotonicMs,0,Number.MAX_SAFE_INTEGER);
  if(typeof sourceTime.utc!=='string'||!Number.isFinite(Date.parse(sourceTime.utc))||new Date(sourceTime.utc).toISOString()!==sourceTime.utc||
    typeof sourceTime.uncertaintyMs!=='number'||!Number.isFinite(sourceTime.uncertaintyMs)||sourceTime.uncertaintyMs<0)throw new JobError('INVALID_REQUEST');
  exact(input,['viewerUsageId','upstreamUsageId','relayUsageId','startMonotonicMs','endMonotonicMs']);id(input.viewerUsageId);
  for(const field of ['upstreamUsageId','relayUsageId'])if(input[field]!==null)id(input[field]);
  milliseconds(input.startMonotonicMs,0,Number.MAX_SAFE_INTEGER);milliseconds(input.endMonotonicMs,1,Number.MAX_SAFE_INTEGER);
  const summary=input as unknown as DeliverySummary,width=summary.endMonotonicMs-summary.startMonotonicMs;
  if(width<1000||width>15000||summary.endMonotonicMs!==sourceTime.monotonicMs||sourceTime.utc===null||sourceTime.uncertaintyMs===null||sourceTime.uncertaintyMs>1000||
    viewer.delivery&&summary.startMonotonicMs<viewer.delivery.endMonotonicMs)throw new JobError('INVALID_REQUEST');
  const ids=[summary.viewerUsageId,summary.upstreamUsageId,summary.relayUsageId].filter((v):v is string=>v!==null);
  if(new Set(ids).size!==ids.length)throw new JobError('INVALID_REQUEST');
  const rows=(await sql.query<{record:UsageObservation}>(`SELECT record FROM arbi_usage_windows WHERE environment=$1 AND namespace_id=$2 AND site_id=$3
    AND observation_id=ANY($4::text[]) AND NOT EXISTS(SELECT 1 FROM arbi_usage_corrections c WHERE c.environment=arbi_usage_windows.environment
    AND c.namespace_id=arbi_usage_windows.namespace_id AND c.site_id=arbi_usage_windows.site_id AND c.observation_id=arbi_usage_windows.observation_id)`,
    [...scope(viewer.authority.realm,viewer.authority.siteId),ids])).rows;
  const observations=new Map(rows.map(r=>[r.record.observationId,r.record]));
  const firstGrant=Number((await sql.query<{at:string}>(`SELECT min((record->>'createdAtMs')::bigint)::text at FROM arbi_live_viewers WHERE producer_id=$1
    AND environment=$2 AND namespace_id=$3 AND site_id=$4 AND record->'target'=$5::jsonb AND record->>'configRevision'=$6`,
    [viewer.producerId,...scope(viewer.authority.realm,viewer.authority.siteId),JSON.stringify(viewer.target),viewer.configRevision])).rows[0]?.at);
  if(!Number.isSafeInteger(firstGrant)||firstGrant<=0)throw new JobError('DENIED');
  for(const observationId of ids){
    const o=observations.get(observationId);if(!o||!validateAccounting(o).ok||!isDeepStrictEqual(o.source,viewer.target)||o.scope!=='attributed'||
      !isDeepStrictEqual(o.realm,viewer.authority.realm)||o.siteId!==viewer.authority.siteId||o.deviceId!==viewer.target.deviceId||
      o.executionMode!=='simulation'||o.layer!=='application-payload'||o.media?.sessionId!==viewer.producerId||o.media.topology!=='shared'||
      o.media.viewerCount<1||o.media.viewerCount>viewer.profile.maxViewers||o.bytes===null||o.evidence.quality!=='measured'||!o.evidence.includes.includes('payload')||
      Date.parse(o.interval.start)<(observationId===summary.viewerUsageId?viewer.createdAtMs:firstGrant)||Date.parse(o.interval.end)>viewer.expiresAtMs||Date.parse(o.interval.end)-Date.parse(o.interval.start)!==width||
      Math.abs(Date.parse(o.interval.end)-Date.parse(sourceTime.utc))>sourceTime.uncertaintyMs)throw new JobError('DENIED');
    const upstream=observationId===summary.upstreamUsageId,relay=observationId===summary.relayUsageId;
    if(upstream?o.boundary!=='garden-sim'||o.direction!=='upload'||o.category!=='live-video'||o.media.viewerId!==null:
      o.boundary!==(relay?'cloud-relay':'cloud-viewer')||o.direction!=='download'||o.category!==(relay?'turn':'live-video')||o.media.viewerId!==(relay?null:viewer.id))throw new JobError('DENIED');
  }
  if((await sql.query(`SELECT id FROM arbi_live_reports WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND record->'payload'->'summary'->>'viewerUsageId'=$4 LIMIT 1`,
    [...scope(viewer.authority.realm,viewer.authority.siteId),summary.viewerUsageId])).rows.length)throw new JobError('CONFLICT');
  const viewerBytes=observations.get(summary.viewerUsageId)!.bytes!;
  for(const observationId of ids)if(BigInt(observations.get(observationId)!.bytes!)>BigInt(Math.ceil((observationId===summary.upstreamUsageId?viewer.profile.maxUpstreamBps:viewer.profile.maxDownstreamBps)*width/8000)))throw new JobError('DENIED');
  return {summary,viewerBytes:Number(viewerBytes),usageVisibility:'referenced-accounting-windows' as const,coverage:'partial' as const};
}
interface UsageSourceTime {utc:string|null;uncertaintyMs:number|null;monotonicMs:number}
