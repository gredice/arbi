import * as THREE from "three";

/** A Z-up product studio, fitted to the CAD bounds in millimetres. */
export class StudioLighting extends THREE.Group {
    private key = new THREE.DirectionalLight(0xfff5e8, 3);
    private fill = new THREE.DirectionalLight(0xe8efff, 0.8);
    private rim = new THREE.DirectionalLight(0xffffff, 1.8);
    private floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ color: 0x28303a, opacity: 0.22, depthWrite: false }));

    constructor() {
        super();
        const ambient = new THREE.HemisphereLight(0xffffff, 0x545b66, 0.3);
        ambient.position.set(0, 0, 1);
        this.key.castShadow = true;
        this.key.shadow.mapSize.set(2048, 2048);
        this.key.shadow.radius = 4;
        this.key.shadow.bias = -0.0001;
        // Only the shadow is visible, so the studio blends into the manual page.
        this.floor.receiveShadow = true;
        this.floor.raycast = () => {};
        this.visible = false;
        this.add(ambient, this.key, this.fill, this.rim, this.key.target, this.fill.target, this.rim.target, this.floor);
    }

    fit(bounds: THREE.Box3) {
        if (bounds.isEmpty()) return;
        const center = bounds.getCenter(new THREE.Vector3());
        const radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 0.01);
        for (const [light, direction] of [
            [this.key, [-1.5, -1.8, 2.8]],
            [this.fill, [2, -0.5, 1.2]],
            [this.rim, [0.8, 2, 2.2]],
        ] as const) {
            light.position.copy(center).addScaledVector(new THREE.Vector3(...direction), radius);
            light.target.position.copy(center);
        }
        const camera = this.key.shadow.camera;
        // Fit the model and its projected floor shadow, never the decorative floor.
        const extent = radius * 2;
        camera.left = camera.bottom = -extent;
        camera.right = camera.top = extent;
        camera.near = radius * 0.1;
        camera.far = radius * 8;
        camera.up.set(0, 0, 1);
        camera.updateProjectionMatrix();
        this.key.shadow.normalBias = radius * 0.001;
        this.floor.position.set(center.x, center.y, bounds.min.z - radius * 0.002);
        this.floor.scale.setScalar(radius * 10);
        this.visible = true;
    }

    dispose() {
        this.key.shadow.dispose();
        this.floor.geometry.dispose();
        this.floor.material.dispose();
        this.removeFromParent();
    }
}
