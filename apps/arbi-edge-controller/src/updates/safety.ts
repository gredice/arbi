import { isId } from '@arbi/gredice';
import type { UpdatePreflight } from '@arbi/protocol';
export interface LocalUpdateSafety {
  recordId:string;observedUtcMs:number;expiresUtcMs:number;independentProtectionOwnerId:string;
  activeMotion:boolean;manualControl:boolean;maintenanceConflict:boolean;
  mode:'parked'|'update-safe'|'unknown';retentionValidated:boolean;lineClearanceValidated:boolean;
  stablePower:boolean;localInterlock:boolean;targetProcedureValidated:boolean;
  provenance:'declared-isolated-procedure';
}
/** This evidence comes only from the private local composition. It cannot enable field installation. */
export function updateSafety(e:LocalUpdateSafety|null,target:string,now:number):{ok:true;preflight:UpdatePreflight}|{ok:false;reason:string}{
  if(!e||e.provenance!=='declared-isolated-procedure'||!isId(e.recordId)||!isId(e.independentProtectionOwnerId)||!Number.isSafeInteger(e.observedUtcMs)||!Number.isSafeInteger(e.expiresUtcMs)||e.observedUtcMs>now||now>=e.expiresUtcMs||e.expiresUtcMs-e.observedUtcMs>30000)return {ok:false,reason:'UPDATE_SAFE_EVIDENCE_MISSING'};
  if(['activeMotion','manualControl','maintenanceConflict','retentionValidated','lineClearanceValidated','stablePower','localInterlock','targetProcedureValidated'].some(key=>typeof e[key as keyof LocalUpdateSafety]!=='boolean'))return {ok:false,reason:'UPDATE_SAFE_EVIDENCE_MISSING'};
  const reason=e.activeMotion?'ACTIVE_MOTION':e.manualControl?'MANUAL_CONTROL_ACTIVE':e.maintenanceConflict?'MAINTENANCE_CONFLICT':e.mode!=='update-safe'?'UPDATE_SAFE_MODE_REQUIRED':!e.retentionValidated?'RETENTION_NOT_VALIDATED':!e.lineClearanceValidated?'LINE_CLEARANCE_NOT_VALIDATED':!e.stablePower?'POWER_NOT_STABLE':!e.localInterlock?'LOCAL_INTERLOCK_REQUIRED':!e.targetProcedureValidated?'TARGET_PROCEDURE_NOT_VALIDATED':e.independentProtectionOwnerId===target?'INDEPENDENT_PROTECTION_REQUIRED':null;
  return reason?{ok:false,reason}:{ok:true,preflight:{recordId:e.recordId,independentProtectionOwnerId:e.independentProtectionOwnerId,updateSafe:true}};
}
