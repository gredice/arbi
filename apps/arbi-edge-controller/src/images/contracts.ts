import { configurationDigest } from '@arbi/protocol';
import { fail } from './png.js';

export const ALGORITHM = 'arbi.colour-plane-rectification/1.0';
export const COLOURS = ['red','green','blue','magenta'] as const;
export type Colour = typeof COLOURS[number];
export interface Point { x: number; y: number }
export interface Calibration {
  version: 'arbi.image-calibration/1.0'; origin: 'simulated'; revision: string;
  siteId: string; configurationDigest: string; captureCalibrationRevision: string; targetId: string; frameRevision: string;
  widthPx: number; heightPx: number;
  intrinsics: {fx: number;fy: number;cx: number;cy: number;k1: number;k2: number;p1: number;p2: number};
  bed: {xMm: number;yMm: number;widthMm: number;heightMm: number;planeZMm: number;outputWidthPx: number;outputHeightPx: number};
  fiducials: {colour: Colour;positionMm: Point}[];
  quality: {revision: string;minimumLaplacianVariance: number;minimumMean: number;maximumMean: number;maximumClippedFraction: number};
}
export interface Original {
  id: string;sha256: string;bytes: number;contentType: 'image/png';widthPx: number;heightPx: number;
  siteId: string;targetId: string;jobId: string;correlationId: string;configurationDigest: string;captureCalibrationRevision: string;
}
export interface Quality {mean: number;clippedFraction: number;laplacianVariance: number;revision: string;accepted: boolean}
export interface Derivative {
  id: string;sha256: string;bytes: number;contentType: 'image/png';widthPx: number;heightPx: number;png: Uint8Array;
  originalId: string;originalSha256: string;algorithmRevision: string;calibrationRevision: string;calibrationDigest: string;
  frameRevision: string;quality: Quality;transform: {basis: 'normalized-bed-to-undistorted-camera';homography: number[];intrinsics: Calibration['intrinsics'];bed: Calibration['bed'];observed: {colour: Colour;pixel: Point}[]};
}
export interface ProcessingResult {
  version: 'arbi.image-processing/1.0';capture: {state: 'captured';original: Original};
  processing: {state: 'rectified'|'failed'|'unavailable';reason: string|null;algorithmRevision: string;quality: Quality|null;derivative: Derivative|null};
  upload: {state: 'not-uploaded'};physicalCalibrationAccepted: false;
  resources: {runtimeMs: number;workUnits: number;maximumConcurrency: 1};
}
export const identifier=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(v);
export const sha=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
export const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function closed(v: unknown,keys: string[]): asserts v is Record<string,unknown> {
  if(!record(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail('CALIBRATION_INVALID');
}
const number=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const integer=(v:unknown,min:number,max:number)=>number(v,min,max)&&Number.isInteger(v);
export function validateOriginal(v: Original): void {
  closed(v,['id','sha256','bytes','contentType','widthPx','heightPx','siteId','targetId','jobId','correlationId','configurationDigest','captureCalibrationRevision']);
  if(!['id','siteId','targetId','jobId','correlationId','captureCalibrationRevision'].every(k=>identifier(v[k]))||!sha(v.sha256)||!sha(v.configurationDigest)||v.contentType!=='image/png'||!integer(v.bytes,57,8388608)||!integer(v.widthPx,2,512)||!integer(v.heightPx,2,512))fail('ORIGINAL_INVALID');
}
export function validateCalibration(c: Calibration,o: Original): void {
  closed(c,['version','origin','revision','siteId','configurationDigest','captureCalibrationRevision','targetId','frameRevision','widthPx','heightPx','intrinsics','bed','fiducials','quality']);
  if(c.version!=='arbi.image-calibration/1.0'||c.origin!=='simulated'||![c.revision,c.siteId,c.captureCalibrationRevision,c.targetId,c.frameRevision].every(identifier)||!sha(c.configurationDigest))fail('CALIBRATION_INVALID');
  if(c.siteId!==o.siteId||c.targetId!==o.targetId||c.configurationDigest!==o.configurationDigest||c.captureCalibrationRevision!==o.captureCalibrationRevision||c.widthPx!==o.widthPx||c.heightPx!==o.heightPx)fail('CALIBRATION_INCOMPATIBLE');
  const i=c.intrinsics;closed(i,['fx','fy','cx','cy','k1','k2','p1','p2']);
  if(!number(i.fx,1,8192)||!number(i.fy,1,8192)||!number(i.cx,0,c.widthPx-1)||!number(i.cy,0,c.heightPx-1)||!number(i.k1,-0.5,0.5)||!number(i.k2,-0.5,0.5)||!number(i.p1,-0.1,0.1)||!number(i.p2,-0.1,0.1))fail('CALIBRATION_INVALID');
  const b=c.bed;closed(b,['xMm','yMm','widthMm','heightMm','planeZMm','outputWidthPx','outputHeightPx']);
  if(!number(b.xMm,-1e6,1e6)||!number(b.yMm,-1e6,1e6)||!number(b.widthMm,1,1e6)||!number(b.heightMm,1,1e6)||!number(b.planeZMm,-1e6,1e6)||!integer(b.outputWidthPx,2,512)||!integer(b.outputHeightPx,2,512))fail('CALIBRATION_INVALID');
  if(!Array.isArray(c.fiducials)||c.fiducials.length!==4)fail('CALIBRATION_INVALID');
  for(const [n,f] of c.fiducials.entries()) {
    closed(f,['colour','positionMm']);closed(f.positionMm,['x','y']);
    if(f.colour!==COLOURS[n]||!number(f.positionMm.x,b.xMm,b.xMm+b.widthMm)||!number(f.positionMm.y,b.yMm,b.yMm+b.heightMm))fail('CALIBRATION_INVALID');
  }
  const q=c.quality;closed(q,['revision','minimumLaplacianVariance','minimumMean','maximumMean','maximumClippedFraction']);
  if(!identifier(q.revision)||!number(q.minimumLaplacianVariance,1,1e6)||!number(q.minimumMean,0,255)||!number(q.maximumMean,0,255)||q.minimumMean>=q.maximumMean||!number(q.maximumClippedFraction,0,0.5))fail('CALIBRATION_INVALID');
}
export const calibrationDigest=(c:Calibration):string=>configurationDigest(c);
/** Consume the actual #53 receipt shape without importing the pod application.
 * Its original metadata remains with the capture/storage owner. */
export function originalFromCapture(receipt: unknown): Original {
  if(!record(receipt)||receipt.version!=='arbi.capture-result/1.0'||receipt.state!=='captured'||!record(receipt.image)||!record(receipt.metadata))fail('CAPTURE_UNAVAILABLE');
  const m=receipt.metadata,i=receipt.image;
  if(m.version!=='arbi.raw-capture/1.0'||!record(m.configuration))fail('CAPTURE_METADATA_INVALID');
  const original={id:i.id,sha256:i.sha256,bytes:i.bytes,contentType:i.contentType,widthPx:i.widthPx,heightPx:i.heightPx,
    siteId:m.siteId,targetId:m.targetId,jobId:m.jobId,correlationId:receipt.correlationId,configurationDigest:m.configuration.digest,captureCalibrationRevision:m.configuration.calibrationRevision} as Original;
  validateOriginal(original);if(m.resourceId!==original.targetId||receipt.resourceId!==original.targetId||original.jobId!==original.correlationId)fail('CAPTURE_METADATA_INVALID');return original;
}
