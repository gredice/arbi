import { isDeepStrictEqual } from 'node:util';
import { correlateAuditEvent, validateAuditEvent } from './audit.js';
import { recoverUpdate } from './update.js';
import { fail, type Result } from './validate.js';
import type { AuditEvent, AuditSource } from './audit-types.js';
import type { SourceTime } from './messages.js';

/** Instrument a trusted, already-admitted journal. This creates evidence, never update authority.
 * Producers still commit the event with their own journal and bind it at the receiving audit boundary. */
export function updateIntentAudit(journal: unknown, source: AuditSource, sourceTime: SourceTime, sequence: string, sessionId: string | null = null): Result<AuditEvent> {
  const parsed = recoverUpdate(journal);
  if(!parsed.ok) return fail('INVALID_MESSAGE');
  const r = parsed.value.journal.request;
  if(!isDeepStrictEqual(source.identity,r.source) || !['cloud','edge'].includes(source.module)) return fail('SOURCE_MISMATCH');
  const id = r.auditContext.intentEventId;
  return validateAuditEvent({ auditVersion: 'arbi.audit/1.0',eventId: id,realm: r.scope.realm,executionMode: r.scope.executionMode,
    siteId: r.scope.siteId,actor: r.auditContext.actor,source,sourceTime,sequence,ingestTime: null,
    resource: { kind: 'update',id: r.operationId,deviceId: r.manifest.target.moduleId },
    action: 'update.request',evidence: 'intent',outcome: 'requested',effect: 'none',reason: 'requested',
    links: { correlationId: r.auditContext.correlationId,intentEventId: id,causationEventId: null,
      jobId: r.operationId,sessionId,commandId: r.operationId,requestSource: r.source,target: null },
    record: null,metadata: { permission: 'update',releaseId: r.manifest.releaseId,authorizationId:r.auditContext.authorizationId },
    change: { fields: ['release-selection'],before: { revisionId: r.expectedInstalledReleaseId,state: 'installed' },
      after: { revisionId: r.manifest.releaseId,state: 'staged' } } });
}
/** A local boot observation establishes installation/rollback; a response or staging receipt cannot. */
export function updateOutcomeAudit(intent: AuditEvent,journal: unknown,eventId: string,source: AuditSource,
  sourceTime: SourceTime,sequence: string): Result<AuditEvent> {
  const parsed = recoverUpdate(journal);
  if(!parsed.ok) return fail('INVALID_MESSAGE');
  const j = parsed.value.journal,r = j.request,e = j.events.find(event=>event.eventId === eventId);
  const expected = updateIntentAudit(j,intent.source,intent.sourceTime,intent.sequence,intent.links.sessionId);
  if(!expected.ok || !isDeepStrictEqual(intent,expected.value)) return fail('NOT_AUTHORIZED');
  if(!e || !['confirmed','rolled-back','failed','recovery-required'].includes(e.kind)) return fail('UNSUPPORTED_CAPABILITY');
  if(!isDeepStrictEqual(source.identity,e.source) || !['edge','motion','pod'].includes(source.module)) return fail('SOURCE_MISMATCH');
  const observed = e.kind === 'confirmed' || e.kind === 'rolled-back';
  if(observed && (!e.boot || !isDeepStrictEqual(e.boot.source,source.identity))) return fail('TARGET_MISMATCH');
  const afterInstall = j.events.slice(0,j.events.indexOf(e)+1).some(event=>event.kind === 'installation-reserved');
  const unknown = !observed && afterInstall;
  const result: AuditEvent = { ...structuredClone(intent),eventId: e.eventId,source,sourceTime,sequence,
    action: e.kind === 'rolled-back' || r.direction === 'rollback' ? 'update.rollback' : 'update.install',
    evidence: observed ? 'device-outcome' : unknown ? 'connection-loss' : 'service-outcome',
    outcome: observed ? 'succeeded' : unknown ? 'interrupted' : 'fail',
    effect: observed ? 'device-reported' : unknown ? 'unknown' : 'none',
    reason: observed ? 'completed' : unknown ? 'response-lost' : 'execution-failed',
    links: { ...intent.links,causationEventId: intent.eventId,target: observed ? e.source : afterInstall ? j.baseline.source : null },
    record: observed ? { kind: 'local-record',id: e.boot!.recordId } : null,
    metadata: { ...intent.metadata,...(e.kind === 'rolled-back' ? { recoveryPolicy: 'update-recovery/1' as const } : {}) },
    change: { fields: ['release-selection'],before: { revisionId: r.expectedInstalledReleaseId,state: 'installed' },
      after: { revisionId: observed ? e.boot!.releaseId : r.manifest.releaseId,
        state: e.kind === 'rolled-back' || observed && r.direction === 'rollback' ? 'rolled-back' : observed ? 'installed' : 'failed' } } };
  return correlateAuditEvent(intent,result);
}
