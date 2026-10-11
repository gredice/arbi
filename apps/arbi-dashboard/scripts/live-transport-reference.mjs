import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { arch, platform, release, cpus } from 'node:os';
import assert from 'node:assert/strict';
if(platform()!=='linux'){const optional=process.argv.includes('--optional');process.stdout.write(`${JSON.stringify({version:'arbi.live-transport-reference/1.0',stage:'skipped',reason:'linux-resource-sampler-required',platform:platform(),physicalAcceptance:false})}\n`);process.exit(optional?0:2);}
const hz=Number(execFileSync('getconf',['CLK_TCK'],{encoding:'utf8'}).trim());
// Candidate experiment only: synthetic canvas, local host ICE, no camera, credentials or WAN.
const deadline=setTimeout(()=>{process.stderr.write('TRANSPORT_REFERENCE_TIMEOUT\n');void launcher?.kill();},45000);deadline.unref();
const server=createServer((_request,response)=>{response.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});response.end('<!doctype html><title>ARBI synthetic transport</title><canvas width="320" height="240"></canvas><video muted autoplay playsinline></video>');});
server.listen(0,'127.0.0.1');await once(server,'listening');
let launcher,browser,context;
function resources(pid){
  const records=new Map();let gaps=0;
  for(const name of readdirSync('/proc').filter(value=>/^[0-9]+$/.test(value))){
    try{const stat=readFileSync(`/proc/${name}/stat`,'utf8'),fields=stat.slice(stat.lastIndexOf(')')+2).split(' ');records.set(Number(name),{parent:Number(fields[1]),ticks:Number(fields[11])+Number(fields[12])});}catch{gaps++;}}
  const included=new Set([pid]);let changed=true;
  while(changed){changed=false;for(const [current,record]of records)if(included.has(record.parent)&&!included.has(current)){included.add(current);changed=true;}}
  let ticks=0,rssBytes=0;
  for(const current of included){const record=records.get(current);if(!record){gaps++;continue;}ticks+=record.ticks;
    try{const status=readFileSync(`/proc/${current}/status`,'utf8').match(/^VmRSS:\s+(\d+) kB$/m);if(!status){gaps++;continue;}rssBytes+=Number(status[1])*1024;}catch{gaps++;}}
  return {ticks,rssBytes,processes:included.size,gaps};}
