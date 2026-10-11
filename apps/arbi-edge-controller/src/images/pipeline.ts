import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { configurationDigest } from '@arbi/protocol';
import { ALGORITHM,COLOURS,calibrationDigest,validateCalibration,validateOriginal } from './contracts.js';
import type { Calibration,Colour,Original,Point,ProcessingResult,Quality } from './contracts.js';
import { convex,distort,homography,project,undistort } from './geometry.js';
import { decodePng,encodePng,fail,ImageError } from './png.js';
import type { Raster } from './png.js';
export interface ProcessingInput {original: Original;png: Uint8Array;calibration: Calibration|null;maximumWorkUnits: number}
export const hash=(bytes:Uint8Array):string=>createHash('sha256').update(bytes).digest('hex');
export function fallback(o:Original,reason:string,state:'failed'|'unavailable'='failed'):ProcessingResult {
  return {version:'arbi.image-processing/1.0',capture:{state:'captured',original:structuredClone(o)},processing:{state,reason,algorithmRevision:ALGORITHM,quality:null,derivative:null},upload:{state:'not-uploaded'},physicalCalibrationAccepted:false,resources:{runtimeMs:0,workUnits:0,maximumConcurrency:1}};
}
function colour(rgb:Uint8Array,n:number):number {
  const r=rgb[n*3],g=rgb[n*3+1],b=rgb[n*3+2];
  if(r>180&&g<80&&b<80)return 1;if(g>180&&r<80&&b<80)return 2;if(b>180&&r<80&&g<80)return 3;if(r>180&&b>180&&g<80)return 4;return 0;
}
function detect(r:Raster,work:(n:number)=>void):{colour:Colour;pixel:Point}[] {
  const size=r.width*r.height,labels=new Uint8Array(size),queue=new Uint32Array(size),found:Point[][]=[[],[],[],[]];
  work(size);for(let n=0;n<size;n++)labels[n]=colour(r.rgb,n);
  for(let n=0;n<size;n++) {
    const label=labels[n];if(!label)continue;let head=0,tail=1,sx=0,sy=0;queue[0]=n;labels[n]=0;
    while(head<tail) {
      work(1);const p=queue[head++],x=p%r.width,y=Math.floor(p/r.width);sx+=x;sy+=y;
      const neighbours=[...(x?[p-1]:[]),...(x+1<r.width?[p+1]:[]),...(y?[p-r.width]:[]),...(y+1<r.height?[p+r.width]:[])];
      for(const q of neighbours)if(labels[q]===label){labels[q]=0;queue[tail++]=q;}
    }
    if(tail<4||tail>256)fail('FIDUCIAL_COMPONENT_INVALID');found[label-1].push({x:sx/tail,y:sy/tail});if(found[label-1].length>1)fail('FIDUCIAL_AMBIGUOUS');
  }
  if(found.some(p=>p.length!==1))fail('FIDUCIAL_MISSING');
  const observed=found.map((p,n)=>({colour:COLOURS[n],pixel:p[0]}));convex(observed.map(o=>o.pixel));return observed;
}
function quality(r:Raster,c:Calibration,work:(n:number)=>void):Quality {
  const count=r.width*r.height,luma=new Float64Array(count);let total=0,clipped=0,lap=0,squared=0,samples=0;work(count*2);
  for(let n=0;n<count;n++){const v=(r.rgb[n*3]+r.rgb[n*3+1]+r.rgb[n*3+2])/3;luma[n]=v;total+=v;if(v<=5||v>=250)clipped++;}
  for(let y=1;y<r.height-1;y++)for(let x=1;x<r.width-1;x++) {
    const n=y*r.width+x,v=luma[n-1]+luma[n+1]+luma[n-r.width]+luma[n+r.width]-4*luma[n];lap+=v;squared+=v*v;samples++;
  }
  const mean=total/count,clippedFraction=clipped/count,laplacianVariance=samples?squared/samples-(lap/samples)**2:0,q=c.quality;
  return {mean,clippedFraction,laplacianVariance,revision:q.revision,accepted:mean>=q.minimumMean&&mean<=q.maximumMean&&clippedFraction<=q.maximumClippedFraction&&laplacianVariance>=q.minimumLaplacianVariance};
}
function resample(r:Raster,c:Calibration,h:number[],work:(n:number)=>void):Raster {
  const {outputWidthPx:width,outputHeightPx:height}=c.bed,rgb=new Uint8Array(width*height*3),i=c.intrinsics;
  // A planar projective denominator cannot change sign anywhere in the target.
  const denominators=[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}].map(p=>h[6]*p.x+h[7]*p.y+1);
  if(denominators.some(d=>!Number.isFinite(d)||d<1e-6))fail('FIDUCIAL_GEOMETRY');
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    work(16);const norm=distort(project(h,{x:x/(width-1),y:y/(height-1)}),i),u=norm.x*i.fx+i.cx,v=norm.y*i.fy+i.cy;
    if(!Number.isFinite(u)||!Number.isFinite(v)||u<0||v<0||u>r.width-1||v>r.height-1)fail('TARGET_OUTSIDE_IMAGE');
    const x0=Math.floor(u),y0=Math.floor(v),x1=Math.min(x0+1,r.width-1),y1=Math.min(y0+1,r.height-1),dx=u-x0,dy=v-y0;
    for(let channel=0;channel<3;channel++) {
      const sample=(px:number,py:number)=>r.rgb[(py*r.width+px)*3+channel];
      rgb[(y*width+x)*3+channel]=Math.round((1-dy)*((1-dx)*sample(x0,y0)+dx*sample(x1,y0))+dy*((1-dx)*sample(x0,y1)+dx*sample(x1,y1)));
    }
  }
  return {width,height,rgb};
}
/** Runs only in an isolated bounded worker through ImageProcessor. No filesystem,
 * camera, upload, authority or actuator side effects. */
