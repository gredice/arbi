import { pathToFileURL } from 'node:url';
import { isAbsolute } from 'node:path';
import { RealtimeHttp } from '../src/realtime/server';
// A supervised operator scheduler supplies private composition/current resolvers.
// One invocation is bounded; it installs no fixture identity and logs no secrets.
const file = process.env.ARBI_REALTIME_COMPOSITION;
try {
  if (!file || !isAbsolute(file)) throw new Error();
  const { runtime,siteIds,close } = await import(pathToFileURL(file).href);
  try {
    if (!(runtime instanceof RealtimeHttp) || !Array.isArray(siteIds) || siteIds.length>8) throw new Error();
    for (const siteId of siteIds) await runtime.store.maintain(siteId);
    process.stdout.write('Bounded realtime maintenance completed.\n');
  } finally { if (typeof close === 'function') await close(); }
} catch { process.stderr.write('Realtime maintenance unavailable.\n');process.exitCode=1; }
