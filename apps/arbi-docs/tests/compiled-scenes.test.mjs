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
        const files = unzipSync(readFileSync(join(app, "../../docs/assemblies/winch/booklet/ARBI-winch-STL-pack.zip")));
        const manifest = JSON.parse(new TextDecoder().decode(files[Object.keys(files).find((n) => n.endsWith("/figure-manifest.json"))]));
        const read = (slug) => JSON.parse(readFileSync(join(output, `scenes/${slug}.json`), "utf8"));
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
