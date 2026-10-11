import { Ajv2020 } from 'ajv/dist/2020.js';
import { validateConfigurationRecord,type AppliedConfiguration } from '@arbi/protocol';
import { readBounded } from './bounded.js';
export interface PodSettings {
  schemaVersion:'arbi.pod-runtime/1.0';executionMode:'simulation';healthPort:number;modulePort:number;storageDirectory:string;
  tls:{caFile:string;certFile:string;keyFile:string;edgeCertificateSha256:string};
  applied:AppliedConfiguration;acceptedConfigurationDigest:string;
}
const path={type:'string',minLength:1,maxLength:1024};const digest={type:'string',pattern:'^[a-f0-9]{64}$'};
const validate=new Ajv2020({strict:true}).compile({type:'object',additionalProperties:false,
  required:['schemaVersion','executionMode','healthPort','modulePort','storageDirectory','tls','applied','acceptedConfigurationDigest'],
  properties:{schemaVersion:{const:'arbi.pod-runtime/1.0'},executionMode:{const:'simulation'},healthPort:{type:'integer',minimum:0,maximum:65535},modulePort:{type:'integer',minimum:0,maximum:65535},
    storageDirectory:path,acceptedConfigurationDigest:digest,applied:{type:'object'},tls:{type:'object',additionalProperties:false,
      required:['caFile','certFile','keyFile','edgeCertificateSha256'],properties:{caFile:path,certFile:path,keyFile:path,edgeCertificateSha256:digest}}}});
export function validatePodSettings(input:unknown):PodSettings {
  if(!validate(input))throw new Error('INVALID_SETTINGS');const s=structuredClone(input) as PodSettings;
  const a=validateConfigurationRecord(s.applied,'applied');if(!a.ok)throw new Error('CONFIGURATION_INCOMPATIBLE');
  const c=a.value.request.configuration,component=c.components.find(v=>v.id==='pod');
  if(c.executionMode!=='simulation' || c.realm.environment!=='test' || c.calibration?.scope!=='simulation'
    || component?.kind!=='module' || component.role!=='pod' || s.acceptedConfigurationDigest!==a.value.configurationDigest
    || a.value.appliedBy.deviceId!=='edge')throw new Error('CONFIGURATION_INCOMPATIBLE');
  return s;
}
export function loadPodSettings(file:string):PodSettings {return validatePodSettings(JSON.parse(readBounded(file,262144).toString('utf8')));}
