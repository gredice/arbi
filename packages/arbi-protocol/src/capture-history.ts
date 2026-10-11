/** Private, bounded source projection. Import types only in the browser. */
import { configurationDigest } from './configuration.js';
import { closedTransfer,transferId,transferFail,validateCaptureManifest } from './capture-transfer.js';
import type { CaptureManifest } from './capture-transfer.js';
import { validateCaptureTrace,verifyCaptureUpload } from './capture-upload.js';
import type { CaptureTrace,CaptureUploadReceipt } from './capture-upload.js';
export interface CaptureHistoryRow {
  id:string;commandId:string;correlationId:string;targetId:string;
  association:{bedId:string;plantId:string|null;configurationRevision:string}|null;
  job:{id:string;origin:'on-demand'|'scheduled'|'unavailable';priority:number|null;queue:string;scheduledUtcMs:number|null;phase:string;outcome:string}|null;
  camera:{state:'pending'|'captured'|'failed';phase:string;reason:string|null;focus:'focused'|'failed'|'unavailable'};
  manifest:CaptureManifest|null;
  artifacts:{trace:CaptureTrace;upload:{state:'pending'|'uploaded'|'failed';attempts:number|null;reason:string|null;receipt:CaptureUploadReceipt|null}}[];
  retention:'not-staged'|'writing'|'retained'|'failed'|'expiring'|'expired'|'corrupt';warnings:string[];
}
export function validateCaptureHistoryRow(row:CaptureHistoryRow):void {
  closedTransfer(row,['id','commandId','correlationId','targetId','association','job','camera','manifest','artifacts','retention','warnings']);
  if(![row.id,row.commandId,row.correlationId,row.targetId].every(transferId)||!['not-staged','writing','retained','failed','expiring','expired','corrupt'].includes(row.retention)||!Array.isArray(row.warnings)||row.warnings.length>16||!row.warnings.every(transferId)||!Array.isArray(row.artifacts)||row.artifacts.length>2)transferFail('HISTORY_INVALID');
  const c=row.camera;closedTransfer(c,['state','phase','reason','focus']);
  if(!['pending','captured','failed'].includes(c.state)||!transferId(c.phase)||!(c.reason===null||transferId(c.reason))||!['focused','failed','unavailable'].includes(c.focus))transferFail('HISTORY_INVALID');
  if(row.association){closedTransfer(row.association,['bedId','plantId','configurationRevision']);if(![row.association.bedId,row.association.configurationRevision].every(transferId)||!(row.association.plantId===null||transferId(row.association.plantId)))transferFail('HISTORY_INVALID');}
  if(row.job){const j=row.job;closedTransfer(j,['id','origin','priority','queue','scheduledUtcMs','phase','outcome']);if(![j.id,j.queue,j.phase,j.outcome].every(transferId)||!['on-demand','scheduled','unavailable'].includes(j.origin)||!(j.priority===null||Number.isInteger(j.priority)&&j.priority>=0&&j.priority<=255)||!(j.scheduledUtcMs===null||Number.isSafeInteger(j.scheduledUtcMs)&&j.scheduledUtcMs>=0))transferFail('HISTORY_INVALID');}
  if(row.manifest){validateCaptureManifest(row.manifest);if(row.id!==row.manifest.image.id||row.commandId!==row.manifest.commandId||row.correlationId!==row.manifest.correlationId||row.targetId!==row.manifest.targetId||c.state!=='captured')transferFail('HISTORY_INVALID');}
  else if(c.state==='captured'||row.artifacts.length)transferFail('HISTORY_INVALID');
  for(const a of row.artifacts){closedTransfer(a,['trace','upload']);validateCaptureTrace(a.trace);if(configurationDigest(a.trace.manifest)!==configurationDigest(row.manifest))transferFail('HISTORY_INVALID');const u=a.upload;closedTransfer(u,['state','attempts','reason','receipt']);if(!['pending','uploaded','failed'].includes(u.state)||!(u.attempts===null||Number.isInteger(u.attempts)&&u.attempts>=0&&u.attempts<=32)||!(u.reason===null||transferId(u.reason))||u.state==='uploaded'&&!u.receipt||u.state!=='uploaded'&&u.receipt!==null)transferFail('HISTORY_INVALID');if(u.receipt)verifyCaptureUpload(u.receipt,a.trace);}
  if(Buffer.byteLength(JSON.stringify(row))>131072)transferFail('HISTORY_INVALID');
}
