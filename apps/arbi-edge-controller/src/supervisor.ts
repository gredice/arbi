import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

/** Portable development prototype. systemd owns supervision on Linux. */
export class DevelopmentSupervisor extends EventEmitter {
  child?: ChildProcess;
  #retry?: NodeJS.Timeout;
  #stopping = false;
  #starts: number[] = [];
  #configFile: string;
  constructor(configFile: string) { super(); this.#configFile = configFile; }
  start(): void {
    if (this.child || this.#stopping) return;
    this.#starts = this.#starts.filter((time) => performance.now() - time < 60000);
    if (this.#starts.length >= 5) { this.emit('blocked', 'RESTART_LIMIT'); return; }
    this.#starts.push(performance.now());
    const child = spawn(process.execPath, ['--max-old-space-size=256', fileURLToPath(new URL('./cli.js', import.meta.url)), '--config', this.#configFile], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    this.child = child;
    child.on('message', (message) => this.emit('status', message));
    child.on('error', () => this.emit('blocked', 'SPAWN_FAILED'));
    child.on('exit', (code, signal) => {
      this.child = undefined; this.emit('exit', { code, signal });
      if (!this.#stopping && code !== 0 && code !== 78) this.#retry = setTimeout(() => this.start(), 250);
      else if (code === 78) this.emit('blocked', 'INVALID_CONFIGURATION');
    });
  }
  async stop(): Promise<void> {
    this.#stopping = true; clearTimeout(this.#retry);
    const child = this.child;
    if (!child) return;
    await new Promise<void>((resolve) => {
      const forced = setTimeout(() => child.kill('SIGKILL'), 5000);
      child.once('exit', () => { clearTimeout(forced); resolve(); }); child.kill('SIGTERM');
    });
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== '--config') { console.error('SUPERVISOR_CONFIG_REQUIRED'); process.exitCode = 78; }
  else {
    const supervisor = new DevelopmentSupervisor(process.argv[3]);
    supervisor.on('status', (message) => console.log(JSON.stringify(message)));
    supervisor.on('blocked', (reason) => { console.error(reason); process.exitCode = 78; });
    process.once('SIGTERM', () => void supervisor.stop()); process.once('SIGINT', () => void supervisor.stop());
    supervisor.start();
  }
}
