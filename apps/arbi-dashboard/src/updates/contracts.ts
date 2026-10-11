import type { Realm,ReleaseInventory,ReleaseManifest,UpdateStatus } from '@arbi/protocol';
export const UPDATE_VIEW_VERSION='arbi.update-view/1.0';
export interface UpdateAvailable {
  version:typeof UPDATE_VIEW_VERSION;realm:Realm;siteId:string;physicalInstallationEnabled:false;
  inventory:ReleaseInventory;
  releases:{releaseSetId:string;compatible:boolean;reason:string|null;targets:{moduleId:string;releaseId:string;manifest:ReleaseManifest}[]}[];
  installed:{moduleId:string;manifest:ReleaseManifest;boot:UpdateStatus['installed'];installations:number;provenance:string}[];
  operations:{operationId:string;key:string;releaseSetId:string;state:string;reason:string|null;createdAtMs:number;actor:{kind:string;id:string}}[];
  budget:UpdateBudget;metered:boolean;
}
export interface UpdateBudget {remainingBytes:number|null;measuredUsedBytes:number|null;unreconciledAttemptBytes:number|null;reservedBytes:number|null;coverage:string;policyRevision:string|null}
export interface UpdateView {
  version:typeof UPDATE_VIEW_VERSION;realm:Realm;siteId:string;physicalInstallationEnabled:false;
  actor:{kind:string;id:string};operationId:string;releaseSetId:string;sessionId:string;authorizationId:string;state:string;reason:string|null;requiredAction:string|null;createdAtMs:number;deadlineMs:number;index:number;
  targets:{moduleId:string;phase:string;status:UpdateStatus;transfer:{offset:number;expectedBytes:number;attempts:number;state:string}|null;usageCharges:{id:string;bytes:number;period:string}[];receiptCoverage:{missingChargeIds:string[];unreconciledPayloadBytes:number;pendingChargeUpperBoundBytes:number};receipts:{reason:string;observedPayloadBytes:number;acceptedPrefixBytes:number;prefixIntegrity:string}[]}[];
  budget:UpdateBudget;budgetOverride:{id:string;bytes:number;expiresUtcMs:number;current:boolean;effectiveRemainingBytes:number|null}|null;
  accounting:{layer:string;wireBytes:null;carrierBytes:null};
}
