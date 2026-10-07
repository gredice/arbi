import { appendFileSync } from 'node:fs';
import { createJobReference } from './reference.js';
import type { CrashPoint, JobRecord } from './types.js';

// Test executable. The process dies without SQLite close/finally after the selected boundary.
const [directory, point, indexText] = process.argv.slice(2);
if (directory && point && indexText) {
  let count = 0;
  const fault = (at: CrashPoint, r?: JobRecord) => {
    if (at !== point) return;
    if ((point === 'before-commit' || point === 'after-commit') && !r) return;
    count++;
    if (count === Number(indexText)) {
      appendFileSync(`${directory}/boundary.jsonl`, JSON.stringify({ at, phase: r?.phase, index: count }) + '\n');
      process.kill(process.pid, 'SIGKILL');
    }
  };
  const rig = createJobReference(directory, { journal: { fault }, consumer: { fault } });
  const originalDispatch = rig.adapter.dispatch.bind(rig.adapter);
  rig.adapter.dispatch = operation => {
    appendFileSync(`${directory}/dispatch.jsonl`, JSON.stringify({ id: operation.id, phase: operation.phase }) + '\n');
    originalDispatch(operation);
  };
  rig.consumer.receive(rig.command);
  for (let now = 1000; now <= 10000; now += 50) {
    const r = rig.advance(now); if (r && ['completed', 'failed'].includes(r.outcome)) break;
  }
  rig.close();
  process.exit(0);
}
