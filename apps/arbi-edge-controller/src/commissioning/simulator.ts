import { DatabaseSync } from 'node:sqlite';
import { ConfigurationReference, configurationDigest, type ConfigurationApplyBoundary, type ConfigurationJournal, type ConfigurationReport, type ConfigurationRequest } from '@arbi/protocol';
import { CommissioningError, validateSet, type CommissioningSet } from './contracts.js';
import type { CommissioningDevice, DeviceObservation } from './coordinator.js';
import type { Enrollment } from './store.js';

/** Explicit synthetic adapter with its own durable configuration journal. It has no actuator or credential API. */
export class SimulationCommissioningDevice implements CommissioningDevice {
  readonly #db: DatabaseSync;
  readonly #reference = new ConfigurationReference();
  readonly #enrollment: Enrollment;
  #staged: CommissioningSet | null = null;
  #activeDigest: string | null = null;
  #report: ConfigurationReport | null = null;
  readonly activationRequests: string[] = [];
  fault?: (point: 'prepare' | 'before-device-commit' | 'after-device-commit') => void;
  constructor(path: string, enrollment: Enrollment) {
    this.#enrollment = structuredClone(enrollment);
    if (enrollment.realm.environment !== 'test' || enrollment.executionMode !== 'simulation') throw new CommissioningError('SIMULATION_ONLY');
    this.#db = new DatabaseSync(path, { timeout: 100 });
    try {
      this.#db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA fullfsync=ON; PRAGMA max_page_count=4096;
        CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), binding TEXT NOT NULL, body TEXT NOT NULL, hash TEXT NOT NULL);`);
      const binding = configurationDigest([enrollment.realm, enrollment.siteId, enrollment.identity.deviceId]);
      const row = this.#db.prepare('SELECT * FROM state').get();
      if (row) {
        if (row.binding !== binding) throw new CommissioningError('SCOPE_MISMATCH');
        const value = JSON.parse(String(row.body));
        if (configurationDigest(value) !== row.hash) throw new CommissioningError('CORRUPT_STORE');
        const restored = this.#reference.reboot(value.journal, enrollment.identity);
        if (!restored.ok) throw new CommissioningError(restored.error.code);
        this.#staged = value.staged ? validateSet(value.staged) : null; this.#activeDigest = value.activeDigest; this.#report = restored.value;
      } else this.#write(this.#reference.exportJournal(), null, null, binding);
    } catch (e) { this.#db.close(); throw e; }
  }
  close() { this.#db.close(); }
  inspect(): DeviceObservation {
    return { ...structuredClone(this.#enrollment), journal: this.#reference.exportJournal(), inhibited: true, stagedDigest: this.#staged ? configurationDigest(this.#staged) : null,
      activeSetDigest: this.#activeDigest, report: structuredClone(this.#report) };
  }
  inhibit() { /* Always inhibited: no physical or simulated actuation dispatch exists in this adapter. */ }
  async prepare(input: CommissioningSet, signal: AbortSignal): Promise<string> {
    if (signal.aborted) throw new CommissioningError('DEVICE_TIMEOUT');
    this.fault?.('prepare');
    const set = validateSet(input);
    this.#write(this.#reference.exportJournal(), set, this.#activeDigest); this.#staged = set;
    return configurationDigest(set);
  }
  async activate(request: ConfigurationRequest, setDigest: string, boundary: ConfigurationApplyBoundary, signal: AbortSignal) {
    if (signal.aborted || !this.#staged || configurationDigest(this.#staged) !== setDigest || configurationDigest(this.#staged.configuration) !== configurationDigest(request.configuration)) throw new CommissioningError('PREPARE_MISMATCH');
    this.activationRequests.push(request.transactionId);
    this.fault?.('before-device-commit');
    const result = this.#reference.apply(request, boundary, journal => { this.#write(journal, this.#staged, setDigest); return true; });
    if (!result.ok) throw new CommissioningError(result.error.code);
    this.#report = result.value; this.#activeDigest = setDigest;
    this.fault?.('after-device-commit');
    return structuredClone(result.value);
  }
  #write(journal: ConfigurationJournal, staged: CommissioningSet | null, activeDigest: string | null, initialBinding?: string) {
    const value = { journal, staged, activeDigest }, body = JSON.stringify(value);
    if (Buffer.byteLength(body) > 8_388_608) throw new CommissioningError('STORE_CAPACITY');
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      if (initialBinding) this.#db.prepare('INSERT INTO state VALUES(1,?,?,?)').run(initialBinding, body, configurationDigest(value));
      else this.#db.prepare('UPDATE state SET body=?,hash=? WHERE id=1').run(body, configurationDigest(value));
      this.#db.exec('COMMIT');
    } catch (e) { this.#db.exec('ROLLBACK'); throw e; }
  }
}
