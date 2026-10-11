import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { IncidentReplay,exportIncident,incidentDigest,incidentRows,parseIncident,parseIncidentExport } from './incident.js';
import { compareIncident } from './incident-comparison.js';
import { loadPlant } from './plant-runner.js';
import { runPlant } from './plant.js';
const path=fileURLToPath(new URL('../fixtures/incidents/synthetic-fault.json',import.meta.url));
const fixture=()=>parseIncident(readFileSync(path,'utf8'));
const seal=(b:ReturnType<typeof fixture>)=>{const {digest:_,...payload}=b;return {...payload,digest:incidentDigest(payload)};};

test('committed incident preserves fault, logical command, clocks, gaps, late arrivals and duplicate receipts through seek/restart',()=>{
  const b=fixture(),replay=new IncidentReplay(b);
  const end=replay.seek(1000);assert.equal(end.output,'read-only');assert.equal(end.rows.length,12);
  assert.ok(end.rows.some(r=>r.gap==='2'));assert.ok(end.rows.some(r=>r.outOfOrder));assert.ok(end.rows.some(r=>r.duplicate));
  assert.ok(end.rows.some(r=>'raw' in r && 'body' in r.raw && r.raw.body.type==='fault.changed'));
  assert.ok(end.rows.some(r=>'raw' in r && 'body' in r.raw && r.raw.body.type==='command.outcome' && r.raw.body.outcome==='failed'));
  assert.deepEqual(end.rows.find(r=>r.recordId==='incident-measured-voltage')!.sourceTime,b.records[7]!.kind==='protocol'?b.records[7].raw.sourceTime:null);
  const at=replay.seek(250);replay.pause();assert.equal(replay.advance(500).atMs,250);
  replay.speed(2);replay.play();assert.equal(replay.advance(100).atMs,450);
  assert.deepEqual(replay.seek(250).rows,new IncidentReplay(b).seek(250).rows);assert.deepEqual(at.rows,replay.snapshot().rows);
  b.records.length=0;assert.equal(replay.seek(1000).rows.length,12);
});
test('portable integrity, closed fields and bounded JSON reject corruption, credentials, cycles and accessors without invoking them',()=>{
  const changed=fixture();changed.records[0]!.offsetMs=1;assert.throws(()=>parseIncident(changed),/INCIDENT_INTEGRITY/);
  assert.throws(()=>parseIncident({...fixture(),credentials:'secret'}),/INVALID_INCIDENT/);
  const clock=fixture();if(clock.records[0]!.kind==='protocol')clock.records[0].raw.sourceTime.uncertaintyMs=null;
  assert.throws(()=>parseIncident(seal(clock)),/INVALID_INCIDENT/);
  const cycle:any={};cycle.self=cycle;assert.throws(()=>parseIncident(cycle),/INVALID_INCIDENT/);
  let calls=0;const getter=Object.defineProperty({},'schemaVersion',{enumerable:true,get(){calls++;return 'arbi.incident/1.0';}});
  assert.throws(()=>parseIncident(getter),/INVALID_INCIDENT/);assert.equal(calls,0);
  const revision=fixture();revision.records[0]!.configRevision='unrelated-config';assert.throws(()=>parseIncident(seal(revision)),/INVALID_INCIDENT/);
  const conflicting=fixture();const row=conflicting.records[6]!;if(row.kind==='protocol')row.raw.sourceTime.monotonicMs+=1;
  assert.ok(incidentRows(parseIncident(seal(conflicting))).some(r=>r.identityConflict));
  const many=fixture();many.records=Array.from({length:513},()=>many.records[0]!);assert.throws(()=>parseIncident(seal(many)),/INVALID_INCIDENT/);
});
test('exports replay surviving correlations and clock quality while omitting raw commands, sensor positions, actors, sessions and media',()=>{
  const b=fixture(),exported=exportIncident(b,'a'.repeat(64)),json=JSON.stringify(exported);
  assert.equal(parseIncidentExport(json).digest,exported.digest);assert.equal(new IncidentReplay(exported).seek(1000).rows.length,12);
  assert.ok(exported.rows.some(r=>r.summary.commandId==='command-1'));
  for(const text of ['positionMm','"samples":','signedUrl','privateKey','sessionId','"raw"'])assert.equal(json.includes(text),false);
  assert.equal(json.includes(JSON.stringify((b.records[0]!.raw as any).command.actor)),false);
  const tampered={...exported,rows:exported.rows.slice(1)};assert.throws(()=>parseIncidentExport(tampered),/INCIDENT_INTEGRITY/);
  const injected=structuredClone(exported);(injected.rows[0]!.summary as any).token='credential';assert.throws(()=>parseIncidentExport(injected),/INVALID_INCIDENT/);
});
test('named affine plant prediction comparison reports residuals, tested range and missing uncertainty; unavailable/commanded values are excluded',()=>{
  const b=fixture(),loaded=loadPlant(fileURLToPath(new URL('../fixtures/plant/1.0/nominal.json',import.meta.url)),fileURLToPath(new URL('../../arbi-protocol',import.meta.url)));
  const model=runPlant(loaded.plant,loaded.config,loaded.referenceDigest),voltage=model.trace.find(r=>r.voltageQ6!==null)!.voltageQ6!/1e6;
  const report=compareIncident(b,[{recordId:'incident-measured-voltage',metric:'power.voltage',unit:'V',value:voltage-0.5,uncertainty:0.1},
    {recordId:'incident-estimated-position',metric:'position.x',unit:'mm',value:1000,uncertainty:null},
    {recordId:'incident-estimated-position',metric:'line.tension.a',unit:'N',value:1,uncertainty:null}]);
  assert.deepEqual(report,JSON.parse(readFileSync(new URL('../fixtures/incidents/synthetic-comparison.json',import.meta.url),'utf8')));
  assert.equal(report.physicalEvidence,'unavailable-synthetic-only');assert.equal(report.fittedParameters,false);
  assert.ok(Math.abs(report.groups[0]!.bias-0.6)<1e-12);assert.ok(Math.abs(report.groups[0]!.rmse-0.6)<1e-12);assert.equal(report.excluded.length,2);
  assert.equal(report.model.revision,b.model.revision);assert.equal(report.data.revision,b.data.revision);
  assert.throws(()=>compareIncident(b,[{recordId:'incident-measured-voltage',metric:'power.voltage',unit:'mm',value:24,uncertainty:null}]),/UNIT_MISMATCH/);
});
test('real CLI replay of control-bearing records never reaches a listening live HTTP target',async t=>{
  let calls=0;const server=createServer((_request,response)=>{calls++;response.end('unexpected');});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const address=server.address();assert.ok(address && typeof address==='object');
  const child=spawn(process.execPath,[fileURLToPath(new URL('./incident-cli.js',import.meta.url)),path,'--interactive'],
    {stdio:['pipe','pipe','pipe'],env:{...process.env,ARBI_LIVE_CONTROL_ENDPOINT:`http://127.0.0.1:${address.port}/control`}});
  let stdout='',stderr='';child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});
  child.stdin.end('seek 1000\nplay\nspeed 2\nadvance 100\npause\nseek 250\nstatus\n');
  const code=await new Promise<number|null>((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  assert.equal(code,0,stderr);assert.equal(calls,0);
  const rows=stdout.trim().split('\n').map(line=>JSON.parse(line));assert.equal(rows.at(-1).atMs,250);
  assert.ok(rows.every(row=>row.output==='read-only'));assert.equal(incidentRows(fixture()).length,12);
});
