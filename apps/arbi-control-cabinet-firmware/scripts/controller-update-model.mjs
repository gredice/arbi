import { configurationDigest } from '@arbi/protocol';
import { updateTransferMac } from './flash-model.mjs';
const reject=code=>{throw Object.assign(new Error(code),{code});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u.test(v);
const fields=(v,names)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==[...names].sort().join())reject('INVALID_CONTROLLER_EVIDENCE');};
/** Trusted in-process synthetic edge/owner seam. No HTTP, serial, browser,
 * hardware flash, boot-ROM or commissioning authority is exposed here. */
export class ControllerPicoUpdateModel {
  #flash;#owner;#peer;#key;#now;#sequence=0n;#locked=false;#lastNow=0;#clockFault=false;
  constructor({flash,owner,peer,transferKey,now}) {
    if(flash.status.origin!=='simulated'||flash.status.physicalInstallationEnabled!==false||typeof owner?.read!=='function'||typeof owner?.reserve!=='function'
      ||!['deviceId','bootId','sessionId'].every(k=>id(peer?.[k]))||!Buffer.isBuffer(transferKey)||transferKey.length!==32||typeof now!=='function')reject('ISOLATED_OWNER_REQUIRED');
    this.#flash=flash;this.#owner=owner;this.#peer=structuredClone(peer);this.#key=Buffer.from(transferKey);this.#now=now;
  }
  close(){this.#key.fill(0);}
  #clock(){const n=this.#now();if(this.#clockFault||!Number.isSafeInteger(n)||n<0||n>Number.MAX_SAFE_INTEGER-1000||n<this.#lastNow){this.#clockFault=true;reject('CLOCK_INVALID');}this.#lastNow=n;return n;}
  #safe(locked) {
    const now=this.#clock(),e=this.#owner.read();
    fields(e,['version','origin','recordId','identity','configurationDigest','sampledMs','mode','activeMotion','manualLease','outputsInhibited','updateLocked','protection']);
    fields(e.identity,['deviceId','bootId','sessionId']);fields(e.protection,['fixtureRecord','independentOwner','outputsIsolated','restraint','lineClearance','stablePower']);
    if(e.version!=='arbi.controller-update-owner/1.0'||e.origin!=='simulated'||!id(e.recordId)||configurationDigest(e.identity)!==configurationDigest(this.#flash.identity)
      ||e.configurationDigest!==this.#flash.status.configurationDigest||!Number.isSafeInteger(e.sampledMs)||e.sampledMs>now||now-e.sampledMs>=100)reject('STALE_OR_WRONG_CONTROLLER');
    if(e.activeMotion!==false)reject('ACTIVE_MOTION');if(e.manualLease!==false)reject('MANUAL_CONTROL_ACTIVE');
    if(e.mode!=='update-safe'||e.outputsInhibited!==true||e.updateLocked!==locked||e.protection.fixtureRecord!=='synthetic-restraint-72'
      ||!id(e.protection.independentOwner)||e.protection.independentOwner===e.identity.deviceId
      ||['outputsIsolated','restraint','lineClearance','stablePower'].some(k=>e.protection[k]!==true))reject('UPDATE_SAFE_PROTECTION_REQUIRED');
    return e;
  }
  #request(action,manifest,commandId,correlationId) {
    if(!id(commandId)||!id(correlationId))reject('INVALID_COMMAND_ID');
    const request={version:'arbi.synthetic-pico-transfer/1.0',action,commandId,correlationId,source:this.#peer,target:this.#flash.identity,
      sequence:String(++this.#sequence),expiresMonotonicMs:this.#clock()+1000,manifestDigest:configurationDigest(manifest),
      preflight:{origin:'simulated',fixtureRecord:'synthetic-restraint-71',controllerPhase:'inhibited',manualAuthority:false,isolatedOutputs:true}};
    return {request,mac:updateTransferMac(request,this.#key)};
  }
  stage(manifest,bytes,commandId,correlationId) {
    if(this.#locked)reject('NEW_BOOT_REQUIRED');if(!id(commandId)||!id(correlationId))reject('INVALID_COMMAND_ID');this.#safe(false);
    // The actual owner adapter must reserve atomically and lock its motion
    // authority; this model never substitutes a browser-provided safe flag.
    if(this.#owner.reserve({identity:this.#flash.identity,configurationDigest:this.#flash.status.configurationDigest,commandId,correlationId})!==true)reject('OWNER_RESERVATION_REFUSED');
    this.#locked=true;this.#safe(true);this.#flash.stage(this.#request('stage',manifest,commandId,correlationId),manifest,bytes);return this.inventory;
  }
  activate(manifest,commandId,correlationId) {
    if(!this.#locked)reject('OWNER_RESERVATION_REQUIRED');this.#safe(true);
    this.#flash.activate(this.#request('activate',manifest,commandId,correlationId));this.#sequence=0n;return this.inventory;
  }
  confirm(health){this.#safe(true);this.#flash.confirm(health);return this.inventory;}
  tick(){this.#flash.tick();return this.inventory;}
  get inventory(){const s=this.#flash.status;return {version:'arbi.controller-update/1.0',origin:'simulated',target:s.identity,
    verifiedHostSlot:s.installed,staged:s.staged,phase:s.phase,reason:s.operationReason,resetReason:s.reason,
    configurationDigest:s.configurationDigest,localTrialDeadlineMs:s.localTrialDeadlineMs,firmwareExecuted:false,physicalInstallationEnabled:false,
    remoteActivationSupported:false,requiresLocalService:true,localServiceReason:'PICO_PHYSICAL_RECOVERY_UNPROVED',actuationInhibited:true,
    commissioningReconciliationRequired:true,retainedMovingIntent:false,bootselRecoveryRehearsed:false,swdRecoveryRehearsed:false};}
}
