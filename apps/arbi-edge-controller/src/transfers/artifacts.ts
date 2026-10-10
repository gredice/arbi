import { constants, closeSync, existsSync, fstatSync, fsyncSync, ftruncateSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { TransferBudget, TransferError } from './budget.js';

export interface ArtifactSegment {data:Uint8Array;attemptedBytes:number}
/** A caller-owned transport must read at most maxBytes and authenticate the immutable digest/range. No URLs/keys are persisted here. */
export type ArtifactTransport=(request:{offset:number;maxBytes:number;digest:string;chargeId:string})=>Promise<ArtifactSegment>;
export class ArtifactCache {
  readonly #busy=new Set<string>();
  constructor(readonly budget:TransferBudget,readonly directory:string,readonly maxBytes=16777216){
    if(!Number.isSafeInteger(maxBytes) || maxBytes<1 || maxBytes>67108864)throw new TransferError('CACHE_CAPACITY');
    mkdirSync(directory,{recursive:true,mode:0o700});
  }
  #path(digest:string){if(!/^[a-f0-9]{64}$/.test(digest))throw new TransferError('INVALID_DIGEST');return join(this.directory,`${digest}.partial`);}
  #size(){const files=readdirSync(this.directory);if(files.length>512)throw new TransferError('CACHE_CAPACITY');
    return files.reduce((n,f)=>{if(!/^[a-f0-9]{64}\.partial$/.test(f))throw new TransferError('CACHE_LAYOUT');return n+statSync(join(this.directory,f)).size;},0);}
  #digest(path:string){const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{
    const s=fstatSync(fd);if(!s.isFile() || s.size>this.maxBytes)throw new TransferError('CACHE_CAPACITY');
    return createHash('sha256').update(readFileSync(fd)).digest('hex');
  }finally{closeSync(fd);}}
  async step(transferId:string,transport:ArtifactTransport):Promise<{offset:number;complete:boolean;cacheHit:boolean;path:string|null}>{
    const t=this.budget.getTransfer(transferId);
    if(!t || t.class!=='artifact' || t.direction!=='download' || !t.artifactDigest)throw new TransferError('INVALID_ARTIFACT');
    const path=this.#path(t.artifactDigest);
    if(t.state==='complete'){
      if(!existsSync(path) || statSync(path).size!==t.expectedBytes || this.#digest(path)!==t.artifactDigest)throw new TransferError('CACHE_CORRUPT');
      return {offset:t.offset,complete:true,cacheHit:true,path};
    }
    if(this.#busy.has(t.id))throw new TransferError('CONCURRENCY');this.#busy.add(t.id);
    let fd:number|undefined;
    try{
      fd=openSync(path,constants.O_RDWR|constants.O_CREAT|constants.O_NOFOLLOW,0o600);
      const s=fstatSync(fd);if(!s.isFile() || s.size<t.offset)throw new TransferError('CACHE_CORRUPT');
      if(s.size>t.offset){ftruncateSync(fd,t.offset);fsyncSync(fd);} // crash after file write, before journal commit
      if(t.state==='paused')this.budget.resume(t.id);
      if(t.offset===t.expectedBytes){
        if(this.#digest(path)!==t.artifactDigest){this.budget.finish(t.id,true);throw new TransferError('DIGEST_MISMATCH');}
        this.budget.finish(t.id);return {offset:t.offset,complete:true,cacheHit:false,path};
      }
      const bytes=Math.min(65536,t.expectedBytes-t.offset);
      if(this.#size()+bytes>this.maxBytes)throw new TransferError('CACHE_CAPACITY');
      const grant=this.budget.grant(t.id,bytes);
      let segment:ArtifactSegment;
      try{segment=await transport({offset:t.offset,maxBytes:bytes,digest:t.artifactDigest,chargeId:grant.id});}
      catch(e){this.budget.settle(t.id,grant.id,bytes,0);this.budget.pause(t.id);throw e;}
      if(!(segment.data instanceof Uint8Array) || segment.data.length>bytes || !Number.isSafeInteger(segment.attemptedBytes) || segment.attemptedBytes<segment.data.length || segment.attemptedBytes>bytes){
        this.budget.settle(t.id,grant.id,bytes,0);this.budget.pause(t.id);throw new TransferError('INVALID_SEGMENT');
      }
      try{
        let wrote=0;while(wrote<segment.data.length){const n=writeSync(fd,segment.data,wrote,segment.data.length-wrote,t.offset+wrote);if(n<=0)throw new TransferError('STORAGE');wrote+=n;}fsyncSync(fd);
      }catch(e){this.budget.settle(t.id,grant.id,segment.attemptedBytes,0);this.budget.pause(t.id);throw e;}
      const current=this.budget.settle(t.id,grant.id,segment.attemptedBytes,segment.data.length);
      // Keep verification separate from the charged network attempt; callers can resume after any crash boundary.
      if(current.offset===current.expectedBytes){
        if(this.#digest(path)!==t.artifactDigest){this.budget.finish(t.id,true);throw new TransferError('DIGEST_MISMATCH');}
        this.budget.finish(t.id);return {offset:current.offset,complete:true,cacheHit:false,path};
      }
      return {offset:current.offset,complete:false,cacheHit:false,path:null};
    }finally{if(fd!==undefined)closeSync(fd);this.#busy.delete(t.id);}
  }
}