try{
  if(platform()!=='linux')throw Error('LINUX_RESOURCE_SAMPLER_REQUIRED');
  launcher=await chromium.launchServer({headless:true,host:'127.0.0.1',timeout:5000});browser=await chromium.connect(launcher.wsEndpoint());context=await browser.newContext();
  const origin=`http://127.0.0.1:${server.address().port}`,sender=await context.newPage();await sender.goto(origin);
  await sender.evaluate(()=>{const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');let frame=0;
    const paint=()=>{ctx.fillStyle='#203040';ctx.fillRect(0,0,320,240);ctx.fillStyle='#e0c080';ctx.fillRect((frame++*7)%280,30,40,120);ctx.fillStyle='#fff';ctx.fillText(String(frame),5,20);};
    paint();window.paintTimer=setInterval(paint,200);window.stream=canvas.captureStream(5);window.peers=[];});
  const viewers=[];
  for(let index=0;index<2;index++){
    const viewer=await context.newPage();await viewer.goto(origin);viewers.push(viewer);
    await viewer.evaluate(()=>{window.peer=new RTCPeerConnection({iceServers:[]});window.peer.ontrack=event=>{document.querySelector('video').srcObject=event.streams[0];};});
    const offer=await sender.evaluate(async()=>{const peer=new RTCPeerConnection({iceServers:[]});window.peers.push(peer);
      const transceiver=peer.addTransceiver(window.stream.getVideoTracks()[0],{direction:'sendonly',streams:[window.stream],sendEncodings:[{maxBitrate:96000,maxFramerate:5}]});
      const codecs=RTCRtpSender.getCapabilities('video').codecs.filter(codec=>codec.mimeType.toLowerCase()==='video/vp8');if(!codecs.length)throw Error('VP8_UNAVAILABLE');transceiver.setCodecPreferences(codecs);
      await peer.setLocalDescription(await peer.createOffer());if(peer.iceGatheringState!=='complete')await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('ICE_GATHER_TIMEOUT')),3000);peer.addEventListener('icegatheringstatechange',()=>{if(peer.iceGatheringState==='complete'){clearTimeout(timer);resolve();}});});return peer.localDescription.toJSON();});
    const answer=await viewer.evaluate(async offer=>{await window.peer.setRemoteDescription(offer);await window.peer.setLocalDescription(await window.peer.createAnswer());
      if(window.peer.iceGatheringState!=='complete')await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('ICE_GATHER_TIMEOUT')),3000);window.peer.addEventListener('icegatheringstatechange',()=>{if(window.peer.iceGatheringState==='complete'){clearTimeout(timer);resolve();}});});return window.peer.localDescription.toJSON();},offer);
    await sender.evaluate(async({index,answer})=>window.peers[index].setRemoteDescription(answer),{index,answer});await viewer.waitForFunction(()=>document.querySelector('video').readyState>=2,null,{timeout:5000});}
  const snapshot=page=>page.evaluate(async()=>{const result=[];for(const peer of window.peers??[window.peer]){const stats=await peer.getStats(),all=[...stats.values()],out=all.find(r=>r.type==='outbound-rtp'&&r.kind==='video'),input=all.find(r=>r.type==='inbound-rtp'&&r.kind==='video'),pair=all.find(r=>r.type==='candidate-pair'&&r.state==='succeeded'&&r.nominated),local=pair&&stats.get(pair.localCandidateId),remote=pair&&stats.get(pair.remoteCandidateId);
      result.push({connection:peer.connectionState,timestampMs:out?.timestamp??input?.timestamp,rtpPayloadBytesSent:out?.bytesSent??null,rtpPayloadBytesReceived:input?.bytesReceived??null,framesEncoded:out?.framesEncoded??null,framesDecoded:input?.framesDecoded??null,totalEncodeTimeSeconds:out?.totalEncodeTime??null,packetsLost:input?.packetsLost??null,currentRoundTripTimeSeconds:pair?.currentRoundTripTime??null,localCandidateType:local?.candidateType??null,remoteCandidateType:remote?.candidateType??null,transportProtocol:local?.protocol??null});}return result;});
  const before=await snapshot(sender),beforeViewers=await Promise.all(viewers.map(snapshot)),first=resources(launcher.process().pid),began=performance.now();let peakRss=first.rssBytes,gaps=first.gaps;
  const sampler=setInterval(()=>{const sample=resources(launcher.process().pid);peakRss=Math.max(peakRss,sample.rssBytes);gaps+=sample.gaps;},200);
  try{await sender.waitForTimeout(5000);}finally{clearInterval(sampler);}
  const after=await snapshot(sender),afterViewers=await Promise.all(viewers.map(snapshot)),last=resources(launcher.process().pid),elapsedMs=performance.now()-began;
  const paths=after.map((row,index)=>{const received=afterViewers[index][0],old=before[index],oldReceived=beforeViewers[index][0];assert.equal(row.connection,'connected');assert.equal(received.connection,'connected');assert.ok(row.framesEncoded>old.framesEncoded);assert.ok(received.framesDecoded>oldReceived.framesDecoded);assert.equal(row.localCandidateType,'host');assert.equal(row.remoteCandidateType,'host');
    return {...row,rtpPayloadBytesSent:row.rtpPayloadBytesSent-old.rtpPayloadBytesSent,rtpPayloadBytesReceived:received.rtpPayloadBytesReceived-oldReceived.rtpPayloadBytesReceived,framesEncoded:row.framesEncoded-old.framesEncoded,framesDecoded:received.framesDecoded-oldReceived.framesDecoded,encodeTimeSeconds:row.totalEncodeTimeSeconds-old.totalEncodeTimeSeconds,packetsLost:received.packetsLost-oldReceived.packetsLost,observedPayloadBps:8000*(row.rtpPayloadBytesSent-old.rtpPayloadBytesSent)/(row.timestampMs-old.timestampMs)};});
  await viewers[0].evaluate(()=>window.peer.close());await sender.evaluate(()=>window.peers[0].close());const survivor=(await snapshot(viewers[1]))[0].framesDecoded;await viewers[1].waitForTimeout(600);assert.ok((await snapshot(viewers[1]))[0].framesDecoded>survivor);
  await sender.evaluate(()=>{clearInterval(window.paintTimer);window.stream.getTracks().forEach(track=>track.stop());window.peers.forEach(peer=>peer.close());});
  const relayOnlyWithoutProvider=await sender.evaluate(async()=>{const peer=new RTCPeerConnection({iceServers:[],iceTransportPolicy:'relay'});try{peer.createDataChannel('isolated-probe');await peer.setLocalDescription(await peer.createOffer());if(peer.iceGatheringState!=='complete')await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('RELAY_PROBE_TIMEOUT')),3000);peer.addEventListener('icegatheringstatechange',()=>{if(peer.iceGatheringState==='complete'){clearTimeout(timer);resolve();}});});const stats=await peer.getStats();return {state:'unsupported-unconfigured',localCandidates:[...stats.values()].filter(row=>row.type==='local-candidate').length,providerConfigured:false,feasibilityMeasured:false};}finally{peer.close();}});assert.equal(relayOnlyWithoutProvider.localCandidates,0);
  process.stdout.write(`${JSON.stringify({version:'arbi.live-transport-reference/1.0',stage:'development-host-candidate',physicalAcceptance:false,source:{commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())},host:{platform:platform(),arch:arch(),kernel:release(),cpu:cpus()[0]?.model,node:process.version,chromium:browser.version()},profile:{codec:'VP8',syntheticCanvas:true,width:320,height:240,framesPerSecond:5,maxBitratePerSenderBps:96000,viewers:2},path:'localhost-host-candidates',signaling:'in-process-test-harness-only',authorization:'not-tested',sharedUpstream:false,elapsedMs,resources:{boundary:'sampled-chromium-process-tree',completeness:'sampled-process-exit-gaps-possible',observedReadGaps:gaps+last.gaps,cpuSeconds:last.ticks>=first.ticks?(last.ticks-first.ticks)/hz:null,peakSumProcessRssBytes:peakRss,sharedPagesMayBeCountedRepeatedly:true,temperature:null},paths,relayOnlyWithoutProvider,oneViewerClosePreservesOther:true,bytes:{boundary:'browser-rtp-payload',completeness:'partial',signalingOverhead:null,udpIpOverhead:null,stunTurnOverhead:null,wan:null,carrier:null},untested:['Pi-3A+','physical-camera','still-capture-contention','mobile-NAT','TURN-relay','packet-loss-injection','end-to-end-frame-latency','current-site-authorization','field-operation'],productionSelection:null})}\n`);
}finally{await context?.close();await browser?.close();await launcher?.close();await new Promise(resolve=>server.close(resolve));clearTimeout(deadline);}