export function processImage(input:ProcessingInput):ProcessingResult {
  const started=performance.now();validateOriginal(input.original);const out=fallback(input.original,'PROCESSING_FAILED');let units=0;
  const work=(n:number)=>{units+=n;if(units>input.maximumWorkUnits)fail('PROCESSING_WORK_BUDGET');};
  try {
    if(!(input.png instanceof Uint8Array)||input.png.length!==input.original.bytes||hash(input.png)!==input.original.sha256)fail('RAW_INTEGRITY_FAILED');
    const c=input.calibration;if(c===null){out.processing.state='unavailable';out.processing.reason='CALIBRATION_MISSING';return out;}
    validateCalibration(c,input.original);const r=decodePng(input.png);if(r.width!==input.original.widthPx||r.height!==input.original.heightPx)fail('IMAGE_DIMENSIONS');
    work(input.png.length+r.rgb.length);const q=quality(r,c,work);out.processing.quality=q;
    if(!q.accepted)fail(q.mean<c.quality.minimumMean||q.mean>c.quality.maximumMean||q.clippedFraction>c.quality.maximumClippedFraction?'EXPOSURE_REJECTED':'BLUR_REJECTED');
    const observed=detect(r,work),ideal=observed.map(o=>undistort(o.pixel,c.intrinsics,work));
    const from=c.fiducials.map(f=>({x:(f.positionMm.x-c.bed.xMm)/c.bed.widthMm,y:(f.positionMm.y-c.bed.yMm)/c.bed.heightMm})),h=homography(from,ideal);
    const rectified=resample(r,c,h,work),png=encodePng(rectified),cd=calibrationDigest(c);
    const logical=configurationDigest({domain:ALGORITHM,originalId:input.original.id,originalSha256:input.original.sha256,calibrationDigest:cd});
    out.processing={state:'rectified',reason:null,algorithmRevision:ALGORITHM,quality:q,derivative:{id:`derived-${logical}`,sha256:hash(png),bytes:png.length,contentType:'image/png',widthPx:rectified.width,heightPx:rectified.height,png,
      originalId:input.original.id,originalSha256:input.original.sha256,algorithmRevision:ALGORITHM,calibrationRevision:c.revision,calibrationDigest:cd,frameRevision:c.frameRevision,quality:q,
      transform:{basis:'normalized-bed-to-undistorted-camera',homography:h,intrinsics:structuredClone(c.intrinsics),bed:structuredClone(c.bed),observed}}};
  } catch(e) {out.processing.state='failed';out.processing.reason=e instanceof ImageError?e.code:'PROCESSING_FAILED';out.processing.derivative=null;}
  finally {out.resources.runtimeMs=performance.now()-started;out.resources.workUnits=units;}
  return out;
}
