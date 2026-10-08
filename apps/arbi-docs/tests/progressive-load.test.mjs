import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { loadParts } from "../src/components/three/progressive-load.ts";

test("a fast part is displayed while an earlier download is still pending", async () => {
    const slow = Promise.withResolvers();
    const displayed = [];
    const states = [];
    const task = loadParts(["slow", "fast"], (part) => part === "slow" ? slow.promise : Promise.resolve(part),
        (value) => displayed.push(value), (state) => states.push(state), () => true);
    await delay(5);
    assert.deepEqual(displayed, ["fast"]);
    assert.deepEqual(states.at(-1), { loaded: 1, failed: 0, total: 2 });
    slow.resolve("slow");
    assert.deepEqual(await task, { loaded: 2, failed: 0, total: 2 });
    assert.deepEqual(displayed, ["fast", "slow"]);
});

test("failed meshes do not block successful parts or stop the queue", async () => {
    const displayed = [];
    const result = await loadParts([0, 1, 2, 3, 4, 5], async (part) => {
        if (part === 0 || part === 4) throw new Error("HTTP 404");
        return part;
    }, (part) => displayed.push(part), () => {}, () => true);
    assert.deepEqual(displayed.sort(), [1, 2, 3, 5]);
    assert.deepEqual(result, { loaded: 4, failed: 2, total: 6 });
});

test("at most four downloads run concurrently, with a paint opportunity between cached parts", async () => {
    let pending = 0;
    let peak = 0;
    let painted = false;
    setTimeout(() => { painted = true; }, 0);
    await loadParts(Array.from({ length: 12 }, (_, i) => i), async (part) => {
        pending++;
        peak = Math.max(peak, pending);
        await Promise.resolve();
        pending--;
        return part;
    }, (part) => { if (part >= 4) assert.equal(painted, true); }, () => {}, () => true);
    assert.equal(peak, 4);
});

test("disposal ignores in-flight completions and never starts queued downloads", async () => {
    const download = Promise.withResolvers();
    let active = true;
    const started = [];
    const displayed = [];
    const states = [];
    const task = loadParts([0, 1, 2, 3, 4, 5], (part) => {
        started.push(part);
        return download.promise;
    }, (value) => displayed.push(value), (state) => states.push(state), () => active);
    active = false;
    download.resolve("mesh");
    await task;
    assert.deepEqual(started, [0, 1, 2, 3]);
    assert.deepEqual(displayed, []);
    assert.equal(states.length, 1);
});
