import { isId, isRealm } from '@arbi/gredice';
import type { Realm } from '@arbi/protocol';
export const OPERATIONS_VERSION='arbi.operations/1.0';
export class OperationsError extends Error{constructor(readonly code:'INVALID_CONFIGURATION'|'DENIED'|'UNAVAILABLE'|'CAPACITY'|'TAMPER'){super(code);this.name='OperationsError';}}
export const SERVICES=['database','broker','objects'] as const;
export type Service=typeof SERVICES[number];
export type ProbeStatus='ready'|'degraded'|'unavailable'|'unconfigured';
export interface PrivateOperationsConfig {realm:Realm;databaseUrl:string;databaseRole:string;deployment:'protected-main'|'isolated-test';signingKey:Uint8Array;browserOrigins:readonly string[]}
/** Validates private input but exposes only fixed errors, never rejected values or URLs. */
export function operationsConfig(input:PrivateOperationsConfig):PrivateOperationsConfig{
  try{
    if(!isRealm(input.realm)||!isId(input.databaseRole)||!(input.signingKey instanceof Uint8Array)||input.signingKey.length<32||input.signingKey.length>128||!input.browserOrigins.length||input.browserOrigins.length>8)throw Error();
    if(!['protected-main','isolated-test'].includes(input.deployment)||input.realm.environment==='production'&&input.deployment!=='protected-main')throw Error();
    const database=new URL(input.databaseUrl);if(!['postgres:','postgresql:'].includes(database.protocol)||!database.pathname||database.pathname==='/')throw Error();
    const local=['localhost','127.0.0.1','[::1]'].includes(database.hostname);
    if(input.deployment==='isolated-test'&&(input.realm.environment!=='test'||!local)||!local&&database.searchParams.get('sslmode')!=='verify-full')throw Error();
    for(const origin of input.browserOrigins){const url=new URL(origin);if(url.origin!==origin||url.protocol!=='https:'&&!(input.realm.environment!=='production'&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error();}
    return {...input,realm:{...input.realm},signingKey:new Uint8Array(input.signingKey),browserOrigins:[...input.browserOrigins]};
  }catch{throw new OperationsError('INVALID_CONFIGURATION');}
}
