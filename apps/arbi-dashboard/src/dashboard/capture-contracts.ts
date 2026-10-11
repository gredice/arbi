import type { CaptureHistoryRow } from '@arbi/protocol/capture-history';
import type { CommissioningStatus,Realm } from '@arbi/protocol';
export type CaptureEntry=CaptureHistoryRow&{delivery:{artifactId:string;imageId:string|null;state:'verified'|'pending'|'unavailable';thumbnail:boolean}[]};
export interface CapturePage {version:'arbi.capture-history/1.0';siteId:string;realm:Realm;entries:CaptureEntry[];next:string|null;source:'edge-and-cloud'|'cloud-only';order:'identity'|'cloud-received';}
export interface FramingReview {status:CommissioningStatus;active:Record<string,unknown>|null;staged:Record<string,unknown>|null;revisions:{recordId:string;reason:string;active:{revision:string;calibrationRevision:string}|null;staged:{revision:string;calibrationRevision:string}|null;phase:string;correlationId:string|null}[];audit:{eventId:string;action:string;outcome:string;links:{correlationId:string}}[];}
