import { readFileSync,statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { INCIDENT_MAX_BYTES,IncidentReplay } from './incident.js';

export async function runIncidentCli(args:string[]) {
  if(!args[0] || args.slice(1).some(v=>v!=='--interactive'))throw Error('INVALID_INCIDENT_ARGUMENT');
  const file=statSync(args[0]);if(!file.isFile() || file.size>INCIDENT_MAX_BYTES)throw Error('INVALID_INCIDENT');
  const replay=new IncidentReplay(readFileSync(args[0],'utf8'));
  const output=()=>process.stdout.write(JSON.stringify(replay.snapshot())+'\n');output();
  if(!args.includes('--interactive'))return;
  for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
    if(line.length>128)throw Error('INVALID_INCIDENT_ARGUMENT');
    const [command,value,...rest]=line.trim().split(/\s+/);if(rest.length)throw Error('INVALID_INCIDENT_ARGUMENT');
    if(command==='play' && value===undefined)replay.play();
    else if(command==='pause' && value===undefined)replay.pause();
    else if(command==='seek' && value!==undefined)replay.seek(Number(value));
    else if(command==='speed' && value!==undefined)replay.speed(Number(value));
    else if(command==='advance' && value!==undefined)replay.advance(Number(value));
    else if(command!=='status' || value!==undefined)throw Error('INVALID_INCIDENT_ARGUMENT');
    output();
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try{await runIncidentCli(process.argv.slice(2));}
  catch{process.stderr.write('Incident replay failed: invalid or unavailable local bundle.\n');process.exitCode=2;}
}
