import {isId} from '@arbi/gredice';
import {exact,JobError} from '../jobs/contracts';
import {readJsonBody} from '../enrollment/http';
import {jobFailure} from '../jobs/http';
import type {LiveHttp} from '../live/http';
/** Cookie BFF delegates authority/lifecycle to the existing live service. */
export class LiveDashboardTools{
  constructor(readonly live:LiveHttp,readonly metered:boolean|null){}
  async handle(request:Request,siteId:string,action:string):Promise<Response>{
    const headers={'cache-control':'private, no-store'};
    if(!isId(siteId)||request.method!=='POST'||new URL(request.url).search||!['inventory','start','state','renew','end','signal','revoke'].includes(action))return jobFailure(new JobError('INVALID_REQUEST'));
    if(action==='inventory')return this.live.humans.run(request,{siteId,surface:'media',capability:'live.view'},async context=>{
      try{exact(await readJsonBody(request,1024),[]);return await this.live.store.jobs.transaction(siteId,async tx=>{
        await this.live.store.jobs.authority(tx,context);
        const devices=tx.registry.devices.filter(d=>d.status==='active'&&d.revokedAtMs===null&&d.current&&d.appliedConfigRevision===tx.registry.configRevision&&this.live.store.approveDevice(tx.registry,d)).map(d=>({id:d.id}));
        return Response.json({version:'arbi.live-dashboard/1.0',realm:context.realm,siteId,humanSessionId:context.sessionId,devices,profiles:this.live.store.profiles,metered:this.metered,transport:'isolated-signaling',physicalMediaEnabled:false,recordingEnabled:false},{headers});
      });}catch(error){return jobFailure(error);}
    });
    const response=await this.live.handle(request,{siteId,action});if(!response.ok||action==='signal'||action==='revoke')return response;
    const view=await response.json();
    return this.live.humans.run(request,{siteId,surface:'media',capability:action==='revoke'?'configuration.write':'live.view'},async context=>{
      try{return await this.live.store.jobs.transaction(siteId,async tx=>{
        await this.live.store.jobs.authority(tx,context);let viewerBytes:string|null=null,upstreamBytes:string|null=null;
        if(view.delivery){const rows=(await tx.sql.query<{observation_id:string;record:{bytes:string|null;media:{viewerId:string|null}|null}}>(
          'SELECT observation_id,record FROM arbi_usage_windows WHERE environment=$1 AND namespace_id=$2 AND site_id=$3 AND observation_id=ANY($4::text[])',
          [context.realm.environment,context.realm.namespaceId,siteId,[view.delivery.viewerUsageId,view.delivery.upstreamUsageId].filter(Boolean)])).rows;
          for(const row of rows){if(row.observation_id===view.delivery.viewerUsageId&&row.record.media?.viewerId===view.id)viewerBytes=row.record.bytes;
            if(row.observation_id===view.delivery.upstreamUsageId&&row.record.media?.viewerId===null)upstreamBytes=row.record.bytes;}
        }
        return Response.json({...view,realm:context.realm,siteId,humanSessionId:context.sessionId,measured:{viewerBytes,upstreamBytes,layer:'application-payload',coverage:view.delivery?'partial':'unknown'}},{status:response.status,headers});
      });}catch(error){return jobFailure(error);}
    });
  }
}
