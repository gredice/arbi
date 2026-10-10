/** One application budget for HTTPS and broker payloads, retained across
 * reconnects. Durable metering remains the owning adapter's responsibility. */
export class RecoveryTraffic {
  #window: number; #bytes = 0; #calls = 0;
  constructor(readonly now: () => number = Date.now) { this.#window = now(); }
  get retryAt(): number { this.refresh(); return this.#window + 60000; }
  private refresh(): void {
    if (this.now() - this.#window >= 60000) { this.#window = this.now(); this.#bytes = 0; this.#calls = 0; }
  }
  request(): void {
    this.refresh();
    if (this.#calls >= 60 || this.#bytes >= 2 * 1024 * 1024) throw new Error('RECOVERY_BUDGET');
    this.#calls++;
  }
  account(count: number): void {
    this.refresh();
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('INVALID_TRAFFIC');
    this.#bytes += count;
    if (this.#bytes > 2 * 1024 * 1024) throw new Error('TRAFFIC_BUDGET');
  }
}
