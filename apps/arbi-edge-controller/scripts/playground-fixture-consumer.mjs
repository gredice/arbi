import {createPrivateKey,randomUUID,sign} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createJobReference} from '../dist/jobs/reference.js';
import {configurationDigest} from '@arbi/protocol';
// Independent native controller for the isolated browser harness. No deployment defaults.
if(!process.send)throw Error('FIXTURE_ONLY');
process.once('message',async input=>{
  let rig,localTimer,networkTimer,stopped=false,networkBusy=false,sequence=0n,lastState='Ready',failure='composition';
  const reports=new Map(),seenOutcome=new Map(),known=new Set(),start=performance.now();
  try{
    const origin=new URL(input.origin);if(input.realm.environment!=='test'||origin.protocol!=='http:'||origin.hostname!=='127.0.0.1')throw Error('ISOLATED_LOOPBACK_REQUIRED');
    const key=createPrivateKey(input.key);
    failure='scope';rig=createJobReference(input.directory,{scope:{realm:input.realm,siteId:input.siteId,receiver:input.identity},manual:{deadmanMs:750,maxJogMs:500,maxLeaseMs:5000}});
    failure='network';
    const {authority:a}=rig;
    a.gate.lease=null;
    const event=body=>{const seq=String(++sequence);return {protocol:'arbi/1.0',messageId:randomUUID(),realm:input.realm,siteId:input.siteId,source:input.identity,sequence:seq,
      sourceTime:{utc:new Date().toISOString(),monotonicMs:a.gate.nowMonotonicMs,uncertaintyMs:10},ingestTime:null,kind:'event',executionMode:'simulation',body:typeof body==='function'?body(seq):body};};
    const post=async(action,payload)=>{
      const issuedAtMs=Date.now(),unsigned={version:'arbi.jobs-device/1.0',realm:input.realm,siteId:input.siteId,deviceId:input.identity.deviceId,credentialId:input.credentialId,identity:input.identity,
        issuedAtMs,expiresAtMs:issuedAtMs+2000,action,payload};
      const response=await fetch(`${input.origin}/api/sites/${input.siteId}/dashboard-control/device`,{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(2000),
        body:JSON.stringify({...unsigned,signature:sign(null,Buffer.from(`arbi-device-proof/1.0:${configurationDigest(unsigned)}`),key).toString('base64url')})});
      if(!response.ok){failure=`${action}-${response.status}`;throw Error('CLOUD_UNAVAILABLE');}return response.json();
    };
    const remember=r=>{if(!r)return;lastState=r.state;const id=r.command.command.commandId;
      if(seenOutcome.get(id)===r.event.body.outcome)return;
      // Outcomes must preserve the durable local event until cloud acknowledgement.
      const outcome=structuredClone(r.event);outcome.sequence=String(++sequence);outcome.sourceTime.utc=new Date().toISOString();outcome.sourceTime.uncertaintyMs=10;
      reports.set(outcome.messageId,outcome);seenOutcome.set(id,r.event.body.outcome);
    };
    localTimer=setInterval(()=>{
      try{a.gate.nowMonotonicMs=1000+Math.floor(performance.now()-start);rig.advance(a.gate.nowMonotonicMs);
        for(const id of known)remember(rig.journal.get(id));a.state=lastState;
      }catch{a.gate.faultInhibited=true;rig.adapter.localStop();lastState='Fault';}
    },25);
    async function network(){if(networkBusy||stopped)return;networkBusy=true;
      try{
        const snapshot=event(seq=>({type:'state.snapshot',configRevision:a.gate.configRevision,capabilitiesRevision:'playground-1',capabilities:[],state:lastState,
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
            rig.manual.acquire();rig.manual.pulse(command.sequence);
          }
          known.add(command.command.commandId);remember(rig.consumer.receive(command));
        }
        return true;
      }catch{a.cloudConnected=false;rig.manual.lost('revoked');rig.adapter.localStop();return false;}
      finally{networkBusy=false;}
    }
    let ready=false;for(let attempt=0;attempt<3&&!ready;attempt++){ready=await network();if(!ready)await new Promise(resolve=>setTimeout(resolve,100));}
    if(!ready)throw Error('CLOUD_UNAVAILABLE');networkTimer=setInterval(network,100);process.send({ready:true});
    const close=()=>{if(stopped)return;stopped=true;clearInterval(localTimer);clearInterval(networkTimer);rig.close();};
    process.on('message',message=>{if(message==='stop'){close();process.disconnect();}});
    process.on('disconnect',()=>{close();process.exit(0);});
  }catch{clearInterval(localTimer);clearInterval(networkTimer);rig?.close();process.send({error:'ISOLATED_CONTROLLER_FAILED',phase:failure});process.disconnect();}
});
