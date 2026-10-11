import { boundedIncidentJson,incidentMeasurements,parseIncident } from './incident.js';
export interface IncidentPrediction {recordId:string;metric:string;unit:string;value:number;uncertainty:number|null}
/** Compare explicitly paired records. No resampling, interpolation, fitting or modification of model parameters. */
export function compareIncident(input:unknown,predictions:IncidentPrediction[]) {
  const b=parseIncident(input);predictions=boundedIncidentJson(predictions) as IncidentPrediction[];
  if(!Array.isArray(predictions) || predictions.length>512) throw Error('INVALID_COMPARISON');
  const keys=new Set<string>();
  for(const p of predictions){
    if(!p || Object.keys(p).sort().join(',')!=='metric,recordId,uncertainty,unit,value' ||
      ![p.recordId,p.metric,p.unit].every(v=>typeof v==='string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v)) ||
      !Number.isFinite(p.value) || Math.abs(p.value)>1e9 || p.uncertainty!==null && (!Number.isFinite(p.uncertainty) || p.uncertainty<0 || p.uncertainty>1e9)) throw Error('INVALID_COMPARISON');
    const key=JSON.stringify([p.recordId,p.metric]);if(keys.has(key))throw Error('INVALID_COMPARISON');keys.add(key);
  }
  const samples=incidentMeasurements(b),excluded:Array<{recordId:string;metric:string;reason:string}>=[];
  const residuals:Array<{recordId:string;metric:string;unit:string;residual:number;uncertainty:number|null;value:number;offsetMs:number;clockUncertaintyMs:number|null}>=[];
  for(const p of predictions){
    const matches=samples.filter(s=>s.recordId===p.recordId && s.metric===p.metric);
    if(matches.length!==1){excluded.push({recordId:p.recordId,metric:p.metric,reason:matches.length?'ambiguous-record':'missing-record'});continue;}
    const s=matches[0]!;
    if(s.unit!==p.unit)throw Error('UNIT_MISMATCH');
    if(s.quality!=='measured' || s.value===null || s.sampleMonotonicMs===null){excluded.push({recordId:p.recordId,metric:p.metric,reason:'not-a-recorded-measurement'});continue;}
    residuals.push({recordId:p.recordId,metric:p.metric,unit:p.unit,residual:s.value-p.value,
      uncertainty:s.uncertainty===null || p.uncertainty===null?null:s.uncertainty+p.uncertainty,value:s.value,offsetMs:s.offsetMs,clockUncertaintyMs:s.sourceTime.uncertaintyMs});
  }
  const groups=[...new Set(residuals.map(r=>JSON.stringify([r.metric,r.unit])))].map(key=>{
    const [metric,unit]=JSON.parse(key) as [string,string],rows=residuals.filter(r=>r.metric===metric && r.unit===unit);
    return {metric,unit,count:rows.length,bias:rows.reduce((n,r)=>n+r.residual,0)/rows.length,
      rmse:Math.sqrt(rows.reduce((n,r)=>n+r.residual*r.residual,0)/rows.length),maxAbsolute:Math.max(...rows.map(r=>Math.abs(r.residual))),
      testedOperatingRange:{min:Math.min(...rows.map(r=>r.value)),max:Math.max(...rows.map(r=>r.value))},
      missingValueUncertainty:rows.filter(r=>r.uncertainty===null).length,unknownClockQuality:rows.filter(r=>r.clockUncertaintyMs===null).length};
  });
  return {schemaVersion:'arbi.model-comparison/1.0',data:b.data,model:b.model,bundleDigest:b.digest,
    pairing:'explicit-record-id-no-interpolation',residuals,groups,excluded,
    physicalEvidence:b.data.origin==='synthetic'?'unavailable-synthetic-only':'declared-recording-requires-separate-review',
    fittedParameters:false};
}
