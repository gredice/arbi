import assert from 'node:assert/strict';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { copyBuiltCode } from './package.mjs';
test('same-filesystem deployment hardlinks become independent builds without damaging source or following external modules', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'arbi-pack-hardlinks-'));
    try {
        const source = resolve(root, 'source/dist'), stage = resolve(root, 'stage'), dependency = resolve(stage, 'dependency');
        mkdirSync(source, { recursive: true }); mkdirSync(resolve(dependency, 'dist'), { recursive: true });
        writeFileSync(resolve(source, 'index.js'), 'executable');
        linkSync(resolve(source, 'index.js'), resolve(dependency, 'dist/index.js'));
        copyBuiltCode(source, dependency, stage);
        assert.equal(readFileSync(resolve(source, 'index.js'), 'utf8'), 'executable');
        writeFileSync(resolve(dependency, 'dist/index.js'), 'independent');
        assert.equal(readFileSync(resolve(source, 'index.js'), 'utf8'), 'executable');
        symlinkSync(resolve(root, 'source'), resolve(stage, 'escape'));
        assert.throws(() => copyBuiltCode(source, resolve(stage, 'escape'), stage), /escapes archive/);
        assert.ok(existsSync(resolve(source, 'index.js')));
    } finally { rmSync(root, { recursive: true, force: true }); }
});
