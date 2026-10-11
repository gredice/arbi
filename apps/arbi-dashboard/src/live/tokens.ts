import {SignJWT,jwtVerify} from 'jose';
import {isDeepStrictEqual} from 'node:util';
import {JobError} from '../jobs/contracts';
import type {Realm} from '@arbi/protocol';
import {LIVE_VERSION,type LiveViewer} from './contracts';
export class LiveTokens{
  readonly #key:Uint8Array;readonly #issuer:string;
  constructor(realm:Realm,key:Uint8Array){if(realm.environment!=='test'||key.length<32||key.length>128)throw new JobError('DENIED');this.#key=new Uint8Array(key);this.#issuer=`urn:arbi:live:${realm.namespaceId}`;}
  #claims(viewer:LiveViewer){return {version:LIVE_VERSION,realm:viewer.authority.realm,siteId:viewer.authority.siteId,producerId:viewer.producerId,target:viewer.target,
    configRevision:viewer.configRevision,profileId:viewer.profile.id,viewerId:viewer.id,actorId:viewer.authority.actor.id,humanSessionId:viewer.authority.sessionId,epoch:viewer.epoch};}
  async issue(viewer:LiveViewer){if(viewer.endedAtMs!==null||viewer.expiresAtMs<=Date.now())throw new JobError('EXPIRED');
    return new SignJWT(this.#claims(viewer)).setProtectedHeader({alg:'HS256',typ:'arbi-live+jwt'}).setIssuer(this.#issuer).setAudience('arbi-live-signaling')
      .setJti(viewer.id).setIssuedAt(Math.floor(viewer.createdAtMs/1000)).setExpirationTime(Math.floor(viewer.expiresAtMs/1000)).sign(this.#key);}
  async check(token:unknown,viewer:LiveViewer){
    if(typeof token!=='string'||token.length>4096||viewer.endedAtMs!==null||viewer.expiresAtMs<=Date.now())throw new JobError('EXPIRED');
    try{const {payload,protectedHeader}=await jwtVerify(token,this.#key,{algorithms:['HS256'],issuer:this.#issuer,audience:'arbi-live-signaling'});
      const {iss,aud,jti,iat,exp,...claims}=payload;
      if(protectedHeader.typ!=='arbi-live+jwt'||jti!==viewer.id||iat!==Math.floor(viewer.createdAtMs/1000)||exp!==Math.floor(viewer.expiresAtMs/1000)||
        !isDeepStrictEqual(claims,this.#claims(viewer)))throw Error('DENIED');
    }catch{throw new JobError('DENIED');}
  }
}
