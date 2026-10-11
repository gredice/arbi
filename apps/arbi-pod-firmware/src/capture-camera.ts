import { deflateSync,inflateSync } from 'node:zlib';
export interface CaptureProfile {version:'arbi.capture-profile/1.0';origin:'simulated';id:string;revision:string;configurationDigest:string;calibrationRevision:string;
  widthPx:number;heightPx:number;exposureTimeUs:number;analogueGain:number;focusMode:'single';lensRange:{minimum:number;maximum:number};preview:boolean}
export interface FocusResult {origin:'simulated';status:'focused'|'failed';score:number|null;lensPosition:number|null;algorithmRevision:string}
export interface CameraImage {origin:'simulated';bytes:Buffer;widthPx:number;heightPx:number;contentType:'image/png'}
export interface CaptureCameraAdapter {readonly origin:'simulated'|'unavailable';apply(profile:CaptureProfile,signal:AbortSignal):Promise<void>;
  initialize(signal:AbortSignal):Promise<{origin:'simulated';ready:boolean;revision:string}>;
  autofocus(signal:AbortSignal):Promise<FocusResult>;preview(signal:AbortSignal):Promise<CameraImage>;still(signal:AbortSignal):Promise<CameraImage>}
function crc(bytes:Buffer){let c=0xffffffff;for(const byte of bytes){c^=byte;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(name:string,payload:Buffer){const type=Buffer.from(name),out=Buffer.alloc(payload.length+12);out.writeUInt32BE(payload.length);type.copy(out,4);payload.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([type,payload])),payload.length+8);return out;}
/** Bounded model format validation; decoding/quality/rectification is separate. */
export function validateCapturedPng(bytes:Buffer,width:number,height:number){
  if(!Buffer.isBuffer(bytes)||bytes.length<45||bytes.length>8388608||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>512||height>512
    ||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('INVALID_CAPTURE_PNG');
  const data:Buffer[]=[];let offset=8,ended=false,chunks=0;
  while(offset<bytes.length){if(++chunks>128||offset+12>bytes.length)throw new Error('INVALID_CAPTURE_PNG');const size=bytes.readUInt32BE(offset),end=offset+size+12;
    if(end>bytes.length)throw new Error('INVALID_CAPTURE_PNG');const name=bytes.subarray(offset+4,offset+8).toString('ascii'),payload=bytes.subarray(offset+8,end-4);
    if(crc(bytes.subarray(offset+4,end-4))!==bytes.readUInt32BE(end-4))throw new Error('INVALID_CAPTURE_PNG');
    if(chunks===1){if(name!=='IHDR'||size!==13||payload.readUInt32BE(0)!==width||payload.readUInt32BE(4)!==height||payload[8]!==8||payload[9]!==2||payload[10]||payload[11]||payload[12])throw new Error('INVALID_CAPTURE_PNG');}
    else if(name==='IDAT')data.push(payload);else if(name==='IEND'){if(size||end!==bytes.length)throw new Error('INVALID_CAPTURE_PNG');ended=true;}else throw new Error('UNSUPPORTED_CAPTURE_PNG');offset=end;
  }
  if(!ended||!data.length)throw new Error('INVALID_CAPTURE_PNG');const row=width*3+1,decoded=inflateSync(Buffer.concat(data),{maxOutputLength:row*height+1});
  if(decoded.length!==row*height)throw new Error('INVALID_CAPTURE_PNG');for(let y=0;y<height;y++)if(decoded[y*row]>4)throw new Error('INVALID_CAPTURE_PNG');
}
/** Valid encoded deterministic reference image, not camera or daylight proof. */
export function syntheticPng(widthPx:number,heightPx:number){
  if(!Number.isInteger(widthPx)||!Number.isInteger(heightPx)||widthPx<1||heightPx<1||widthPx>512||heightPx>512)throw new Error('SYNTHETIC_IMAGE_LIMIT');
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(widthPx);ihdr.writeUInt32BE(heightPx,4);ihdr[8]=8;ihdr[9]=2;
  const rows=Buffer.alloc(heightPx*(1+widthPx*3));for(let y=0;y<heightPx;y++)for(let x=0;x<widthPx;x++){
    const n=y*(1+widthPx*3)+1+x*3,value=((Math.floor(x/4)+Math.floor(y/4))%2)?220:40;rows[n]=value;rows[n+1]=value;rows[n+2]=value;}
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
export class SyntheticCaptureCamera implements CaptureCameraAdapter {
  readonly origin='simulated' as const;#profile:CaptureProfile|null=null;#captures=0;#focus=0;#previews=0;
  async initialize(signal:AbortSignal){signal.throwIfAborted();return {origin:'simulated' as const,ready:true,revision:'synthetic-camera-1'};}
  async apply(profile:CaptureProfile,signal:AbortSignal){signal.throwIfAborted();this.#profile=structuredClone(profile);}
  async autofocus(signal:AbortSignal):Promise<FocusResult>{signal.throwIfAborted();if(!this.#profile)throw new Error('PROFILE_REQUIRED');this.#focus++;return {origin:'simulated',status:'focused',score:1,lensPosition:0.5,algorithmRevision:'synthetic-focus-1'};}
  #image(signal:AbortSignal):CameraImage{signal.throwIfAborted();if(!this.#profile)throw new Error('PROFILE_REQUIRED');const p=this.#profile;return {origin:'simulated',bytes:syntheticPng(p.widthPx,p.heightPx),widthPx:p.widthPx,heightPx:p.heightPx,contentType:'image/png'};}
  async preview(signal:AbortSignal){this.#previews++;return this.#image(signal);}
  async still(signal:AbortSignal){this.#captures++;return this.#image(signal);}
  get counters(){return {captures:this.#captures,focus:this.#focus,previews:this.#previews,physicalCamera:false};}
}
