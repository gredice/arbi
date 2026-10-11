import { PodRuntime } from './runtime.js';
import { loadPodSettings } from './settings.js';
const args=process.argv.slice(2);
let file:string|null=null,healthPort=8081;
try {
  for(let i=0;i<args.length;i++) {
    if(args[i]==='--config' && args[i+1]){file=args[++i];continue;}
    if(args[i]==='--health-port' && /^\d{1,5}$/u.test(args[i+1]??'')){healthPort=Number(args[++i]);if(healthPort>65535)throw new Error('ARGUMENT');continue;}
    throw new Error('ARGUMENT');
  }
  const runtime=new PodRuntime(file?loadPodSettings(file):null);
  const ports=await runtime.start(file?undefined:healthPort);
  process.stdout.write(`${JSON.stringify({code:'STARTED',source:runtime.source,ports,actuationInhibited:true,physicalAcceptance:false})}\n`);
  let closing=false;
  const shutdown=()=>{if(closing)return;closing=true;void runtime.stop().then(()=>{process.exitCode=0;}).catch(()=>{process.exitCode=1;});};
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
} catch {
  process.stderr.write('{"code":"INVALID_STARTUP","details":"redacted"}\n');process.exitCode=78;
}
