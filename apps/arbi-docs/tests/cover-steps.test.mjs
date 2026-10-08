import assert from "node:assert/strict";
import { test } from "node:test";
import { coverSteps } from "../src/lib/cover-steps.ts";

const common = ["camera-pod-rain-hood", "camera-pod-enclosure-base", "camera-pod-spider"];
const scene = (models) => ({ parts: models.map((model) => ({ model, registered: true })) });

test("all six current enclosure captions target installed, anchorable models", () => {
    const steps = coverSteps(scene([...common, "camera-pod-integrated-deck", "camera-pod-integrated-gimbal-head", "camera-pod-integrated-gimbal-carrier"]));
    assert.deepEqual(steps.map((step) => step.model), [
        "camera-pod-rain-hood", "camera-pod-integrated-deck", "camera-pod-enclosure-base", "camera-pod-spider",
        "camera-pod-integrated-gimbal-head", "camera-pod-integrated-gimbal-carrier",
    ]);
    assert.equal(steps[4].title, "Moving head");
    assert.ok(!steps[4].text.includes("45°"), "the moving head uses the current service sequence");
});

test("older enclosure scenes keep their own deck, fairing and pan yoke", () => {
    const steps = coverSteps(scene([...common, "camera-pod-electronics-deck", "camera-pod-pan-fairing", "camera-pod-pan-yoke"]));
    assert.equal(steps.length, 6);
    assert.equal(steps[1].model, "camera-pod-electronics-deck");
    assert.equal(steps[4].model, "camera-pod-pan-fairing");
    assert.equal(steps[5].model, "camera-pod-pan-yoke");
});

test("absent or unregistered parts cannot produce a caption with no viewer anchor", () => {
    const pod = scene([...common, "camera-pod-integrated-deck"]);
    pod.parts.push({ model: "camera-pod-integrated-gimbal-head", registered: false });
    assert.equal(coverSteps(pod).length, 4);
    for (const step of coverSteps(pod)) {
        assert.ok(pod.parts.some((part) => part.registered && part.model === step.model));
    }
});
