import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { OutlineGeometry } from "../src/components/three/outlines.ts";

function segments(geometry) {
    return Array.from(geometry.getAttribute("position").array.slice(0, geometry.drawRange.count * 3));
}

test("a smooth sphere has a closed outline without exposing its triangle wireframe", () => {
    const sphere = new THREE.SphereGeometry(10, 64, 32);
    assert.equal(new THREE.EdgesGeometry(sphere, 28).getAttribute("position").count, 0);
    const outline = new OutlineGeometry(sphere);
    outline.update(new THREE.Vector3(30, 40, 20));
    const points = segments(outline);
    assert.ok(points.length > 0, "rounded surfaces must have visible contours");
    assert.ok(outline.drawRange.count < sphere.index.count / 10, "internal triangulation stays hidden");
    const degree = new Map();
    for (let i = 0; i < points.length; i += 3) {
        const key = points.slice(i, i + 3).map((n) => Math.round(n * 1e4)).join(",");
        degree.set(key, (degree.get(key) ?? 0) + 1);
    }
    assert.ok([...degree.values()].every((n) => n === 2), "the contour must form a closed loop");
});

test("contours follow camera orbit and zoom, with independent buffers for shared meshes", () => {
    const sphere = new THREE.SphereGeometry(10, 64, 32);
    const first = new OutlineGeometry(sphere);
    const second = new OutlineGeometry(sphere);
    first.update(new THREE.Vector3(30, 40, 20));
    const before = segments(first);
    first.update(new THREE.Vector3(-40, 30, 20));
    assert.notDeepEqual(segments(first), before);
    second.update(new THREE.Vector3(30, 40, 20));
    assert.deepEqual(segments(second), before);
    first.update(new THREE.Vector3(15, 20, 10));
    assert.notDeepEqual(segments(first), before, "perspective contours depend on distance as well as direction");
    const version = first.getAttribute("position").version;
    first.update(new THREE.Vector3(15, 20, 10));
    assert.equal(first.getAttribute("position").version, version, "a stationary view needs no buffer upload");
});

test("indexed GLBs and non-indexed STLs produce the same contours", () => {
    const sphere = new THREE.SphereGeometry(10, 64, 32);
    const indexed = new OutlineGeometry(sphere);
    const triangles = new OutlineGeometry(sphere.toNonIndexed());
    const camera = new THREE.Vector3(30, 40, 20);
    indexed.update(camera);
    triangles.update(camera);
    assert.deepEqual(segments(triangles), segments(indexed));
});

test("sharp edges and open boundaries remain visible", () => {
    for (const source of [new THREE.BoxGeometry(), new THREE.PlaneGeometry(10, 10, 8, 8)]) {
        const expected = Array.from(new THREE.EdgesGeometry(source, 28).getAttribute("position").array);
        const outline = new OutlineGeometry(source);
        outline.update(new THREE.Vector3(30, 40, 20));
        assert.deepEqual(segments(outline), expected);
    }
});

test("local camera coordinates preserve contours under nested mesh transforms", () => {
    const source = new THREE.SphereGeometry(10, 64, 32);
    const mesh = new THREE.Mesh(source);
    const group = new THREE.Group();
    group.scale.set(1000, 700, 900);
    group.rotation.set(0.4, -0.6, 0.2);
    group.position.set(50, -80, 120);
    mesh.position.set(12, -5, 4);
    group.add(mesh);
    group.updateMatrixWorld(true);
    const local = new THREE.Vector3(30, 40, 20);
    const world = mesh.localToWorld(local.clone());
    const original = new OutlineGeometry(source);
    const transformed = new OutlineGeometry(source);
    original.update(local);
    transformed.update(mesh.worldToLocal(world));
    assert.deepEqual(segments(transformed), segments(original));
});
