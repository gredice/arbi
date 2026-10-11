import {createPrivateKey,randomUUID,sign} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createJobReference} from '../dist/jobs/reference.js';
import {configurationCapabilities,configurationDigest} from '@arbi/protocol';
// Independent native controller for the isolated browser harness. No deployment defaults.
if(!process.send)throw Error('FIXTURE_ONLY');
process.once('message',async input=>{
  let rig,localTimer,networkTimer,telemetryTimer,stopped=false,networkBusy=false,telemetryBusy=false,sequence=0n,telemetrySequence=0n,lastState='Ready',failure='composition';
  const reports=new Map(),telemetryReports=new Map(),seenOutcome=new Map(),known=new Set(),start=performance.now();let seenDispatches=0;
  try{
    const origin=new URL(input.origin);if(input.realm.environment!=='test'||origin.protocol!=='http:'||origin.hostname!=='127.0.0.1')throw Error('ISOLATED_LOOPBACK_REQUIRED');
    const key=createPrivateKey(input.key);
    failure='scope';rig=createJobReference(input.directory,{scope:{realm:input.realm,siteId:input.siteId,receiver:input.identity},manual:{deadmanMs:750,maxJogMs:500,maxLeaseMs:5000}});
    failure='network';
    const {authority:a}=rig;
    const capabilities=a.applied.request.configuration.components.flatMap(component=>configurationCapabilities(a.applied.request.configuration,component.id));
    a.gate.lease=null;
    const event=(body,stream='event')=>{const seq=String(stream==='event'?++sequence:++telemetrySequence);return {protocol:'arbi/1.0',messageId:randomUUID(),realm:input.realm,siteId:input.siteId,source:input.identity,sequence:seq,
      sourceTime:{utc:new Date().toISOString(),monotonicMs:a.gate.nowMonotonicMs,uncertaintyMs:10},ingestTime:null,kind:'event',executionMode:'simulation',body:typeof body==='function'?body(seq):body};};
    const post=async(action,payload,feature='control')=>{
      const issuedAtMs=Date.now(),unsigned={version:feature==='control'?'arbi.jobs-device/1.0':'arbi.telemetry/1.0',realm:input.realm,siteId:input.siteId,deviceId:input.identity.deviceId,credentialId:input.credentialId,identity:input.identity,
        ...(feature==='telemetry'?{configRevision:a.gate.configRevision}:{}),issuedAtMs,expiresAtMs:issuedAtMs+2000,action,payload};
      const response=await fetch(`${input.origin}/api/sites/${input.siteId}/dashboard-${feature}/device`,{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(2000),
        body:JSON.stringify({...unsigned,signature:sign(null,Buffer.from(`arbi-device-proof/1.0:${configurationDigest(unsigned)}`),key).toString('base64url')})});
      if(!response.ok){failure=`${action}-${response.status}`;throw Error('CLOUD_UNAVAILABLE');}return response.json();
    };
    const remember=r=>{if(!r)return;lastState=r.state;const id=r.command.command.commandId;
      if(seenOutcome.get(id)===r.event.body.outcome)return;
      // Outcomes must preserve the durable local event until cloud acknowledgement.
      const outcome=structuredClone(r.event);outcome.sequence=String(++sequence);outcome.sourceTime.utc=new Date().toISOString();outcome.sourceTime.uncertaintyMs=10;
      reports.set(outcome.messageId,outcome);if(telemetryReports.size>=64)telemetryReports.delete(telemetryReports.keys().next().value);
      telemetryReports.set(outcome.messageId,outcome);seenOutcome.set(id,r.event.body.outcome);
    };
    const observeDispatches=()=>{for(const operation of rig.adapter.dispatches.slice(seenDispatches))process.send({local:{effect:'dispatch',commandId:operation.commandId,
      operationId:operation.id,phase:operation.phase,atMonotonicMs:operation.startedAtMs}});seenDispatches=rig.adapter.dispatches.length;};
    localTimer=setInterval(()=>{
      try{a.gate.nowMonotonicMs=1000+Math.floor(performance.now()-start);rig.advance(a.gate.nowMonotonicMs);
        for(const id of known)remember(rig.journal.get(id));observeDispatches();a.state=lastState;
      }catch{a.gate.faultInhibited=true;rig.adapter.localStop();lastState='Fault';}
    },25);
    async function network(){if(networkBusy||stopped)return;networkBusy=true;
      try{
        const snapshot=event(seq=>({type:'state.snapshot',configRevision:a.gate.configRevision,capabilitiesRevision:'playground-1',capabilities,state:lastState,
          eventCursor:{source:input.identity,stream:'event',sequence:seq},telemetryCursor:null,committedCursor:null,
          supportedCommands:['motion.move','camera.gimbal','camera.capture','control.stop'],supportedProtocols:['arbi/1.0']}));
        await post('snapshot',snapshot);
        for(const [id,outcome] of reports){await post('outcome',outcome);reports.delete(id);}
        const {commands}=await post('poll',{});if(stopped)return false;a.cloudConnected=true;
        for(const command of commands){
          a.gate.authenticatedSource=command.source;a.gate.authorizedActor=command.command.actor;
          a.gate.lease=command.command.lease?{...command.command.lease,receiver:command.command.target,expiresMonotonicMs:command.command.deadline.expiresMonotonicMs}:null;
          if(command.body.type==='camera.capture'){
            if(!['bed-a-plant-1','bed-b-plant-1'].includes(command.body.resourceId))throw Error('UNKNOWN_PLANT');
            rig.manual.lost('ended');a.capturePlan.resourceId=command.body.resourceId;
            a.capturePlan.positionMm={x:1000,y:2000,z:2490};a.capturePlan.panDeg=0;a.capturePlan.tiltDeg=0;
          }else if(['motion.move','camera.gimbal'].includes(command.body.type)&&!rig.journal.duplicate(command)){
            try{rig.manual.acquire();rig.manual.pulse(command.sequence);}catch(error){
              process.send({local:{effect:'admission-rejected',commandId:command.command.commandId,error:error.code,atMonotonicMs:a.gate.nowMonotonicMs}});throw error;
            }
          }
          known.add(command.command.commandId);remember(rig.consumer.receive(command));observeDispatches();
        }
        return true;
      }catch{a.cloudConnected=false;rig.manual.lost('revoked');rig.adapter.localStop();return false;}
      finally{networkBusy=false;}
    }
    async function telemetryStep(){if(telemetryBusy||stopped)return false;telemetryBusy=true;
      try{
        const snapshot=event(seq=>({type:'state.snapshot',configRevision:a.gate.configRevision,capabilitiesRevision:'playground-1',capabilities,state:lastState,
          eventCursor:{source:input.identity,stream:'event',sequence:seq},telemetryCursor:{source:input.identity,stream:'telemetry',sequence:String(telemetrySequence)},committedCursor:null,
          supportedCommands:['motion.move','camera.gimbal','camera.capture','control.stop'],supportedProtocols:['arbi/1.0']}));
        await post('ingest',snapshot,'telemetry');
        const message={...event({},'telemetry'),kind:'telemetry',body:{type:'telemetry.samples',capabilitiesRevision:'playground-1',
          samples:rig.adapter.modules.feedback(a.gate.nowMonotonicMs).map(sample=>sample.metric.startsWith('line.')?{...sample,frame:{name:'none',revision:null}}:sample)}};
        await post('ingest',message,'telemetry');
        for(const [id,outcome] of telemetryReports){await post('ingest',outcome,'telemetry');telemetryReports.delete(id);}
        return true;
      }catch{return false;}finally{telemetryBusy=false;}
    }
    let ready=false;for(let attempt=0;attempt<3&&!ready;attempt++){ready=await network();if(!ready)await new Promise(resolve=>setTimeout(resolve,100));}
    if(!ready)throw Error('CLOUD_UNAVAILABLE');ready=false;for(let attempt=0;attempt<3&&!ready;attempt++)ready=await telemetryStep();
    if(!ready)throw Error('CLOUD_UNAVAILABLE');networkTimer=setInterval(network,250);telemetryTimer=setInterval(telemetryStep,1000);process.send({ready:true});
    const close=()=>{if(stopped)return;stopped=true;clearInterval(localTimer);clearInterval(networkTimer);clearInterval(telemetryTimer);rig.close();};
    process.on('message',message=>{if(message==='stop'){close();process.disconnect();}});
    process.on('disconnect',()=>{close();process.exit(0);});
  }catch{clearInterval(localTimer);clearInterval(networkTimer);clearInterval(telemetryTimer);rig?.close();process.send({error:'ISOLATED_CONTROLLER_FAILED',phase:failure});process.disconnect();}
});
