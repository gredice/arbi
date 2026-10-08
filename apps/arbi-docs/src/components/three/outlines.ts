import * as THREE from "three";

const FEATURE_ANGLE = 28;
type Topology = { features: Float32Array; segments: Float32Array; planes: Float64Array };
const topologyCache = new WeakMap<THREE.BufferGeometry, Topology>();

/** Share mesh adjacency, but keep each instance's camera-dependent lines separate. */
function topologyOf(source: THREE.BufferGeometry): Topology {
    const cached = topologyCache.get(source);
    if (cached) return cached;
    const features = new THREE.EdgesGeometry(source, FEATURE_ANGLE);
    const featurePositions = new Float32Array(features.getAttribute("position").array);
    features.dispose();

    const position = source.getAttribute("position");
    const index = source.getIndex();
    const triangle = new THREE.Triangle();
    const vertices = [triangle.a, triangle.b, triangle.c];
    const normal = new THREE.Vector3();
    const threshold = Math.cos(THREE.MathUtils.degToRad(FEATURE_ANGLE));
    const edges = new Map<string, { normal: THREE.Vector3; offset: number } | null>();
    const segments: number[] = [];
    const planes: number[] = [];
    // Match EdgesGeometry's positional welding for indexed GLBs and triangle-soup STLs.
    const hash = (v: THREE.Vector3) => `${Math.round(v.x * 1e4)},${Math.round(v.y * 1e4)},${Math.round(v.z * 1e4)}`;
    for (let i = 0, count = index?.count ?? position.count; i < count; i += 3) {
        vertices.forEach((v, j) => v.fromBufferAttribute(position, index ? index.getX(i + j) : i + j));
        const hashes = vertices.map(hash);
        if (new Set(hashes).size < 3) continue;
        triangle.getNormal(normal);
        if (!normal.lengthSq()) continue;
        const offset = normal.dot(triangle.a);
        for (let j = 0; j < 3; j++) {
            const next = (j + 1) % 3;
            const key = [hashes[j], hashes[next]].sort().join("_");
            if (!edges.has(key)) {
                edges.set(key, { normal: normal.clone(), offset });
                continue;
            }
            const other = edges.get(key);
            const dot = other ? normal.dot(other.normal) : 1;
            // Coplanar triangulation can never form a silhouette.
            if (other && dot > threshold && dot < 1 - 1e-10) {
                const a = vertices[j], b = vertices[next];
                segments.push(a.x, a.y, a.z, b.x, b.y, b.z);
                planes.push(other.normal.x, other.normal.y, other.normal.z, other.offset, normal.x, normal.y, normal.z, offset);
            }
            edges.set(key, null);
        }
    }
    const topology = { features: featurePositions, segments: new Float32Array(segments), planes: new Float64Array(planes) };
    topologyCache.set(source, topology);
    return topology;
}

/** Feature edges plus smooth edges separating front-facing and back-facing triangles. */
export class OutlineGeometry extends THREE.BufferGeometry {
    private topology: Topology;
    private positions: Float32Array;
    private lastCamera = new THREE.Vector3(Infinity, Infinity, Infinity);

    constructor(source: THREE.BufferGeometry) {
        super();
        this.topology = topologyOf(source);
        const { features, segments } = this.topology;
        this.positions = new Float32Array(features.length + segments.length);
        this.positions.set(features);
        this.setAttribute("position", new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
        this.setDrawRange(0, features.length / 3);
        if (!source.boundingSphere) source.computeBoundingSphere();
        this.boundingSphere = source.boundingSphere!.clone();
    }

    /** Camera position in the mesh's local frame handles perspective, rotation and exploded poses. */
    update(camera: THREE.Vector3) {
        if (this.lastCamera.equals(camera)) return;
        this.lastCamera.copy(camera);
        const { features, segments, planes } = this.topology;
        let end = features.length;
        for (let i = 0, segment = 0; i < planes.length; i += 8, segment += 6) {
            const a = planes[i] * camera.x + planes[i + 1] * camera.y + planes[i + 2] * camera.z - planes[i + 3];
            const b = planes[i + 4] * camera.x + planes[i + 5] * camera.y + planes[i + 6] * camera.z - planes[i + 7];
            if ((a >= 0) === (b >= 0)) continue;
            for (let j = 0; j < 6; j++) this.positions[end++] = segments[segment + j];
        }
        this.setDrawRange(0, end / 3);
        if (end > features.length) {
            const position = this.getAttribute("position") as THREE.BufferAttribute;
            position.clearUpdateRanges();
            position.addUpdateRange(features.length, end - features.length);
            position.needsUpdate = true;
        }
    }
}
