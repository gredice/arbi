import type { DashboardContext } from './contracts';
/** Replaced by Next at build time. Never infer a deployed web revision from a device's manifest. */
export function webDeploymentIdentity():NonNullable<DashboardContext['webDeployment']>{
  try{const x=JSON.parse(process.env.ARBI_WEB_BUILD_IDENTITY??'null');if(x&&x.provenance==='web-build-manifest'&&(x.revision===null||typeof x.revision==='string'&&/^[a-f0-9]{40}$/.test(x.revision))&&(x.dirty===null||typeof x.dirty==='boolean')&&typeof x.builtAt==='string'&&!Number.isNaN(Date.parse(x.builtAt))&&['local','preview','production'].includes(x.environment))return {revision:x.revision,dirty:x.dirty,builtAt:x.builtAt,environment:x.environment,provenance:'web-build-manifest'};}catch{}
  return {revision:null,dirty:null,builtAt:null,environment:'unknown',provenance:'web-build-manifest'};
}
