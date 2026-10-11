import { configurationDigest } from '@arbi/protocol';
import { validateCaptureHistoryRow } from '@arbi/protocol/capture-history';
import type { CaptureHistoryRow } from '@arbi/protocol/capture-history';
import { validateCaptureManifest } from '@arbi/protocol/capture-transfer';
import type { CaptureManifest } from '@arbi/protocol/capture-transfer';
import type { CaptureStage } from './stage.js';
import type { CommissioningSet } from '../commissioning/contracts.js';
import type { JobJournal } from '../jobs/journal.js';
/** Privileged native reads only. Pod records come from an authenticated current
 * adapter; no browser input, raw bytes or cached outcome creates capture proof. */
export class CaptureHistorySource {
  constructor(readonly options:{stage:CaptureStage;podResults:()=>unknown[];configuration:(revision:string)=>CommissioningSet|null;journal?:JobJournal;
    admission?:(jobId:string)=>{origin:'on-demand'|'scheduled';priority:number;queue:string;scheduledUtcMs:number|null}|null}){}
  rows():CaptureHistoryRow[]{
    const staged=this.options.stage.rows(),results=this.options.podResults();if(!Array.isArray(results)||results.length>128)throw Error('HISTORY_CAPACITY');
    const rows:CaptureHistoryRow[]=staged.map(s=>({id:s.manifest.image.id,commandId:s.manifest.commandId,correlationId:s.manifest.correlationId,targetId:s.manifest.targetId,association:this.#association(s.manifest),job:this.#job(s.manifest.correlationId),camera:{state:'captured',phase:'captured',reason:null,focus:(s.manifest.metadata.focus as {status?:string})?.status==='focused'?'focused':'unavailable'},manifest:s.manifest,artifacts:s.artifacts,retention:s.state,warnings:s.events}));
    for(const value of results){if(!value||typeof value!=='object')throw Error('HISTORY_INVALID');const r=value as {version:string;commandId:string;correlationId:string;resourceId:string;fingerprint:string;state:string;phase:string;reason:string|null;image:{file:string;id:string;sha256:string;bytes:number;contentType:'image/png';widthPx:number;heightPx:number}|null;metadata:Record<string,unknown>|null};
      if(r.version!=='arbi.capture-result/1.0'||!['reserved','writing','captured','failed'].includes(r.state)||!/^[a-f0-9]{64}$/.test(r.fingerprint))throw Error('HISTORY_INVALID');
      if(rows.some(row=>row.commandId===r.commandId))continue;
      if(r.state==='captured'){if(!r.image||!r.metadata)throw Error('HISTORY_INVALID');const {file:_,...image}=r.image,m:CaptureManifest={version:'arbi.capture-manifest/1.0',realm:this.options.stage.options.realm,siteId:this.options.stage.options.siteId,podDeviceId:(r.metadata.source as {deviceId:string}).deviceId,commandId:r.commandId,correlationId:r.correlationId,targetId:r.resourceId,captureFingerprint:r.fingerprint,image,metadata:r.metadata};validateCaptureManifest(m);
        rows.push({id:image.id,commandId:r.commandId,correlationId:r.correlationId,targetId:r.resourceId,association:this.#association(m),job:this.#job(r.correlationId),camera:{state:'captured',phase:r.phase,reason:r.reason,focus:(r.metadata.focus as {status?:string})?.status==='focused'?'focused':'unavailable'},manifest:m,artifacts:[],retention:'not-staged',warnings:['EDGE_CUSTODY_UNAVAILABLE']});continue;}
      rows.push({id:r.commandId,commandId:r.commandId,correlationId:r.correlationId,targetId:r.resourceId,association:null,job:this.#job(r.correlationId),camera:{state:r.state==='failed'?'failed':'pending',phase:r.phase,reason:r.reason,focus:r.reason?.includes('FOCUS')?'failed':'unavailable'},manifest:null,artifacts:[],retention:'not-staged',warnings:[]});
    }
    if(rows.length>128)throw Error('HISTORY_CAPACITY');for(const row of rows)validateCaptureHistoryRow(row);return rows;
  }
  #association(m:CaptureManifest):CaptureHistoryRow['association']{
    const c=m.metadata.configuration as {revision:string;digest:string},set=this.options.configuration(c.revision);
    if(!set||configurationDigest(set.configuration)!==c.digest)return null;
    const target=set.targets.find(t=>t.id===m.targetId);return target?{bedId:target.bedId,plantId:target.plantId,configurationRevision:c.revision}:null;
  }
  #job(id:string):CaptureHistoryRow['job']{const r=this.options.journal?.get(id);if(!r)return null;if(r.command.siteId!==this.options.stage.options.siteId||configurationDigest(r.command.realm)!==configurationDigest(this.options.stage.options.realm))throw Error('HISTORY_SCOPE_INVALID');const a=this.options.admission?.(id);return {id:r.command.command.commandId,origin:a?.origin??'unavailable',priority:a?.priority??null,queue:a?.queue??'unavailable',scheduledUtcMs:a?.scheduledUtcMs??null,phase:r.phase,outcome:r.outcome};}
}
