import { createCommissioningReference } from './reference.js';
const reference = await createCommissioningReference(process.argv[2]!);
await reference.enrollAll();
const stage = await reference.request('stage', { reason: 'fixture-crash', set: reference.set });
if (stage.status !== 200) process.exit(2);
reference.devices.get('edge')!.fault = point => { if (point === 'after-device-commit') process.kill(process.pid, 'SIGKILL'); };
await reference.request('activate');
process.exit(3);
