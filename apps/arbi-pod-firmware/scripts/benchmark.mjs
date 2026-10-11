import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { once } from 'node:events';
const began=performance.now();
const child=spawn(process.execPath,['--max-old-space-size=64','dist/cli.js','--health-port','0'],{cwd:new URL('../',import.meta.url),stdio:['ignore','pipe','ignore']});
let output='',started;
try {
  started=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('STARTUP_TIMEOUT')),5000);
    child.once('exit',()=>{clearTimeout(timer);reject(new Error('STARTUP_FAILED'));});
    child.stdout.on('data',chunk=>{output+=chunk.toString();if(output.length>2048){clearTimeout(timer);reject(new Error('OUTPUT_LIMIT'));return;}
      if(output.includes('\n')){clearTimeout(timer);try{resolve(JSON.parse(output.split('\n')[0]));}catch{reject(new Error('OUTPUT_INVALID'));}}});
  });
  const startupMs=performance.now()-began,url=`http://127.0.0.1:${started.ports.healthPort}/health`;
  const first=await(await fetch(url)).json();await new Promise(resolve=>setTimeout(resolve,2000));const last=await(await fetch(url)).json();
  const elapsedMs=last.resources.sampleMonotonicMs-first.resources.sampleMonotonicMs;
  const cpuMicroseconds=last.resources.cpuMicroseconds.user+last.resources.cpuMicroseconds.system-first.resources.cpuMicroseconds.user-first.resources.cpuMicroseconds.system;
  process.stdout.write(`${JSON.stringify({stage:'development-host',hardwareAcceptance:false,runtime:last.runtime,firmware:last.firmware,startupMs,
    intervalMs:elapsedMs,rssBytes:last.resources.rssBytes,cpuMicroseconds,cpuPercent:cpuMicroseconds/(elapsedMs*10),temperature:last.health.temperature,
    networkBytes:null,networkReason:'no-interface-baseline-collected',actuationInhibited:last.actuationInhibited,ready:last.ready})}\n`);
} finally {
  const ended=once(child,'exit');child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),5000);await ended;clearTimeout(timer);
}
