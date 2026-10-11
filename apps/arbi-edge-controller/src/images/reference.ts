import { cpus,platform,arch,release,totalmem } from 'node:os';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { COLOURS } from './contracts.js';
import type { Calibration,Original } from './contracts.js';
import { encodePng } from './png.js';
import { hash } from './pipeline.js';
import { ImageProcessor } from './processor.js';

export async function runReference():Promise<unknown> {
  const rgb=new Uint8Array(512*512*3);for(let y=0;y<512;y++)for(let x=0;x<512;x++){const v=(Math.floor(x/8)+Math.floor(y/8))%2?40:220;rgb.set([v,v,v],(y*512+x)*3);}
  const points=[{x:32,y:32},{x:479,y:32},{x:479,y:479},{x:32,y:479}],colours=[[240,20,20],[20,240,20],[20,20,240],[240,20,240]];
  for(const [n,p] of points.entries())for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++)rgb.set(colours[n],((p.y+y)*512+p.x+x)*3);
  const png=encodePng({width:512,height:512,rgb}),original:Original={id:'raw-resource-fixture',sha256:hash(png),bytes:png.length,contentType:'image/png',widthPx:512,heightPx:512,siteId:'fictional-site',targetId:'fictional-bed',jobId:'resource-fixture',correlationId:'resource-fixture',configurationDigest:'c'.repeat(64),captureCalibrationRevision:'capture-calibration-1'};
  const calibration:Calibration={version:'arbi.image-calibration/1.0',origin:'simulated',revision:'resource-calibration-1',siteId:original.siteId,targetId:original.targetId,configurationDigest:original.configurationDigest,captureCalibrationRevision:original.captureCalibrationRevision,frameRevision:'fictional-bed-plane-1',widthPx:512,heightPx:512,
    intrinsics:{fx:512,fy:512,cx:255.5,cy:255.5,k1:0,k2:0,p1:0,p2:0},bed:{xMm:0,yMm:0,widthMm:1000,heightMm:1000,planeZMm:0,outputWidthPx:512,outputHeightPx:512},
    fiducials:COLOURS.map((colour,n)=>({colour,positionMm:[{x:0,y:0},{x:1000,y:0},{x:1000,y:1000},{x:0,y:1000}][n]})),quality:{revision:'synthetic-quality-1',minimumLaplacianVariance:1000,minimumMean:30,maximumMean:225,maximumClippedFraction:0.2}};
  const processor=new ImageProcessor({timeoutMs:5000}),samples:{elapsedMs:number;cpuUserMs:number;cpuSystemMs:number;workerRuntimeMs:number;workUnits:number;id:string;sha256:string;bytes:number}[]=[],baselineRss=process.memoryUsage.rss();let peakRss=baselineRss;
  const timer=setInterval(()=>{peakRss=Math.max(peakRss,process.memoryUsage.rss());},5);
  try {for(let n=0;n<5;n++){const at=performance.now(),cpu=process.cpuUsage(),r=await processor.process(original,png,calibration),d=r.processing.derivative,used=process.cpuUsage(cpu);if(!d)throw new Error(r.processing.reason??'REFERENCE_FAILED');samples.push({elapsedMs:performance.now()-at,cpuUserMs:used.user/1000,cpuSystemMs:used.system/1000,workerRuntimeMs:r.resources.runtimeMs,workUnits:r.resources.workUnits,id:d.id,sha256:d.sha256,bytes:d.bytes});}}
  finally {clearInterval(timer);processor.close();}
  const build=JSON.parse(readFileSync(new URL('../build-identity.json',import.meta.url),'utf8'));
  const cwd=fileURLToPath(new URL('../../../../',import.meta.url)),source={sha:execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'}).trim(),dirty:Boolean(execFileSync('git',['status','--porcelain'],{cwd,encoding:'utf8'}).trim())};
  return {version:'arbi.image-resource-reference/1.0',source,build,host:{platform:platform(),arch:arch(),release:release(),cpuModel:cpus()[0].model,logicalCpus:cpus().length,totalMemoryBytes:totalmem(),node:process.version},sourceResolution:[512,512],outputResolution:[512,512],inputBytes:png.length,samples,baselineRssBytes:baselineRss,sampledProcessPeakRssBytes:peakRss,rssSamplingMs:5,physicalCalibrationAccepted:false,selectedEdgeHostMeasured:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await runReference(),null,2));
