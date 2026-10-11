import { deflateSync, inflateSync } from 'node:zlib';

export interface Raster { width: number; height: number; rgb: Uint8Array }
export const MAX_PNG_BYTES = 8 * 1024 * 1024;
export class ImageError extends Error { constructor(readonly code: string) { super(code); } }
export function fail(code: string): never { throw new ImageError(code); }
const signature = Buffer.from([137,80,78,71,13,10,26,10]);
function crc(bytes: Uint8Array): number {
  let n = 0xffffffff;
  for (const b of bytes) { n ^= b; for (let bit=0;bit<8;bit++) n = (n>>>1) ^ ((n&1) ? 0xedb88320 : 0); }
  return (n ^ 0xffffffff) >>> 0;
}
function dimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width<2 || height<2 || width>512 || height>512) fail('IMAGE_DIMENSIONS');
}
const paeth = (a: number,b: number,c: number): number => {
  const p=a+b-c, x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c); return x<=y&&x<=z ? a : y<=z ? b : c;
};
/** Deliberately narrow RGB8, noninterlaced PNG boundary; bounded inflate and CRC
 * checks precede decoding. Unsupported ancillary/critical chunks are explicit. */
export function decodePng(input: Uint8Array): Raster {
  if (!(input instanceof Uint8Array) || input.byteLength>MAX_PNG_BYTES || input.byteLength<57) fail('PNG_INVALID');
  const b=Buffer.from(input.buffer,input.byteOffset,input.byteLength);
  if (!b.subarray(0,8).equals(signature)) fail('PNG_INVALID');
  let at=8,width=0,height=0,ended=false,idatEnded=false,seenData=false;
  const parts: Buffer[]=[];
  for (let chunks=0;at<b.length&&chunks<128;chunks++) {
    if (at+12>b.length) fail('PNG_INVALID');
    const size=b.readUInt32BE(at),kind=b.toString('ascii',at+4,at+8),end=at+size+12;
    if (end>b.length || crc(b.subarray(at+4,end-4))!==b.readUInt32BE(end-4)) fail('PNG_INVALID');
    const payload=b.subarray(at+8,end-4);
    if (!width && kind!=='IHDR') fail('PNG_INVALID');
    if (kind==='IHDR') {
      if (width || size!==13 || payload[8]!==8 || payload[9]!==2 || payload[10]!==0 || payload[11]!==0 || payload[12]!==0) fail('PNG_UNSUPPORTED');
      width=payload.readUInt32BE(0);height=payload.readUInt32BE(4);dimensions(width,height);
    } else if (kind==='IDAT') { if (idatEnded) fail('PNG_INVALID'); seenData=true; parts.push(payload); }
    else if (kind==='IEND') { if (size!==0 || !seenData || end!==b.length) fail('PNG_INVALID'); ended=true;at=end;break; }
    else fail('PNG_UNSUPPORTED');
    if (seenData && kind!=='IDAT') idatEnded=true;
    at=end;
  }
  if (!ended || at!==b.length) fail('PNG_INVALID');
  let scan: Buffer;
  const stride=width*3,expected=(stride+1)*height;
  try { scan=inflateSync(Buffer.concat(parts),{maxOutputLength:expected}); } catch { return fail('PNG_INVALID'); }
  if (scan.length!==expected) fail('PNG_INVALID');
  const rgb=new Uint8Array(stride*height);
  for (let y=0;y<height;y++) {
    const filter=scan[y*(stride+1)];if (filter>4) fail('PNG_INVALID');
    for(let x=0;x<stride;x++) {
      const i=y*stride+x,a=x>=3?rgb[i-3]:0,c=x>=3&&y?rgb[i-stride-3]:0,up=y?rgb[i-stride]:0;
      rgb[i]=(scan[y*(stride+1)+1+x]+[0,a,up,Math.floor((a+up)/2),paeth(a,up,c)][filter])&255;
    }
  }
  return {width,height,rgb};
}
function chunk(kind: string,payload: Buffer): Buffer {
  const b=Buffer.alloc(payload.length+12);b.writeUInt32BE(payload.length);b.write(kind,4,'ascii');payload.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,-4)),b.length-4);return b;
}
export function encodePng(r: Raster): Buffer {
  dimensions(r.width,r.height);if (!(r.rgb instanceof Uint8Array) || r.rgb.length!==r.width*r.height*3) fail('IMAGE_DIMENSIONS');
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(r.width);ihdr.writeUInt32BE(r.height,4);ihdr[8]=8;ihdr[9]=2;
  const scan=Buffer.alloc((r.width*3+1)*r.height);
  for(let y=0;y<r.height;y++) scan.set(r.rgb.subarray(y*r.width*3,(y+1)*r.width*3),y*(r.width*3+1)+1);
  return Buffer.concat([signature,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(scan,{level:6})),chunk('IEND',Buffer.alloc(0))]);
}
