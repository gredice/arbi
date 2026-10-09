#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

const tag = process.env.CAD_RELEASE_TAG;
const commit = process.env.CAD_RELEASE_COMMIT;
if (!/^cad-v\d+\.\d+\.\d+$/.test(tag ?? '') || !/^[0-9a-f]{40}$/.test(commit ?? '')) throw new Error('Expected a CAD tag and source commit');
const deadline = Date.now() + 10 * 60 * 1000;
let reason;
do {
  try {
    const response = await fetch(`https://arbi.gredice.com/data/site.json?release=${tag}&t=${Date.now()}`, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Site data HTTP ${response.status}`);
    const site = await response.json();
    if (!site.release || site.release.missingOutputs.length || !site.scenes['camera-pod']?.source.current
      || !site.scenes.winch?.source.current || !site.scenes['winch-powered']?.source.current
      || !site.scenes['corner-station']?.source.current || !site.scenes.dock?.source.current
      || site.scenes.dock.layout !== 'assembly'
      || !site.scenes['control-cabinet']?.source.current || site.scenes['control-cabinet'].layout !== 'assembly'
      || Object.keys(site.figures ?? {}).length !== site.registry.models.length) throw new Error('Site still has incomplete or archived CAD data');
    if (site.release.tag !== tag) {
      const relation = execFileSync('gh', ['api', `repos/gredice/arbi/compare/${commit}...${site.release.commit}`, '--jq', '.status'], { encoding: 'utf8' }).trim();
      if (relation !== 'ahead') throw new Error('Site still uses a preceding CAD release');
    } else if (site.release.commit !== commit) throw new Error('Site release commit differs from publication');
    console.log(`Verified arbi.gredice.com: site ${site.commit}, CAD ${site.release.tag}, current assembly scenes and all registered outputs.`);
    process.exit(0);
  } catch (error) {
    reason = error.message;
  }
  await setTimeout(30000);
} while (Date.now() < deadline);
throw new Error(`Production rebuild did not publish current CAD data within 10 minutes: ${reason}. Rerun the release workflow to retry the refresh.`);
