import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("passive and powered inventories and poses match their own canonical booklet figures", () => {
    const output = mkdtempSync(join(tmpdir(), "arbi-site-test-"));
    try {
        execFileSync(process.execPath, ["scripts/compile-data.mjs"], {
            cwd: app,
            env: { ...process.env, ARBI_OFFLINE: "1", ARBI_DATA_DIR: output },
            stdio: "pipe",
        });
        const bom = JSON.parse(readFileSync(join(output, "site.json"), "utf8")).bom;
        const driver = bom.parts.find((part) => part.id === "cl57y-v20-driver");
        assert.equal(driver.bundle, true);
        assert.equal(driver.goodsAllocationBasis, "part-count");
        assert.equal(driver.knownGoods, "73.34");
        assert.equal(driver.usedIn[0].knownGoodsAmount, "73.34");
        assert.equal(bom.parts.find((part) => part.id === "power-supply-48v-350w").knownGoods, "36.67");
        assert.equal(bom.parts.find((part) => part.id === "dock-funnel").knownGoods, null);
        assert.equal(bom.summary.assemblyKnownGoods.find((item) => item.assemblyId === "winch-set").amount, "390.85");
        assert.equal(bom.summary.knownSubtotal, "987.22");
        const files = unzipSync(readFileSync(join(app, "../../docs/assemblies/winch/booklet/ARBI-winch-STL-pack.zip")));
        const manifest = JSON.parse(new TextDecoder().decode(files[Object.keys(files).find((n) => n.endsWith("/figure-manifest.json"))]));
        const read = (slug) => JSON.parse(readFileSync(join(output, `scenes/${slug}.json`), "utf8"));
        const podFiles = unzipSync(readFileSync(join(app, "../../docs/assemblies/camera-pod/booklet/ARBI-payload-enclosure-STL-pack.zip")));
        const podManifest = JSON.parse(new TextDecoder().decode(podFiles[Object.keys(podFiles).find((n) => n.endsWith("/assembly-manifest.json"))]));
        const pod = read("camera-pod");
        assert.ok(pod.parts.filter((part) => part.registered).every((part) => part.model.startsWith("camera-pod-") && part.href === `/parts/${part.model}`));
        assert.equal(pod.kind, "stl", "pod parts must be independently downloadable");
        assert.equal(pod.glb, undefined);
        assert.equal(pod.parts.length, podManifest.parts.length);
        for (const [index, part] of pod.parts.entries()) {
            const source = podManifest.parts[index];
            assert.deepEqual(part.matrix, source.matrix, "streaming must preserve the booklet's assembly pose");
            assert.deepEqual(part.color, source.color);
            const original = podFiles[Object.keys(podFiles).find((n) => n.endsWith(`/${source.file}`))];
            assert.deepEqual(readFileSync(join(output, part.url)), Buffer.from(original));
        }
        assert.ok(pod.bounds.min.every(Number.isFinite));
        assert.ok(pod.bounds.max.every((value, axis) => value > pod.bounds.min[axis]));
        const passive = read("winch");
        const powered = read("winch-powered");
        for (const [variant, scene] of [["passive", passive], ["powered", powered]]) {
            const source = manifest[`cover-${variant}-installed`].parts;
            assert.equal(scene.parts.length, source.length);
            assert.equal(scene.pose, `cover-${variant}-exploded`);
            assert.deepEqual(scene.parts.map((p) => p.matrix), source.map((p) => p.matrix));
            assert.ok(scene.parts.some((p) => p.explode.some((n) => n !== 0)));
            const fascia = scene.parts.find((p) => p.model === `winch-cover-${variant}-pole-fascia`);
            const looms = scene.parts.filter((p) => p.model.startsWith(`loom-${variant}-bottom-`));
            assert.equal(looms.length, 2);
            assert.ok(fascia.explode.some((n) => n !== 0));
            for (const loom of looms) {
                assert.deepEqual(loom.explode, fascia.explode,
                    `${variant} cable must stay aligned with its fascia port throughout explosion`);
            }
            for (const part of scene.parts) assert.ok(existsSync(join(output, part.url)));
            const catalog = JSON.parse(readFileSync(join(output, 'site.json'), 'utf8')).bom.parts;
            const bomIds = new Set(catalog.map((p) => p.id));
            for (const [index, part] of scene.parts.entries()) {
                if (part.registered) assert.equal(part.href, `/parts/${part.model}`);
                if (source[index].bomPartId || part.href?.startsWith('/bom/')) {
                    assert.ok(part.href?.startsWith('/bom/'), `${part.model} must be clickable`);
                    assert.ok(bomIds.has(part.href.slice(5)), `${part.model} must open an existing page`);
                }
            }
            assert.equal(scene.parts.find((p) => p.model === 'motor-23HS40-reference').href,
                '/bom/nema23-closed-loop-motor');
        }
        assert.ok(powered.parts.some((p) => p.model === "winch-drum-powered-3"));
        assert.ok(!passive.parts.some((p) => p.model === "winch-drum-powered-3"));
        assert.equal(powered.parts.filter((p) => p.model === "winch-cover-clip").length, 20);
        assert.equal(passive.parts.filter((p) => p.model === "winch-cover-clip").length, 12);
        for (const asset of ["arbi-logo.svg", "gredice-logo-white.svg", "flag-hr.svg", "flag-eu.svg"]) {
            assert.ok(existsSync(join(output, "docs/assets/brand", asset)));
        }
    } finally {
        rmSync(output, { recursive: true, force: true });
    }
});
