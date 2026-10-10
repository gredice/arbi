import type { LocalAuthority, JobAdapter } from './types.js';
import type { Identity } from '@arbi/protocol';
import type { Settings } from '../settings.js';
import { JobJournal } from './journal.js';
import { JobAuditRelay } from './audit-relay.js';
import { LocalJobConsumer } from './orchestrator.js';

/** Optional storage integration. Enrollment and diagnostic TLS never supply job authority. */
export class EdgeJobs {
  #journal?: JobJournal;
  #relay?: JobAuditRelay;
  #consumer?: LocalJobConsumer;
  #enabled: boolean;
  #degraded = false;
  #commissioning?: LocalAuthority['commissioning'];
  constructor(settings: Settings, identity: Identity) {
    const options = settings.jobs; this.#enabled = !!options;
    if (!options) return;
    const config = settings.applied.request.configuration;
    try {
      this.#journal = new JobJournal({ path: options.journalFile, realm: config.realm, siteId: config.siteId, deviceId: identity.deviceId,
        maxJobs: options.maxJobs, maxBytes: options.maxBytes, maxPages: options.maxPages, minFreeBytes: options.minFreeBytes });
      this.#relay = new JobAuditRelay(options.auditDirectory);
      this.#journal.recover(); this.#journal.latch(); this.#journal.flushAudit(this.#relay.spool);
    } catch { this.#degraded = true; }
  }
  compose(adapter: JobAdapter, authority: () => LocalAuthority): LocalJobConsumer {
    if (!this.#journal || !this.#relay || this.#degraded || this.#consumer) throw new Error('LOCAL_JOB_UNAVAILABLE');
    return this.#consumer = new LocalJobConsumer({ journal: this.#journal, adapter, authority: () => ({ ...authority(),
      ...(this.#commissioning ? { commissioning: this.#commissioning } : {}) }), auditSpool: this.#relay.spool });
  }
  requireCommissioning(read: NonNullable<LocalAuthority['commissioning']>) { this.#commissioning = read; }
  get status() {
    const stored = this.#consumer?.status ?? this.#journal?.status();
    return { enabled: this.#enabled, configuredConsumer: !!this.#consumer, physicalActuationEnabled: false,
      degraded: this.#degraded || stored?.degraded === true, recoveryRequired: stored?.recoveryRequired ?? false,
      active: stored?.active ?? null, auditPending: stored?.auditPending ?? null };
  }
  stop(): void {
    this.#consumer?.localSafetyStop('INTERRUPTED');
    try { this.#relay?.close(); this.#journal?.close(); } catch { this.#degraded = true; }
  }
}
