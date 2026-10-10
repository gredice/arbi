import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function smoke(artifact) {
    const directory = mkdtempSync(join(tmpdir(), 'arbi-packed-'));
    let child;
    try {
        execFileSync('tar', ['-xzf', artifact, '-C', directory]);
        // No NODE_PATH, worktree imports, provider, device or deployment credentials.
        child = spawn(process.execPath, ['dist/cli.js', '--simulate'], { cwd: directory,
            env: { PATH: process.env.PATH, LANG: 'C.UTF-8' }, stdio: ['ignore', 'pipe', 'pipe'] });
        const record = await new Promise((resolveRecord, reject) => {
            const timer = setTimeout(() => reject(new Error('Packed startup timed out')), 10_000);
            let output = '';
            child.on('error', error => { clearTimeout(timer); reject(error); });
            child.on('exit', () => { clearTimeout(timer); reject(new Error('Packed startup failed')); });
            child.stdout.on('data', chunk => {
                output += chunk;
                if (output.includes('\n')) { clearTimeout(timer); try { resolveRecord(JSON.parse(output.split('\n')[0])); } catch { reject(new Error('Invalid packed startup')); } }
            });
        });
        const response = await fetch(`http://127.0.0.1:${record.healthPort}/healthz`, { signal: AbortSignal.timeout(5000) });
        assert.equal(response.status, 200);
        const health = await response.json();
        assert.equal(health.executionMode, 'simulation');
        assert.equal(health.actuationEnabled, false);
        assert.equal(health.updateEnabled, false);
        console.log('Packed edge application runs independently in simulation; no installation was requested.');
    } finally {
        if (child && child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
        rmSync(directory, { recursive: true, force: true });
    }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await smoke(resolve(process.argv[2]));
