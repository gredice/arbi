import assert from "node:assert/strict";
import { test } from "node:test";
import { PerspectiveCamera } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { configurePageControls } from "../src/components/three/page-controls.ts";

test("wheel scrolling over a model is not canceled or used to zoom", () => {
    const camera = new PerspectiveCamera();
    camera.position.set(10, 20, 30);
    const controls = new OrbitControls(camera);
    controls.domElement = { style: { touchAction: "none" } };
    configurePageControls(controls);
    const before = camera.position.clone();
    const event = new Event("wheel", { cancelable: true });
    controls._onMouseWheel(event);
    assert.equal(event.defaultPrevented, false);
    assert.deepEqual(camera.position, before);
    assert.equal(controls.enableRotate, true, "mouse orbit remains available");
    assert.equal(controls.domElement.style.touchAction, "pan-y pinch-zoom");
});

test("one- and two-finger touch gestures do not start orbit or dolly", () => {
    const controls = new OrbitControls(new PerspectiveCamera());
    controls.domElement = { style: {} };
    configurePageControls(controls);
    let starts = 0;
    controls.addEventListener("start", () => starts++);
    for (const pointerId of [1, 2]) {
        const touch = { pointerId, pageX: 20, pageY: 30 };
        controls._addPointer(touch);
        controls._onTouchStart(touch);
    }
    assert.equal(starts, 0);
});
