import type {AuditAction,AuditEvent} from '@arbi/protocol';
import type {Capability} from '@arbi/gredice';
import {MediaError} from './contracts';
const hooks={
  start:{capability:'recording.create',reservedAction:'recording.start'},
  stop:{capability:'recording.create',reservedAction:'recording.stop'},
  failure:{capability:'recording.create',reservedAction:'recording.fail'},
  playback:{capability:'recording.read',reservedAction:'playback.view'},
  export:{capability:'recording.export',reservedAction:'media.export'},
  delete:{capability:'recording.delete',reservedAction:'recording.delete'},
} satisfies Record<string,{capability:Capability;reservedAction:AuditAction}>;
/** Composition hook only: audit 1.0 can record a disabled denial, never recording success or delivery. */
export function recordingAuditHook(operation:unknown):{enabled:false;capability:Capability;reservedAction:AuditAction;denial:Pick<AuditEvent,'action'|'evidence'|'outcome'|'reason'|'effect'|'metadata'>}{
  if(typeof operation!=='string'||!Object.hasOwn(hooks,operation))throw new MediaError('INVALID_REQUEST');
  return {enabled:false,...hooks[operation as keyof typeof hooks],denial:{action:'authorization.check',evidence:'authorization',outcome:'deny',reason:'disabled',effect:'none',metadata:{permission:'recording'}}};
}
