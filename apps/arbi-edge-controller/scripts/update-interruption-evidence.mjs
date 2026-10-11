import {writeFileSync,lstatSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const [flag,output]=process.argv.slice(2);
if(flag!=='--output'||!output||process.argv.length!==4)throw Error('EXPLICIT_OUTPUT_REQUIRED');
const path=resolve(output),parent=lstatSync(dirname(path));if(!parent.isDirectory()||(parent.mode&0o077))throw Error('PRIVATE_OUTPUT_DIRECTORY_REQUIRED');
const root=fileURLToPath(new URL('../../../',import.meta.url));
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const sourceCommit=git(['rev-parse','HEAD']);if(git(['status','--porcelain']))throw Error('CLEAN_SOURCE_REQUIRED');
// Rebuild the entire dependency closure before importing measured modules. A clean
// checkout alone does not prove that existing dist files belong to this commit.
execFileSync(process.execPath,[resolve(root,'node_modules/turbo/bin/turbo'),'build','--filter=@arbi/edge-controller','--force'],{cwd:root,stdio:'ignore',timeout:120000});
const unchanged=()=>{if(git(['rev-parse','HEAD'])!==sourceCommit||git(['status','--porcelain']))throw Error('SOURCE_CHANGED_DURING_MEASUREMENT');};
unchanged();const {runUpdateInterruptionMatrix}=await import('../dist/updates/interruption-matrix.js');
const evidence=await runUpdateInterruptionMatrix();unchanged();
writeFileSync(path,JSON.stringify({...evidence,sourceCommit,dirty:false},null,2)+'\n',{flag:'wx',mode:0o600});
process.stdout.write('Isolated host interruption evidence written; physical gates remain blocked.\n');
