import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
let sha='unknown',dirty=true;
try {
  sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  if(!/^[a-f0-9]{40}$/u.test(sha))throw new Error('UNKNOWN_SOURCE');
  dirty=execFileSync('git',['status','--porcelain'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().length>0;
} catch {sha='unknown';dirty=true;}
writeFileSync(new URL('../dist/build-identity.json',import.meta.url),JSON.stringify({version:'0.1.0',sha,dirty}));
