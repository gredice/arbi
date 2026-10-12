import * as THREE from "three";
import type { SurfaceMaterial, Vec3 } from "../../lib/types.ts";

/** CAD display values are sRGB; thickness uses the model's millimetre units. */
export function surfaceMaterial(surface: SurfaceMaterial) {
    return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color().setRGB(...surface.color, THREE.SRGBColorSpace),
        roughness: surface.roughness,
        metalness: surface.metalness,
        transmission: surface.transmission,
        thickness: surface.thickness,
        ior: surface.ior,
        clearcoat: surface.transmission ? 0.35 : 0.1,
        clearcoatRoughness: 0.25,
    });
}

/** Own clones so interaction and disposal never mutate cached GLTF materials. */
export function shadedMaterial(source: THREE.Material, color: Vec3, authored: boolean) {
    // Retain the existing palette fallback for STL scenes without material metadata.
    const metal = color[0] > 0.6 && color[0] < 0.75;
    const material = authored ? source.clone() : surfaceMaterial({
        color, roughness: metal ? 0.28 : 0.48, metalness: metal ? 0.8 : 0,
        transmission: 0, thickness: 0, ior: 1.5,
    });
    material.userData.baseOpacity = material.opacity;
    material.userData.baseDepthWrite = material.depthWrite;
    material.userData.baseTransparent = material.transparent;
    if (material instanceof THREE.MeshStandardMaterial) material.userData.baseEmissive = material.emissive.toArray();
    return material;
}

export function fadeMaterial(material: THREE.Material, active: boolean) {
    const base = material.userData.baseOpacity ?? 1;
    material.opacity += ((active ? base : base * 0.16) - material.opacity) * 0.2;
    material.depthWrite = (material.userData.baseDepthWrite ?? true) && material.opacity >= base * 0.9;
    // Opaque components must enter the transmission buffer so they remain
    // visible through plastic/glass. Only switch to blending during selection fades.
    const transparent = (material.userData.baseTransparent ?? material.transparent) || material.opacity < base * 0.999;
    if (transparent !== material.transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
    }
}
