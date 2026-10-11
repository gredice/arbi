import type { Realm } from '@arbi/protocol';
import type { ArtifactTransport } from '../transfers/artifacts.js';
import { TransferError } from '../transfers/budget.js';
import { reject } from './journal.js';

export interface RangeReceipt {
  chargeId:string;offset:number;requestedBytes:number;observedPayloadBytes:number;acceptedPrefixBytes:number;
  reason:'complete-range'|'interrupted-range'|'source-rejected'|'invalid-range'|'source-unavailable';
  layer:'application-payload';prefixIntegrity:'pending-whole-artifact-verification';wireBytes:null;
}
/** Constructor-owned loopback source. Credentials/URLs are never selected by a request or persisted in receipts. */
export class IsolatedRangeSource {
  readonly #origin:string;readonly #authorization:string;
  constructor(options:{realm:Realm;baseURL:string;authorization:string;timeoutMs?:number}){
    let url:URL;try{url=new URL(options.baseURL);}catch{reject('INVALID_SOURCE');}
    if(options.realm.environment!=='test'||url.protocol!=='http:'||!['127.0.0.1','[::1]','localhost'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash||typeof options.authorization!=='string'||options.authorization.length<16||options.authorization.length>2048)reject('INVALID_SOURCE');
    this.#origin=url.origin;this.#authorization=options.authorization;
    this.timeoutMs=options.timeoutMs??1000;if(!Number.isSafeInteger(this.timeoutMs)||this.timeoutMs<50||this.timeoutMs>1500)reject('INVALID_SOURCE');
  }
  readonly timeoutMs:number;
  transport(size:number,onReceipt:(receipt:RangeReceipt)=>void):ArtifactTransport {
    if(!Number.isSafeInteger(size)||size<1||size>67108864)reject('INVALID_ARTIFACT');
    return async request=>{
      if(!/^[a-f0-9]{64}$/.test(request.digest)||!Number.isSafeInteger(request.offset)||request.offset<0||!Number.isSafeInteger(request.maxBytes)||request.maxBytes<1||request.maxBytes>65536||request.offset+request.maxBytes>size)reject('INVALID_RANGE');
      const receipt:RangeReceipt={chargeId:request.chargeId,offset:request.offset,requestedBytes:request.maxBytes,observedPayloadBytes:0,acceptedPrefixBytes:0,reason:'source-unavailable',layer:'application-payload',prefixIntegrity:'pending-whole-artifact-verification',wireBytes:null};
      let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;const chunks:Uint8Array[]=[];let valid=false;
      try{
        const response=await fetch(`${this.#origin}/artifacts/${request.digest}`,{redirect:'manual',cache:'no-store',headers:{authorization:this.#authorization,range:`bytes=${request.offset}-${request.offset+request.maxBytes-1}`},signal:AbortSignal.timeout(this.timeoutMs)});
        const length=response.headers.get('content-length');
        valid=response.status===206&&response.headers.get('content-range')===`bytes ${request.offset}-${request.offset+request.maxBytes-1}/${size}`&&length===String(request.maxBytes)&&response.headers.get('content-type')==='application/octet-stream'&&!response.headers.has('content-encoding');
        receipt.reason=valid?'interrupted-range':response.status===206?'invalid-range':'source-rejected';
        // Undici enforces Content-Length. Unknown/oversized framing is cancelled before any application body observation.
        if(!response.body||length===null||!/^(0|[1-9][0-9]{0,5})$/.test(length)||Number(length)>request.maxBytes){await response.body?.cancel();return {data:new Uint8Array(),attemptedBytes:0};}
        reader=response.body.getReader();
        for(;;){const chunk=await reader.read();if(chunk.done){if(valid&&receipt.observedPayloadBytes===request.maxBytes)receipt.reason='complete-range';break;}
          receipt.observedPayloadBytes+=chunk.value.byteLength;
          if(receipt.observedPayloadBytes>request.maxBytes){await reader.cancel();valid=false;receipt.reason='invalid-range';break;}
          if(valid)chunks.push(chunk.value.slice());
        }
      }catch{ /* Observable prefix is accounted and resumable; no raw provider error or guessed body bytes. */ }
      finally{try{reader?.releaseLock();}catch{}receipt.acceptedPrefixBytes=valid?chunks.reduce((n,c)=>n+c.byteLength,0):0;onReceipt(structuredClone(receipt));}
      if(receipt.observedPayloadBytes>request.maxBytes)throw new TransferError('OVERSIZED_RANGE');
      const data=new Uint8Array(receipt.acceptedPrefixBytes);let offset=0;for(const chunk of chunks){if(!valid)break;data.set(chunk,offset);offset+=chunk.byteLength;}
      return {data,attemptedBytes:receipt.observedPayloadBytes};
    };
  }
}
