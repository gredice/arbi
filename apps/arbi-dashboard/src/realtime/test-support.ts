import { generateKeyPairSync, sign } from 'node:crypto';
import { fixture as jobsFixture,realm } from '../jobs/test-support';
import { proofBytes } from '../enrollment/crypto';
import type { Broker, Grant, Notification } from './contracts';
import { VERSION } from './contracts';
export { realm };
export async function fixture() {
  const f=await jobsFixture();const keys=generateKeyPairSync('ed25519');
  f.registry.devices[0].credentials[0].publicKey=keys.publicKey.export({format:'der',type:'spki'}).toString('base64url');
  const signed=(action: string,payload: unknown,version=VERSION) => {
    const unsigned={version,realm,siteId:f.registry.siteId,deviceId:'edge-1',credentialId:'credential-1',identity:f.registry.devices[0].current,
      issuedAtMs:Date.now(),expiresAtMs:Date.now()+10000,action,payload};
    return {...unsigned,signature:sign(null,proofBytes(unsigned),keys.privateKey).toString('base64url')};
  };
  const published: {channel:string;notification:Notification}[]=[];const revoked: string[]=[];
  const controls={failIssue:false,failPublish:false,failRevoke:false};
  const broker: Broker={
    async issue(grant:Grant,ttlMs:number) {
      if(controls.failIssue) throw new Error('ISOLATED_BROKER_FAILURE');
      return {token:'isolated-no-provider-authority',issued:Date.now(),expires:Date.now()+ttlMs,clientId:grant.clientId,capability:JSON.stringify({[grant.channel]:['subscribe']})};
    },
    async publish(channel,notification) {if(controls.failPublish) throw new Error();published.push({channel,notification});},
    async revoke(clientId) {if(controls.failRevoke) throw new Error();revoked.push(clientId);}
  };
  return {...f,keys,signed,broker,controls,published,revoked};
}
