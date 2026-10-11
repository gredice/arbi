// Test-only crash fixture. Every credential and preflight is synthetic.
import { createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SignedPicoFlashModel,updateTransferMac } from './flash-model.mjs';
const {root,configuration,manifest,publicKey}=JSON.parse(readFileSync(process.argv[2],'utf8'));
const transferKey=Buffer.alloc(32,0x71),peer={deviceId:'edge',bootId:'edge-boot-1',sessionId:'edge-session-1'};
const model=new SignedPicoFlashModel({root,moduleId:'pico',configuration,dataVersion:'1.0.0',trust:{keyId:'synthetic-test-key',publicKey:createPublicKey({key:Buffer.from(publicKey,'base64'),format:'der',type:'spki'})},transferKey,peer,peers:{edge:'1.1.0'},now:()=>0});
const {configurationDigest}=await import('@arbi/protocol');
const request={version:'arbi.synthetic-pico-transfer/1.0',action:'activate',commandId:'synthetic-child-trial',correlationId:'synthetic-child-chain',source:peer,target:model.identity,sequence:'1',expiresMonotonicMs:1000,manifestDigest:configurationDigest(manifest),preflight:{origin:'simulated',fixtureRecord:'synthetic-restraint-71',controllerPhase:'inhibited',manualAuthority:false,isolatedOutputs:true}};
const status=model.activate({request,mac:updateTransferMac(request,transferKey)});
process.stdout.write(JSON.stringify({phase:status.phase,bootId:status.identity.bootId})+'\n');process.stdin.resume();
