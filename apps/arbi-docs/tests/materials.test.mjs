import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { fadeMaterial, shadedMaterial, surfaceMaterial } from "../src/components/three/materials.ts";

test("shaded GLTF materials retain texture, colour groups, physical properties and cache ownership", () => {
    const texture = new THREE.Texture();
    const source = new THREE.MeshPhysicalMaterial({ color: 0x124aef, map: texture, metalness: 0.2,
        roughness: 0.23, transmission: 0.65, thickness: 0.75, ior: 1.46, opacity: 0.7, depthWrite: false });
    const copy = shadedMaterial(source, [1, 1, 1], true);
    assert.notEqual(copy, source);
    for (const property of ["map", "roughness", "metalness", "transmission", "thickness", "ior", "opacity"])
        assert.equal(copy[property], source[property]);
    assert.equal(copy.color.getHex(), source.color.getHex());
    for (let i = 0; i < 80; i++) fadeMaterial(copy, false);
    assert.ok(Math.abs(copy.opacity - 0.7 * 0.16) < 0.001);
    for (let i = 0; i < 80; i++) fadeMaterial(copy, true);
    assert.ok(Math.abs(copy.opacity - 0.7) < 0.001);
    assert.equal(copy.depthWrite, false);
    assert.equal(source.opacity, 0.7);
    assert.equal(source.transparent, false);
    assert.equal(copy.transparent, false, "restore authored render pass after selection fading");
    assert.equal(copy.transmission, 0.65);
    copy.dispose(); source.dispose(); texture.dispose();
});

test("CAD surfaces use explicit physical metadata and untagged STL keeps its palette fallback", () => {
    const surface = surfaceMaterial({ color: [0.08, 0.32, 0.86], roughness: 0.22, metalness: 0,
        transmission: 0.65, thickness: 0.75, ior: 1.46 });
    assert.equal(surface.transmission, 0.65);
    assert.equal(surface.opacity, 1);
    assert.equal(surface.thickness, 0.75);
    assert.deepEqual(surface.color.toArray(), new THREE.Color().setRGB(0.08, 0.32, 0.86, THREE.SRGBColorSpace).toArray());
    const source = new THREE.MeshBasicMaterial();
    const fallback = shadedMaterial(source, [0.66, 0.7, 0.73], false);
    assert.equal(fallback.metalness, 0.8);
    assert.equal(fallback.transparent, false, "opaque internals must enter the transmission buffer");
    surface.dispose(); source.dispose(); fallback.dispose();
});
