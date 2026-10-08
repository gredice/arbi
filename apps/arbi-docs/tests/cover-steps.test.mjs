import assert from "node:assert/strict";
import { test } from "node:test";
import { coverSteps } from "../src/lib/cover-steps.ts";

const common = ["payload-rain-hood", "payload-enclosure-base", "camera-pod-spider"];
const scene = (models) => ({ parts: models.map((model) => ({ model, registered: true })) });

test("all six current enclosure captions target installed, anchorable models", () => {
    const steps = coverSteps(scene([...common, "payload-integrated-deck", "payload-integrated-gimbal-head", "payload-integrated-gimbal-carrier"]));
    assert.deepEqual(steps.map((step) => step.model), [
        "payload-rain-hood", "payload-integrated-deck", "payload-enclosure-base", "camera-pod-spider",
        "payload-integrated-gimbal-head", "payload-integrated-gimbal-carrier",
    ]);
    assert.equal(steps[4].title, "Moving head");
    assert.ok(!steps[4].text.includes("45°"), "the moving head uses the current service sequence");
});

test("older enclosure scenes keep their own deck, fairing and pan yoke", () => {
    const steps = coverSteps(scene([...common, "payload-electronics-deck", "payload-pan-fairing", "payload-pan-yoke"]));
    assert.equal(steps.length, 6);
    assert.equal(steps[1].model, "payload-electronics-deck");
    assert.equal(steps[4].model, "payload-pan-fairing");
    assert.equal(steps[5].model, "payload-pan-yoke");
});

test("absent or unregistered parts cannot produce a caption with no viewer anchor", () => {
    const pod = scene([...common, "payload-integrated-deck"]);
    pod.parts.push({ model: "payload-integrated-gimbal-head", registered: false });
    assert.equal(coverSteps(pod).length, 4);
    for (const step of coverSteps(pod)) {
        assert.ok(pod.parts.some((part) => part.registered && part.model === step.model));
    }
});
