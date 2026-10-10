import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const path = process.env.WEB_PATH;
if (!['apps/arbi-docs', 'apps/arbi-dashboard'].includes(path)) throw new Error('Unknown implemented web target');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (commit !== process.env.GITHUB_SHA) throw new Error('Web preview source mismatch');
writeFileSync(`${path}/.next/arbi-build.json`, JSON.stringify({ schemaVersion: 'arbi.web-build/1.0', commit,
    environment: 'nonproduction-review', productionDeviceAuthority: false, installationRequested: false,
    runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, node: process.versions.node,
    lockSha256: createHash('sha256').update(readFileSync('pnpm-lock.yaml')).digest('hex') }, null, 2) + '\n');
