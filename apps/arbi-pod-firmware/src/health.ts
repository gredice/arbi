import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { open,statfs } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
export interface HealthSample {
  value:number|boolean|null; unit:'degC'|'bytes'|'boolean'|'V'; quality:'measured'|'estimated'|'unavailable';
  kind:'measurement'|'os-flag'|'estimate'; source:string; origin:'os'|'simulated'; sampleMonotonicMs:number|null; reason:string|null;
}
export interface HealthIO {
  origin:'os'|'simulated';
  temperature():Promise<string>; flags():Promise<string>; freeBytes():Promise<number>; network():Promise<boolean>;
}
export function linuxHealthIO(storageDirectory:string):HealthIO {
  return {
    origin:'os',
    temperature:async()=>{const fd=await open('/sys/class/thermal/thermal_zone0/temp','r');try{const b=Buffer.alloc(64),r=await fd.read(b,0,64,0);if(r.bytesRead===64)throw new Error('SIGNAL_LIMIT');return b.subarray(0,r.bytesRead).toString('utf8');}finally{await fd.close();}},
    flags:async()=> (await promisify(execFile)('/usr/bin/vcgencmd',['get_throttled'],{timeout:250,maxBuffer:128,encoding:'utf8'})).stdout,
    freeBytes:async()=>{const v=await statfs(storageDirectory,{bigint:true});const n=v.bavail*v.bsize;if(n>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('STORAGE_RANGE');return Number(n);},
    network:async()=>Object.values(networkInterfaces()).some(rows=>rows?.some(r=>!r.internal)),
  };
}
export async function collectHealth(io:HealthIO,now:()=>number):Promise<Record<string,HealthSample>> {
  const probe=async<T>(work:()=>Promise<T>):Promise<T>=>{
    let timer:NodeJS.Timeout|undefined;
    try{return await Promise.race([Promise.resolve().then(work),new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(new Error('PROBE_TIMEOUT')),500);})]);}
    finally{clearTimeout(timer);}
  };
  const unavailable=(unit:HealthSample['unit'],kind:HealthSample['kind'],source:string):HealthSample=>({value:null,unit,kind,source,origin:io.origin,quality:'unavailable',sampleMonotonicMs:null,reason:'unsupported-or-unreadable'});
  const measured=(value:number|boolean,unit:HealthSample['unit'],kind:HealthSample['kind'],source:string):HealthSample=>({value,unit,kind,source,origin:io.origin,quality:io.origin==='simulated'?'estimated':'measured',sampleMonotonicMs:now(),reason:null});
  const [temperature,flags,storage,network]=await Promise.allSettled([probe(()=>io.temperature()),probe(()=>io.flags()),probe(()=>io.freeBytes()),probe(()=>io.network())]);
  const values:Record<string,HealthSample>={temperature:unavailable('degC','measurement','linux-thermal-sysfs'),freeStorage:unavailable('bytes','os-flag','statfs-bavail'),
    undervoltageNow:unavailable('boolean','os-flag','vcgencmd-get-throttled'),undervoltageSinceBoot:unavailable('boolean','os-flag','vcgencmd-get-throttled'),
    throttledNow:unavailable('boolean','os-flag','vcgencmd-get-throttled'),throttledSinceBoot:unavailable('boolean','os-flag','vcgencmd-get-throttled'),
    networkConfigured:unavailable('boolean','estimate','os-network-interfaces'),voltage:unavailable('V','measurement','electrical-sensor-not-installed')};
  if(temperature.status==='fulfilled' && /^-?\d{1,6}\s*$/u.test(temperature.value)) {
    const n=Number(temperature.value.trim())/1000;if(n>=-40 && n<=150)values.temperature=measured(n,'degC','measurement','linux-thermal-sysfs');
  }
  if(flags.status==='fulfilled' && /^throttled=0x[0-9a-f]{1,8}\s*$/iu.test(flags.value)) {
    const n=Number.parseInt(flags.value.trim().match(/^throttled=0x([0-9a-f]{1,8})$/iu)![1],16);
    for(const [name,mask] of [['undervoltageNow',1],['undervoltageSinceBoot',1<<16],['throttledNow',1<<2],['throttledSinceBoot',1<<18]] as const)
      values[name]=measured(Boolean(n&mask),'boolean','os-flag','vcgencmd-get-throttled');
  }
  if(storage.status==='fulfilled' && Number.isSafeInteger(storage.value) && storage.value>=0)values.freeStorage=measured(storage.value,'bytes','os-flag','statfs-bavail');
  if(network.status==='fulfilled' && typeof network.value==='boolean')values.networkConfigured={...measured(network.value,'boolean','estimate','os-network-interfaces'),quality:'estimated'};
  return values;
}
