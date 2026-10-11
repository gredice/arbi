import { readFileSync } from 'node:fs';
import { CaptureStore } from './capture-store.js';
const input=JSON.parse(readFileSync(process.argv[2],'utf8')) as {root:string;binding:unknown};
const store=new CaptureStore(input);const r=store.reserve({commandId:'crash-capture',correlationId:'crash-job',resourceId:'synthetic-bed',fingerprint:'5'.repeat(64)});
process.stdout.write(JSON.stringify({state:r.state})+'\n');process.stdin.resume();
