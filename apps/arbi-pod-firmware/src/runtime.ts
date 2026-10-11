import { randomUUID,createHash } from 'node:crypto';
import { createServer as httpServer,type Server as HTTPServer } from 'node:http';
import { createServer as tlsServer,type Server as TLSServer,type TLSSocket } from 'node:tls';
import { performance } from 'node:perf_hooks';
import { PROTOCOL_VERSION,admitCommand,configurationCapabilities,configurationDigest,createCommandLedger,parseMessage,
  type Command,type Event,type Identity } from '@arbi/protocol';
import { FrameDecoder,frame,TRANSPORT_VERSION } from '@arbi/protocol/local';
import { SqliteAuditSpool } from '@arbi/audit';
import { ApplicationMeter,TrafficSpool,stamp } from '@arbi/traffic';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BoundedLogs,readBounded,type LogCode } from './bounded.js';
import { collectHealth,linuxHealthIO,type HealthIO,type HealthSample } from './health.js';
import { unavailableAdapters,type CameraAdapter,type GimbalAdapter } from './adapters.js';
import { validatePodSettings,type PodSettings } from './settings.js';
import { DiagnosticBuffer } from './diagnostic-buffer.js';
import { CaptureTransfer } from './capture-transfer.js';
import { PodCursorRecovery } from './cursor-recovery.js';
const validId=(v:unknown):v is string=>typeof v==='string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(v);
const same=(a:unknown,b:unknown)=>configurationDigest(a)===configurationDigest(b);
export class PodRuntime {
  readonly source:Identity=Object.freeze({deviceId:'pod',bootId:randomUUID(),sessionId:randomUUID()});
  readonly logs:BoundedLogs;
  #settings:PodSettings|null;#camera:CameraAdapter;#gimbal:GimbalAdapter;#io:HealthIO;#now:()=>number;
  #cameraStatus:{ready:boolean;origin:'simulated'|'unavailable'}={ready:false,origin:'unavailable'};
  #health:Record<string,HealthSample>={};#polling=false;#poll?:NodeJS.Timeout;
  #http?:HTTPServer;#tls?:TLSServer;#peer?:TLSSocket;#audit?:SqliteAuditSpool;#usage?:TrafficSpool;#meter?:ApplicationMeter;
  #buffer?:DiagnosticBuffer;#diagnostics=0;#stopped=false;#started=false;#lastFailure=-Infinity;#suppressed=0;
  #osBootId:string|null=null;
  #captureTransfer:CaptureTransfer|null=null;#recovery:PodCursorRecovery|null=null;
  #build:{version:string;sha:string;dirty:boolean}={version:'0.1.0',sha:'unknown',dirty:true};
  constructor(settings:PodSettings|null,adapters=unavailableAdapters(),io?:HealthIO,now=()=>Math.floor(performance.now())) {
    this.#settings=settings===null?null:validatePodSettings(settings);this.#camera=adapters.camera;this.#gimbal=adapters.gimbal;
    this.#io=io??linuxHealthIO(settings?.storageDirectory??'/tmp');this.#now=now;this.logs=new BoundedLogs(this.source.bootId,now);
    try{const id=readBounded('/proc/sys/kernel/random/boot_id',128).toString('utf8').trim();if(/^[a-f0-9-]{36}$/u.test(id))this.#osBootId=id;}catch{}
    try{const b=JSON.parse(readBounded(fileURLToPath(new URL('./build-identity.json',import.meta.url)),256).toString('utf8'));if(b.version==='0.1.0' && (b.sha==='unknown'||/^[a-f0-9]{40}$/u.test(b.sha)) && typeof b.dirty==='boolean')this.#build=b;}catch{}
  }
  get status() {
    const c=this.#settings?.applied.request.configuration;
    const storageReady=Boolean(this.#audit && this.#usage && this.#buffer && !this.#buffer.status().degraded && !this.#audit.status().degraded && !this.#usage.status().degraded);
    const ready=Boolean(c && this.#cameraStatus.ready && this.#cameraStatus.origin==='simulated' && storageReady && !this.#stopped);
    return {schemaVersion:'arbi.pod-health/1.0',source:this.source,osBootId:this.#osBootId,resetReason:{value:null,quality:'unavailable',reason:'no-reset-cause-adapter'},
      runtime:{node:process.version,platform:process.platform,architecture:process.arch},firmware:{...this.#build},declaredHardware:{model:'Raspberry Pi 3A+',revision:null,verified:false},
      resources:{rssBytes:process.memoryUsage().rss,cpuMicroseconds:process.cpuUsage(),sampleMonotonicMs:this.#now(),source:'node-process-os-report'},
      configurationDigest:c?this.#settings!.acceptedConfigurationDigest:null,configurationRevision:c?.revision??null,
      ready,reason:!c?'CONFIG_MISSING':!this.#cameraStatus.ready?'CAMERA_UNAVAILABLE':!storageReady?'STORAGE_UNAVAILABLE':this.#stopped?'SHUTDOWN':'READY',
      state:ready?'Ready':'Fault',actuationInhibited:true,physicalAcceptance:false,camera:{...this.#cameraStatus,captureEnabled:false},
      supportedCommands:['state.resync'],health:structuredClone(this.#health),diagnosticRequests:this.#diagnostics,
      logs:{buffered:this.logs.snapshot().records.length,dropped:this.logs.snapshot().dropped,suppressed:this.#suppressed},
      captureTransfer:this.#captureTransfer?.status??{state:'not-configured',wanBytes:null,physicalWiFiMeasured:false},recovery:this.#recovery?.status()??{state:'not-configured',cloudCommitted:false},
      diagnosticBuffer:this.#buffer?.status()??{degraded:true,buffered:null},audit:this.#audit?.status()??{degraded:true,pending:null},usage:{boundary:'lan',layer:'application',coverage:'partial',collectionPoint:'pod-local-tls-plaintext-frames',
        wanBytes:null,carrierBytes:null,healthHTTPBytes:null,spool:this.#usage?.status()??{degraded:true,pending:null}}};
  }
  #failure(code:LogCode,connectionId:string|null=null):void {
    if(this.#now()-this.#lastFailure<1000){this.#suppressed=Math.min(2147483647,this.#suppressed+1);return;}
    this.#lastFailure=this.#now();this.logs.record(code,connectionId);
  }
  async #refresh():Promise<void>{
    if(this.#polling || this.#stopped)return;this.#polling=true;
    try{this.#health=await collectHealth(this.#io,this.#now);}finally{this.#polling=false;}
  }
  async start(unconfiguredHealthPort=0):Promise<{healthPort:number;modulePort:number|null}> {
    if(!Number.isInteger(unconfiguredHealthPort)||unconfiguredHealthPort<0||unconfiguredHealthPort>65535)throw new Error('INVALID_PORT');
    if(this.#started || this.#stopped)throw new Error('INVALID_LIFECYCLE');this.#started=true;this.#gimbal.inhibit();this.logs.record('STARTING');
    try {
      if(this.#settings) {
        const s=this.#settings,c=s.applied.request.configuration;
        try {
          this.#audit=new SqliteAuditSpool({path:join(s.storageDirectory,'pod-audit.sqlite'),realm:c.realm,siteId:c.siteId,executionMode:'simulation',
            source:{module:'pod',identity:this.source},maxEvents:256,maxBytes:1048576,maxPages:512});
          this.#usage=new TrafficSpool({path:join(s.storageDirectory,'pod-usage.sqlite'),binding:{realm:c.realm,siteId:c.siteId,executionMode:'simulation',deviceId:'pod'},
            maxRecords:512,maxBytes:1048576,maxPages:512,maxCounters:1});this.#meter=new ApplicationMeter(this.#usage,()=>stamp(this.source.bootId));
          this.#buffer=new DiagnosticBuffer(join(s.storageDirectory,'pod-diagnostics.sqlite'));
        } catch {this.#audit?.close();this.#usage?.close();this.#buffer?.close();this.#audit=undefined;this.#usage=undefined;this.#buffer=undefined;this.#failure('STORAGE_UNAVAILABLE');}
        let cameraTimer:NodeJS.Timeout|undefined;
        try{const result=await Promise.race([this.#camera.initialize(),new Promise<never>((_,reject)=>{cameraTimer=setTimeout(()=>reject(new Error('CAMERA_TIMEOUT')),1000);})]);this.#cameraStatus=result.ready && result.origin==='simulated'?{ready:true,origin:'simulated'}:{ready:false,origin:'unavailable'};}catch{this.#cameraStatus={ready:false,origin:'unavailable'};}finally{clearTimeout(cameraTimer);}
        if(this.#stopped)throw new Error('STARTUP_CANCELLED');
        this.#tls=tlsServer({ca:readBounded(s.tls.caFile,16384),cert:readBounded(s.tls.certFile,16384),key:readBounded(s.tls.keyFile,16384),
          requestCert:true,rejectUnauthorized:true,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ALPNProtocols:[TRANSPORT_VERSION],handshakeTimeout:1500},socket=>this.#connected(socket));
        this.#tls.maxConnections=2;this.#tls.on('tlsClientError',()=>this.#failure('AUTHENTICATION_FAILED'));
        await this.#listen(this.#tls,s.modulePort);
      }
      await this.#refresh();this.#poll=setInterval(()=>void this.#refresh(),1000);
      if(this.#stopped){clearInterval(this.#poll);throw new Error('STARTUP_CANCELLED');}
      const h=httpServer({maxHeaderSize:4096,requestTimeout:2000,headersTimeout:2000},(request,response)=>{
        response.setHeader('Cache-Control','no-store');response.setHeader('Content-Type','application/json');
        if(request.method!=='GET'||request.url!=='/health'){response.writeHead(404);response.end('{"error":"NOT_FOUND"}');return;}
        response.writeHead(this.status.ready?200:503);response.end(JSON.stringify(this.status));
      });h.maxConnections=8;h.keepAliveTimeout=1000;this.#http=h;await this.#listen(h,this.#settings?.healthPort??unconfiguredHealthPort);
      this.logs.record(this.status.reason as LogCode);
      return {healthPort:(h.address() as {port:number}).port,modulePort:this.#tls?(this.#tls.address() as {port:number}).port:null};
    } catch {await this.stop();throw new Error('STARTUP_FAILED');}
  }
  #listen(server:HTTPServer|TLSServer,port:number):Promise<void>{return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.off('error',reject);
    if(this.#stopped){server.close(()=>reject(new Error('STARTUP_CANCELLED')));return;}resolve();});});}
  #connected(socket:TLSSocket):void {
    const s=this.#settings!,raw=socket.getPeerCertificate().raw;
    if(this.#peer || !socket.authorized || socket.alpnProtocol!==TRANSPORT_VERSION || !raw || createHash('sha256').update(raw).digest('hex')!==s.tls.edgeCertificateSha256){this.#failure('AUTHENTICATION_FAILED');socket.destroy();return;}
    this.#peer=socket;const source:Identity={deviceId:'pod',bootId:this.source.bootId,sessionId:randomUUID()};const connectionId=source.sessionId;
    const decoder=new FrameDecoder(),ledger=createCommandLedger(128),c=s.applied.request.configuration;
    let discovered=false,edge:Identity|null=null,sequence=0n,last=this.#now(),rateStart=this.#now(),rate=0,frameStart:number|null=null,lastByte=this.#now();
    const usage=(direction:'upload'|'download',category:'reconnect'|'telemetry'|'unknown')=>({scope:{realm:c.realm,siteId:c.siteId,executionMode:'simulation' as const,source,boundary:'lan' as const,linkId:'pod-edge-loopback'},direction,category,includes:['payload','retries'] as ('payload'|'retries')[],maxAgeMs:60000,retryOf:null,media:null});
    const send=(input:unknown,category:'reconnect'|'telemetry')=>{
      const bytes=frame(input);if(socket.destroyed || socket.writableLength+bytes.length>32768){socket.destroy();return;}
      if(this.#meter)this.#meter.submit(usage('upload',category),bytes,done=>{socket.write(bytes,done);});else socket.write(bytes);
    };
    const snapshot=()=>{
      if(!discovered || socket.destroyed)return;
      const next=String(++sequence);
      const e:Event={protocol:PROTOCOL_VERSION,messageId:randomUUID(),realm:c.realm,siteId:c.siteId,executionMode:'simulation',source,sequence:next,
        sourceTime:{utc:null,uncertaintyMs:null,monotonicMs:this.#now()},ingestTime:null,kind:'event',body:{type:'state.snapshot',state:this.status.ready?'Ready':'Fault',
          configRevision:c.revision,capabilitiesRevision:c.revision,capabilities:configurationCapabilities(c,'pod'),eventCursor:{source,sequence:next,stream:'event'},
          telemetryCursor:null,committedCursor:null,supportedCommands:['state.resync'],supportedProtocols:[PROTOCOL_VERSION]}};send(e,'telemetry');
    };
    const timer=setInterval(()=>{
      if((!discovered && this.#now()-last>=1500) || (decoder.incomplete && (this.#now()-lastByte>=250 || this.#now()-(frameStart??lastByte)>=1000))){this.#failure('LINK_EXPIRED',connectionId);socket.destroy();return;}
      snapshot();
    },250);
    socket.on('data',(bytes:Buffer)=>{
      if(!decoder.incomplete)frameStart=this.#now();lastByte=this.#now();
      this.#meter?.observe(usage('download','unknown'),bytes);
      try{decoder.push(bytes,input=>{
        if(socket.destroyed)throw new Error('CLOSED');const now=this.#now();if(now-rateStart>=1000){rateStart=now;rate=0;}if(++rate>32)throw new Error('RATE_LIMIT');
        if(!discovered) {
          const d=input as Record<string,unknown>,candidate=d?.source as Identity;
          if(!d || Array.isArray(d) || Object.keys(d).length!==9 || d.transport!==TRANSPORT_VERSION || d.kind!=='discover' || d.protocol!==PROTOCOL_VERSION
            || !validId(d.challenge) || d.executionMode!=='simulation' || !same(d.realm,c.realm) || d.siteId!==c.siteId || d.configurationDigest!==s.acceptedConfigurationDigest
            || !candidate || Object.keys(candidate).length!==3 || candidate.deviceId!=='edge' || !validId(candidate.bootId) || !validId(candidate.sessionId))throw new Error('INVALID_DISCOVERY');
          edge=structuredClone(candidate);discovered=true;
          send({transport:TRANSPORT_VERSION,kind:'hello',challenge:d.challenge,source,role:'pod',realm:c.realm,siteId:c.siteId,executionMode:'simulation',
            configurationDigest:s.acceptedConfigurationDigest,protocols:[PROTOCOL_VERSION]},'reconnect');snapshot();
        } else {
          const m=parseMessage(JSON.stringify(input));if(!m.ok || m.value.kind!=='command')throw new Error('INVALID_COMMAND');
          const admitted=admitCommand(m.value,{realm:c.realm,siteId:c.siteId,executionMode:'simulation',authenticatedSource:edge!,receiver:source,nowMonotonicMs:now,
            maxDeadlineAheadMs:1000,authorizedActor:{kind:'service',id:'simulation-diagnostics'},allowedTypes:['state.resync'],supportedTypes:['state.resync'],configRevision:c.revision,faultInhibited:true,lease:null},ledger);
          if(!admitted.ok){this.#recordDecision(m.value,false,connectionId);throw new Error('COMMAND_REJECTED');}
          if(admitted.value.decision==='accepted'){if(!this.status.ready || !this.#recordDecision(m.value,true,connectionId))throw new Error('NOT_READY');this.#diagnostics++;snapshot();}
        }
        last=now;
      });if(!decoder.incomplete)frameStart=null;}catch{this.#failure('PEER_REJECTED',connectionId);socket.destroy();}
    });
    socket.on('error',()=>{});socket.on('close',()=>{clearInterval(timer);if(this.#peer===socket)this.#peer=undefined;this.#gimbal.inhibit();this.#failure('DISCONNECTED',connectionId);});
  }
  #recordDecision(m:Command,allowed:boolean,connectionId:string):boolean {
    this.logs.record(allowed?'DIAGNOSTIC_ACCEPTED':'COMMAND_REJECTED',connectionId,m.command.correlationId);
    const row=this.logs.snapshot().records.at(-1)!;
    if(this.#buffer?.append(row))return true;this.#failure('STORAGE_UNAVAILABLE');return false;
  }
  pendingAudit(){return this.#audit?.pendingBounded()??[];}
  pendingDiagnostics(){return this.#buffer?.pending()??[];}
  pendingUsage(){return this.#usage?.pending(8)??[];}
  connectCaptureTransfer(transfer:CaptureTransfer):void {
    const c=this.#settings?.applied.request.configuration;if(this.#stopped||this.#captureTransfer||!c||!same(transfer.options.source,this.source)||transfer.options.store.bindingDigest!==configurationDigest({realm:c.realm,siteId:c.siteId,deviceId:'pod'}))throw new Error('CAPTURE_TRANSFER_BINDING');this.#captureTransfer=transfer;
  }
  connectRecovery(options:Omit<ConstructorParameters<typeof PodCursorRecovery>[0],'source'|'audit'|'usage'|'diagnostics'>):PodCursorRecovery {
    if(this.#stopped||this.#recovery||!this.#audit||!this.#usage||!this.#buffer)throw new Error('RECOVERY_NOT_READY');this.#recovery=new PodCursorRecovery({...options,source:this.source,audit:this.#audit,usage:this.#usage,diagnostics:this.#buffer});return this.#recovery;
  }
  async stop():Promise<void> {
    if(this.#stopped)return;this.#stopped=true;clearInterval(this.#poll);this.#gimbal.inhibit();this.#peer?.destroy();
    await Promise.all([this.#captureTransfer?.stopAndDrain(),this.#recovery?.stopAndDrain()]);
    await Promise.all([this.#http,this.#tls].map(server=>server?.listening?new Promise<void>(resolve=>server.close(()=>resolve())):Promise.resolve()));
    try{await this.#camera.shutdown();}finally{this.#audit?.close();this.#usage?.close();this.#buffer?.close();this.logs.record('SHUTDOWN');}
  }
}
