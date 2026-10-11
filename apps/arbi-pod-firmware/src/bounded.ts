import { openSync, fstatSync, readSync, closeSync } from 'node:fs';
export function readBounded(file:string,maximum:number):Buffer {
  const fd=openSync(file,'r');
  try {
    const stat=fstatSync(fd);
    if(!stat.isFile() || stat.size>maximum) throw new Error('FILE_LIMIT');
    const data=Buffer.alloc(maximum+1);let used=0;
    while(used<data.length) {const count=readSync(fd,data,used,data.length-used,null);if(!count)break;used+=count;}
    if(used>maximum)throw new Error('FILE_LIMIT');return data.subarray(0,used);
  } finally {closeSync(fd);}
}
export type LogCode='STARTING'|'CONFIG_MISSING'|'CAMERA_UNAVAILABLE'|'READY'|'AUTHENTICATION_FAILED'|'PEER_REJECTED'|'LINK_EXPIRED'|'DISCONNECTED'|'SHUTDOWN'|'STORAGE_UNAVAILABLE'|'DIAGNOSTIC_ACCEPTED'|'COMMAND_REJECTED';
export interface LogRecord { code:LogCode; atMs:number; bootId:string; connectionId:string|null; correlationId:string|null; sequence:string; }
/** Fixed fields, no free-text payload, credentials, addresses, media or exception strings. */
export class BoundedLogs {
  #records:LogRecord[]=[];#sequence=0n;#dropped=0;
  constructor(readonly bootId:string,readonly now:()=>number){}
  record(code:LogCode,connectionId:string|null=null,correlationId:string|null=null):void {
    const id=(s:string|null)=>s!==null && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(s)?s:null;
    if(this.#records.length===128){this.#records.shift();this.#dropped=Math.min(2147483647,this.#dropped+1);}
    this.#records.push({code,atMs:this.now(),bootId:this.bootId,connectionId:id(connectionId),correlationId:id(correlationId),sequence:String(++this.#sequence)});
  }
  snapshot(){return {records:structuredClone(this.#records),dropped:this.#dropped,durable:false};}
}
