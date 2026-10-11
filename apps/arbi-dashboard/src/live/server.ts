import type {GrediceIdentityAdapter,ResourceResolver} from '@arbi/gredice';
import type {SqlDatabase} from '../enrollment/store';
import type {Realm} from '@arbi/protocol';
import {createJobsServer} from '../jobs/server';
import type {CurrentAuthority} from '../jobs/contracts';
import type {LiveAdapter,LivePolicyEvaluator,LiveProfile,MediaDeviceApproval} from './contracts';
import {LiveStore} from './store';
import {LiveHttp} from './http';
/** Explicit isolated composition. No selected hardware transport, fixture authority or secret is a runtime default. */
export function createLiveServer(config:{db:SqlDatabase;realm:Realm;identity:GrediceIdentityAdapter;resolveSite:ResourceResolver;currentAuthority:CurrentAuthority;
  browserOrigins:readonly string[];adapter:LiveAdapter;tokenKey:Uint8Array;profiles:readonly LiveProfile[];approveDevice:MediaDeviceApproval;evaluatePolicy:LivePolicyEvaluator}){
  const jobs=createJobsServer(config);return new LiveHttp(new LiveStore(jobs.store,config.adapter,config.tokenKey,config.profiles,config.approveDevice,config.evaluatePolicy),jobs.humans);
}
