import { createPrivateKey } from 'node:crypto';
import { ApplicationMeter, TrafficSpool, stamp } from '@arbi/traffic';
import { RecoveryConsumer } from '../dist/cloud-realtime/consumer.js';
import { HttpsRecoveryApi } from '../dist/cloud-realtime/http.js';
// Native integration process; ephemeral private key arrives over IPC, never a
// fixture deployment default or command-line/env secret. Broker SDK is tested separately.
if(!process.send) throw new Error('FIXTURE_ONLY');
process.once('message',async (input) => {
  let spool;
  try {
    spool=new TrafficSpool({path:input.spoolPath,binding:{realm:input.realm,siteId:input.siteId,executionMode:'simulation',deviceId:input.identity.deviceId},maxRecords:64,maxBytes:524288,maxPages:1024,maxCounters:1});
    const meter=new ApplicationMeter(spool,() => stamp(input.identity.bootId));
    const api=new HttpsRecoveryApi({...input,key:createPrivateKey(input.key)},meter,{realm:input.realm,siteId:input.siteId,executionMode:'simulation',source:input.identity,boundary:'lan',linkId:'recovery-fixture'},fetch,true);
    const consumer=new RecoveryConsumer(input,api,{open:async () => () => {}});
    await consumer.step();
    const records=spool.pending(16);
    process.send({status:consumer.status,snapshot:consumer.snapshot,jobs:consumer.lastPolledJobs,records});consumer.close();
  } catch {process.send({error:'ISOLATED_CONSUMER_FAILED'});}
  finally {spool?.close();process.disconnect();}
});
