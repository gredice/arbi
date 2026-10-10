import { createPrivateKey } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { ApplicationMeter, TrafficSpool, stamp } from '@arbi/traffic';
import type { Scope } from '@arbi/traffic';
import { AblySubscription } from './ably.js';
import { RecoveryConsumer } from './consumer.js';
import { HttpsRecoveryApi } from './http.js';
import type { ConsumerConfig } from './contracts.js';
// Independent executable. It never imports the local runtime/supervisor/jobs.
// Operator supplies protected synthetic-test composition; nothing is default.
let timer: NodeJS.Timeout|undefined;let spool: TrafficSpool|undefined;let consumer: RecoveryConsumer|undefined;
try {
  const path=process.env.ARBI_CLOUD_RECOVERY_CONFIG;
  if(!path || !isAbsolute(path)) throw new Error();
  const file=statSync(path);if(file.size>8192 || (file.mode&0o077)!==0) throw new Error();
  const config=JSON.parse(readFileSync(path,'utf8')) as ConsumerConfig & {origin:string;credentialId:string;keyPath:string;spoolPath:string;boundary:Scope['boundary']};
  if(!isAbsolute(config.keyPath) || !isAbsolute(config.spoolPath) || statSync(config.keyPath).size>8192 || (statSync(config.keyPath).mode&0o077)!==0) throw new Error();
  const key=createPrivateKey(readFileSync(config.keyPath));
  spool=new TrafficSpool({path:config.spoolPath,binding:{realm:config.realm,siteId:config.siteId,executionMode:'simulation',deviceId:config.identity.deviceId},
    maxRecords:2048,maxBytes:16777216,maxPages:8192,maxCounters:1});
  const meter=new ApplicationMeter(spool,() => stamp(config.identity.bootId));
  const api=new HttpsRecoveryApi({...config,key},meter,{realm:config.realm,siteId:config.siteId,executionMode:'simulation',source:config.identity,boundary:config.boundary,linkId:'cloud-recovery'});
  consumer=new RecoveryConsumer(config,api,new AblySubscription(undefined,{meter,spec:api.spec('download','telemetry')},api.traffic));
  timer=setInterval(() => {void consumer!.step();},250);
  const stop=() => {clearInterval(timer);consumer?.close();spool?.close();};
  process.once('SIGTERM',stop);process.once('SIGINT',stop);
  process.stdout.write('Simulation recovery consumer started; actuator dispatch unavailable.\n');
} catch {clearInterval(timer);consumer?.close();spool?.close();process.stderr.write('Cloud recovery configuration unavailable.\n');process.exitCode=1;}
