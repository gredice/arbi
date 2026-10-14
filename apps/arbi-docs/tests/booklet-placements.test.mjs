import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { strToU8, unzipSync, zipSync } from 'fflate';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { sourcePlacement } from '../scripts/cad-data.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(app, '../..');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const matrix = (rows) => new THREE.Matrix4().set(...rows.flat());
const geometry = (bytes) => new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

test('source placement handles rotated export frames and leaves untransformed meshes in place', () => {
    const installed = [[0, 0, 1, 10], [0, 1, 0, 20], [-1, 0, 0, 30], [0, 0, 0, 1]];
    const exported = [[0, -1, 0, 4], [1, 0, 0, 5], [0, 0, 1, 6], [0, 0, 0, 1]];
    const source = new THREE.Vector3(2, 3, 7);
    const printed = source.clone().applyMatrix4(matrix(exported));
    const expected = printed.applyMatrix4(matrix(installed));
    const actual = source.applyMatrix4(matrix(sourcePlacement(installed, { export_matrix: exported })));
    assert.ok(actual.distanceTo(expected) < 1e-9);
    assert.deepEqual(sourcePlacement(installed, {}), installed);
});

test('colored pod surfaces preserve booklet geometry in assembled and exploded poses; winch poses stay unchanged', () => {
    const output = mkdtempSync(join(tmpdir(), 'arbi-booklet-placements-'));
    try {
        const compile = (dir, archive) => execFileSync(process.execPath, ['scripts/compile-data.mjs'], {
            cwd: app, stdio: 'pipe', env: { ...process.env, ARBI_OFFLINE: '1', ARBI_DATA_DIR: dir,
                ARBI_CAD_PREVIEW_PACK: archive ?? '' },
        });
        const baseline = join(output, 'baseline');
        compile(baseline);
        const readScene = (dir, slug) => JSON.parse(readFileSync(join(dir, `scenes/${slug}.json`)));
        const pod = readScene(baseline, 'camera-pod');
        const raw = unzipSync(readFileSync(join(repo, 'docs/assemblies/camera-pod/booklet/ARBI-payload-enclosure-STL-pack.zip')));
        const entries = JSON.parse(new TextDecoder().decode(raw[Object.keys(raw).find((name) => name.endsWith('/mesh-manifest.json'))]));
        const models = JSON.parse(readFileSync(join(repo, 'hardware/models.json'))).models;
        const files = {};
        const manifest = { schemaVersion: 1, style: 'cad-line-art-v2', models: {} };
        const figure = Buffer.alloc(24);
        Buffer.from('89504e470d0a1a0a', 'hex').copy(figure);
        figure.writeUInt32BE(480, 16); figure.writeUInt32BE(360, 20);
        const selected = ['camera-pod-spider', 'camera-pod-horn-retainer', 'winch-bearing-cap'];
        for (const id of selected) {
            const model = models.find((entry) => entry.id === id);
            const scene = id.startsWith('camera-pod') ? pod : readScene(baseline, 'winch');
            const part = scene.parts.find((entry) => entry.model === id);
            const g = geometry(readFileSync(join(baseline, part.url)));
            const mesh = entries.find((entry) => part.url === `pod/${entry.file}`);
            if (mesh) g.translate(...mesh.export_translation_mm.map((value) => -value));
            const binary = new STLExporter().parse(new THREE.Mesh(g), { binary: true });
            const bytes = new Uint8Array(binary.buffer, binary.byteOffset, binary.byteLength);
            g.computeBoundingBox();
            const sourceHashes = {};
            const visit = (path) => {
                if (sourceHashes[path]) return;
                const source = readFileSync(join(repo, path));
                sourceHashes[path] = digest(source);
                for (const match of source.toString().matchAll(/^\s*(?:include|use)\s*<([^>]+)>/gm))
                    visit(new URL(match[1], `file:///${path}`).pathname.slice(1));
            };
            visit(model.entrypoint);
            const asset = `appearances/${id}/surface.stl`;
            manifest.models[id] = { ...model, sourceHashes, figure: `figures/${id}.png`, sha256: digest(figure),
                appearance: { envelope: g.boundingBox.getSize(new THREE.Vector3()).toArray(), parts: [{
                    node: 'surface', mesh: asset, sha256: digest(bytes), material: {
                        color: [.66, .7, .73], roughness: .28, metalness: .8, transmission: 0, thickness: 0, ior: 1.5,
                    },
                }] } };
            files[`ARBI-CAD-previews/${asset}`] = bytes;
            files[`ARBI-CAD-previews/figures/${id}.png`] = figure;
        }
        files['ARBI-CAD-previews/manifest.json'] = strToU8(JSON.stringify(manifest));
        const archive = join(output, 'previews.zip');
        writeFileSync(archive, zipSync(files));
        const colored = join(output, 'colored');
        compile(colored, archive);
        let instances = 0;
        for (const slug of ['camera-pod', 'winch', 'winch-powered']) {
            const original = readScene(baseline, slug);
            for (const part of readScene(colored, slug).parts) {
                const before = original.parts.find((entry) => entry.node === part.node);
                assert.deepEqual(part.explode, before.explode);
                if (!selected.includes(part.model)) {
                    assert.deepEqual(part.matrix, before.matrix);
                    continue;
                }
                assert.equal(part.components.length, 1, `${part.node}: exercise colored replacement`);
                instances++;
                const expected = geometry(readFileSync(join(baseline, before.url))).applyMatrix4(matrix(before.matrix));
                const actual = geometry(readFileSync(join(colored, part.components[0].url))).applyMatrix4(matrix(part.matrix));
                assert.equal(actual.getAttribute('position').count, expected.getAttribute('position').count);
                // Identical installed vertices and explosion vectors preserve every
                // interpolated pose, including intermediate animation frames.
                for (const [axis, value] of actual.getAttribute('position').array.entries()) {
                    assert.ok(Math.abs(value - expected.getAttribute('position').array[axis]) < .001,
                        `${slug}/${part.node}: installed geometry moved`);
                }
                expected.dispose(); actual.dispose();
            }
        }
        assert.equal(instances, 7, 'spider, both rotated retainers and both bearing caps in each winch');
    } finally {
        rmSync(output, { recursive: true, force: true });
    }
});
