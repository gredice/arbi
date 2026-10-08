import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { StudioLighting } from "../src/components/three/studio-lighting.ts";

test("studio shadow coverage follows translated CAD at different millimetre scales", () => {
    const studio = new StudioLighting();
    // Thin shell, small fastener and tall assembly: no assumptions about a metre-sized model.
    for (const [min, max] of [
        [[-81.1, -95.5, -6.95], [81.1, 95.5, 6.95]],
        [[10, 20, 30], [12, 22, 40]],
        [[-300, 500, -200], [400, 900, 1000]],
    ]) {
        const bounds = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
        const original = bounds.clone();
        studio.fit(bounds);
        studio.updateMatrixWorld(true);
        const key = studio.children.find((child) => child.isDirectionalLight && child.castShadow);
        key.shadow.updateMatrices(key);
        const camera = key.shadow.camera;
        for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
            const corner = new THREE.Vector3(x, y, z);
            assert.ok(key.shadow.getFrustum().containsPoint(corner), "CAD must stay inside the shadow frustum");
            // The key's projection onto the floor must fit too, including tall parts.
            const direction = key.target.position.clone().sub(key.position);
            const floor = studio.children.find((child) => child.isMesh);
            corner.addScaledVector(direction, (floor.position.z - corner.z) / direction.z);
            const projected = corner.clone().project(camera);
            assert.ok(Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1, "floor shadow must not be clipped");
            assert.ok(Math.abs(corner.x - floor.position.x) < floor.scale.x / 2);
            assert.ok(Math.abs(corner.y - floor.position.y) < floor.scale.y / 2);
            assert.ok(floor.position.z < min[2], "floor must not intersect the part");
        }
        assert.deepEqual(bounds, original, "studio fitting must preserve the CAD envelope");
    }
    studio.dispose();
});

test("the studio stays hidden without geometry and disposes shadow/floor GPU resources", () => {
    const studio = new StudioLighting();
    studio.fit(new THREE.Box3());
    assert.equal(studio.visible, false);
    const scene = new THREE.Scene();
    scene.add(studio);
    studio.fit(new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1)));
    const key = studio.children.find((child) => child.isDirectionalLight && child.castShadow);
    const floor = studio.children.find((child) => child.isMesh);
    key.shadow.map = new THREE.WebGLRenderTarget(1, 1);
    let released = 0;
    for (const resource of [key.shadow.map, floor.geometry, floor.material]) resource.addEventListener("dispose", () => released++);
    studio.dispose();
    assert.equal(released, 3);
    assert.equal(scene.children.length, 0);
});
