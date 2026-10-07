import { EdgeRuntime } from './runtime.js';
import { loadSettings } from './settings.js';
import { createSimulation } from './simulation.js';

async function main(): Promise<void> {
  let simulation: Awaited<ReturnType<typeof createSimulation>> | undefined;
  let runtime: EdgeRuntime;
  try {
    if (process.argv.length === 3 && process.argv[2] === '--simulate') simulation = await createSimulation();
    else if (process.argv.length !== 4 || process.argv[2] !== '--config') throw new Error('INVALID_ARGUMENTS');
    runtime = new EdgeRuntime(simulation?.settings ?? loadSettings(process.argv[3]));
  } catch {
    console.error('EDGE_CONFIG_INVALID'); await simulation?.close(); process.exitCode = 78; return;
  }
  let stopping = false;
  const shutdown = async (): Promise<void> => {
    if (stopping) return; stopping = true;
    await runtime.stop(); await simulation?.close();
    if (process.connected) process.disconnect();
  };
  process.once('SIGTERM', () => void shutdown()); process.once('SIGINT', () => void shutdown());
  try {
    const port = await runtime.start();
    const started = { kind: 'started', healthPort: port, source: runtime.identity, executionMode: 'simulation', actuationEnabled: false };
    console.log(JSON.stringify(started)); if (process.connected) process.send?.(started);
  } catch { console.error('EDGE_START_FAILED'); process.exitCode = 1; await shutdown(); }
}
void main();
