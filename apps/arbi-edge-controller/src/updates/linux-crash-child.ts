import { createLinuxUpdateReference } from './linux-reference.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LinuxFaultPoint } from './linux-target.js';
const [directory,point]=process.argv.slice(2);
if(!directory||!['image-fsync','image-rename','trial','confirmed'].includes(point??''))throw Error('ISOLATED_CRASH_ARGUMENTS');
let crash:((actual:LinuxFaultPoint)=>void)|undefined;
const reference=await createLinuxUpdateReference('application',65536,directory,(deviceId,actual)=>{if(deviceId==='pod')crash?.(actual);}),target=reference.native.get('pod')!;
crash=(actual:LinuxFaultPoint)=>{if(actual!==point)return;const operation=reference.r.store.list()[0]!,journal=operation.targets.find(t=>t.moduleId==='pod')!.journal;
  writeFileSync(join(directory,'crash-readback.json'),JSON.stringify({version:'arbi.isolated-linux-crash/1.0',realm:reference.r.realm,siteId:reference.r.siteId,deviceId:'pod',now:reference.r.now(),directory:target.options.directory,maximumImageBytes:target.options.maximumImageBytes,maximumSlotBytes:target.options.maximumSlotBytes,trust:{path:target.options.trust.options.path,rootId:target.options.trust.options.rootId,spki:target.options.trust.options.rootPublicKey.export({format:'der',type:'spki'}).toString('base64'),provisioningReviewId:target.options.trust.options.provisioningReviewId},dataPath:target.options.data.options.path,journal}),{mode:0o600});
  process.kill(process.pid,'SIGKILL');};
try{const id=await reference.request();await reference.run(id);throw Error('FAULT_POINT_NOT_REACHED');}finally{await reference.close();}
