// three.js viewer for compiled ARBI scenes and single parts. Client-only: needs the DOM and WebGL.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import type { MeshRef, Scene, ScenePart, Vec3 } from "@/lib/types";

const DATA = "/data/";

export type ViewerStyle = "light" | "line" | "ink";
type Drawing = { face: number; edge: number; hoverFace: number; hoverEdge: number };
type Entry = { object: THREE.Object3D; part: ScenePart; meshes: THREE.Mesh[] };
export type Anchor = { part: ScenePart; x: number; y: number };

// light: shaded product palette. line: booklet line art (white faces, dark edges).
// ink: line art for black sections that keeps each part's product role readable.
// Line art shows exact flat colors, so its materials skip tone mapping.
const ENV: Record<ViewerStyle, number> = { light: 0.9, line: 0, ink: 0 };
const LINE: Drawing = { face: 0xffffff, edge: 0x111111, hoverFace: 0x161616, hoverEdge: 0xffffff };
// Neutral (untinted) grays and pure white so roles read as product colors, not tints.
const INK: Record<"white" | "metal" | "dark", Drawing> = {
    white: { face: 0xffffff, edge: 0x111111, hoverFace: 0x1a1a1a, hoverEdge: 0xffffff },
    metal: { face: 0x9a9a9a, edge: 0x111111, hoverFace: 0xffffff, hoverEdge: 0x0b0b0b },
    dark: { face: 0x5a5a5a, edge: 0xe0e0e0, hoverFace: 0xffffff, hoverEdge: 0x0b0b0b },
};

function drawing(color: Vec3, style: ViewerStyle): Drawing {
    if (style === "line") return LINE;
    const [r, g, b] = color;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance >= 0.8 ? INK.white : luminance >= 0.5 ? INK.metal : INK.dark;
}

function partMaterial(color: Vec3, style: ViewerStyle): THREE.MeshBasicMaterial | THREE.MeshStandardMaterial {
    if (style !== "light")
        return new THREE.MeshBasicMaterial({
            color: drawing(color, style).face,
            toneMapped: false,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
            transparent: true,
        });
    const metal = color[0] > 0.6 && color[0] < 0.75;
    return new THREE.MeshStandardMaterial({
        color: new THREE.Color().setRGB(...color, THREE.SRGBColorSpace),
        roughness: metal ? 0.35 : 0.62,
        metalness: metal ? 0.7 : 0,
        transparent: true,
    });
}

// trimesh GLBs carry no normals; crease at 30° so flat faces stay crisp.
const normalCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function withNormals(g: THREE.BufferGeometry) {
    if (g.attributes.normal) return g;
    if (!normalCache.has(g)) normalCache.set(g, toCreasedNormals(g, Math.PI / 6));
    return normalCache.get(g)!;
}
const edgeCache = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>();
function edgesOf(g: THREE.BufferGeometry) {
    if (!edgeCache.has(g)) edgeCache.set(g, new THREE.EdgesGeometry(g, 28));
    return edgeCache.get(g)!;
}
const stlCache = new Map<string, Promise<THREE.BufferGeometry>>();
function loadSTL(url: string) {
    if (!stlCache.has(url)) stlCache.set(url, new STLLoader().loadAsync(DATA + url));
    return stlCache.get(url)!;
}
const glbCache = new Map<string, Promise<GLTF>>();
function loadGLB(url: string) {
    if (!glbCache.has(url)) glbCache.set(url, new GLTFLoader().loadAsync(DATA + url));
    return glbCache.get(url)!;
}

type Events = { pick: (part: ScenePart) => void; hover: (part: ScenePart | null) => void; frame: () => void };

export class Viewer {
    readonly renderer: THREE.WebGLRenderer;
    readonly camera: THREE.PerspectiveCamera;
    readonly controls: OrbitControls;
    hovered: Entry | null = null;
    focus: string | null = null;
    explode = 0;
    target = 0;
    private parts: Entry[] = [];
    private scene = new THREE.Scene();
    private root = new THREE.Group();
    private raycaster = new THREE.Raycaster();
    private pointer = new THREE.Vector2(9, 9);
    private listeners: { [K in keyof Events]: Events[K][] } = { pick: [], hover: [], frame: [] };
    private resizeObserver: ResizeObserver;
    private visibility: IntersectionObserver;
    private visible = true;
    private running = true;

    constructor(
        private el: HTMLElement,
        private options: { style?: ViewerStyle; autoRotate?: boolean; fov?: number; interactive?: boolean; zoom?: boolean } = {},
    ) {
        const style = (this.options.style ??= "light");
        const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
        r.setPixelRatio(Math.min(devicePixelRatio, 2));
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.toneMapping = THREE.NeutralToneMapping;
        r.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:none";
        el.appendChild(r.domElement);
        if (ENV[style]) {
            this.scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
            this.scene.environmentIntensity = ENV[style];
        }
        const key = new THREE.DirectionalLight(0xffffff, 1.1);
        key.position.set(1, -1.4, 2.2);
        this.scene.add(key, new THREE.AmbientLight(0xffffff, 0.35), this.root);
        this.camera = new THREE.PerspectiveCamera(options.fov ?? 28, 1, 1, 20000);
        this.camera.up.set(0, 0, 1);
        this.controls = new OrbitControls(this.camera, r.domElement);
        this.controls.enableDamping = true;
        this.controls.autoRotate = options.autoRotate ?? false;
        this.controls.autoRotateSpeed = 0.6;
        this.controls.enabled = options.interactive ?? true;
        this.controls.enableZoom = options.zoom ?? true;
        if (this.controls.enabled) this.bindPointer();
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(el);
        // Pause rendering while the canvas is scrolled out of view.
        this.visibility = new IntersectionObserver(([entry]) => (this.visible = entry.isIntersecting));
        this.visibility.observe(el);
        this.resize();
        const tick = () => {
            if (!this.running) return;
            requestAnimationFrame(tick);
            if (this.visible) this.render();
        };
        tick();
    }

    on<K extends keyof Events>(event: K, fn: Events[K]) {
        this.listeners[event].push(fn);
        return this;
    }

    dispose() {
        this.running = false;
        this.resizeObserver.disconnect();
        this.visibility.disconnect();
        this.controls.dispose();
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }

    private resize() {
        const { clientWidth: w, clientHeight: h } = this.el;
        if (!w || !h) return;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    private bindPointer() {
        const dom = this.renderer.domElement;
        let down: [number, number] | null = null;
        dom.addEventListener("pointermove", (e) => {
            const b = dom.getBoundingClientRect();
            this.pointer.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
        });
        dom.addEventListener("pointerleave", () => this.pointer.set(9, 9));
        dom.addEventListener("pointerdown", (e) => (down = [e.clientX, e.clientY]));
        dom.addEventListener("pointerup", (e) => {
            if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5 && this.hovered)
                this.listeners.pick.forEach((f) => f(this.hovered!.part));
        });
    }

    private addPart(object: THREE.Object3D, part: ScenePart) {
        const style = this.options.style!;
        object.userData.base = object.position.clone();
        object.userData.offset = new THREE.Vector3(...part.explode);
        const meshes: THREE.Mesh[] = [];
        object.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
        });
        for (const m of meshes) {
            m.geometry = withNormals(m.geometry);
            m.material = partMaterial(part.color, style);
            if (style !== "light") {
                const d = drawing(part.color, style);
                m.userData.draw = d;
                const edges = new THREE.LineSegments(edgesOf(m.geometry), new THREE.LineBasicMaterial({ color: d.edge, toneMapped: false, transparent: true }));
                edges.raycast = () => {};
                m.add(edges);
            }
        }
        const entry: Entry = { object, part, meshes };
        meshes.forEach((m) => (m.userData.entry = entry));
        this.parts.push(entry);
        this.root.add(object);
    }

    /** Load a compiled scene; exploded offsets come from the booklet renderer's exploded figures. */
    async loadScene(scene: Scene) {
        if (scene.kind === "glb") {
            const gltf = await loadGLB(scene.glb!);
            const copy = gltf.scene.clone(true);
            const byNode = new Map(scene.parts.map((p) => [p.node, p]));
            for (const node of [...copy.children]) {
                const part = byNode.get(node.name);
                if (!part) continue;
                node.removeFromParent();
                const wrap = new THREE.Group();
                wrap.scale.setScalar(1000); // GLB nodes carry metres; manifests use mm.
                wrap.add(node);
                this.addPart(wrap, part);
            }
        } else {
            const geometries = await Promise.all(scene.parts.map((p) => loadSTL(p.url!)));
            scene.parts.forEach((p, i) => {
                const mesh = new THREE.Mesh(geometries[i]);
                mesh.applyMatrix4(new THREE.Matrix4().set(...(p.matrix!.flat() as Parameters<THREE.Matrix4["set"]>)));
                this.addPart(mesh, p);
            });
        }
        this.frame();
    }

    /** Load one part, centred; returns its envelope in mm. */
    async loadModel(mesh: MeshRef, model: string, color: Vec3) {
        let obj: THREE.Object3D;
        if (mesh.kind === "glb") {
            const gltf = await loadGLB(mesh.glb);
            const node = gltf.scene.getObjectByName(mesh.node)!.clone(true);
            node.position.set(0, 0, 0);
            obj = new THREE.Group();
            obj.scale.setScalar(1000);
            obj.add(node);
        } else {
            obj = new THREE.Mesh(await loadSTL(mesh.url));
        }
        const box = new THREE.Box3().setFromObject(obj);
        obj.position.sub(box.getCenter(new THREE.Vector3()));
        const holder = new THREE.Group();
        holder.add(obj);
        this.addPart(holder, { node: model, model, color, registered: true, group: "fixed", explode: [0, 0, 0] });
        this.frame({ distance: 0.78 });
        return box.getSize(new THREE.Vector3());
    }

    get canExplode() {
        return this.parts.some((e) => (e.object.userData.offset as THREE.Vector3).lengthSq() > 0);
    }

    private pose(t: number) {
        for (const e of this.parts) e.object.position.copy(e.object.userData.base).addScaledVector(e.object.userData.offset, t);
    }

    /** distance 1 = the bounding sphere exactly fits the narrower field of view. */
    frame({ distance = 1, azimuth = -0.62, elevation = 0.42 } = {}) {
        // Fit the pose the explode animation is heading to, not the current frame.
        this.pose(this.target);
        const sphere = new THREE.Box3().setFromObject(this.root).getBoundingSphere(new THREE.Sphere());
        this.pose(this.explode);
        const vfov = THREE.MathUtils.degToRad(this.camera.fov);
        const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
        const d = (sphere.radius / Math.sin(Math.min(vfov, hfov) / 2)) * distance;
        const c = sphere.center;
        this.camera.position.set(
            c.x + d * Math.cos(elevation) * Math.sin(azimuth),
            c.y - d * Math.cos(elevation) * Math.cos(azimuth),
            c.z + d * Math.sin(elevation),
        );
        this.camera.near = d / 100;
        this.camera.far = d * 10;
        this.camera.updateProjectionMatrix();
        this.controls.target.copy(c);
        this.controls.update();
    }

    setExplode(t: number) {
        this.target = t;
    }

    /** Snap to the target pose without animating. */
    settle() {
        this.explode = this.target;
        this.pose(this.explode);
    }

    setFocus(model: string | null) {
        this.focus = model;
    }

    /** Screen-space anchors for labels: one per registered model (first instance). */
    anchors(): Anchor[] {
        const seen = new Set<string>();
        const out: Anchor[] = [];
        const w = this.renderer.domElement.clientWidth;
        const h = this.renderer.domElement.clientHeight;
        for (const e of this.parts) {
            if (!e.part.registered || seen.has(e.part.model)) continue;
            seen.add(e.part.model);
            const v = new THREE.Box3().setFromObject(e.object).getCenter(new THREE.Vector3()).project(this.camera);
            out.push({ part: e.part, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h });
        }
        return out;
    }

    private render() {
        this.explode += (this.target - this.explode) * 0.08;
        this.pose(this.explode);
        this.controls.update();
        let hit: Entry | null = null;
        if (this.pointer.x < 2 && this.controls.enabled) {
            this.raycaster.setFromCamera(this.pointer, this.camera);
            const hits = this.raycaster.intersectObjects(this.parts.flatMap((e) => e.meshes), false);
            hit = (hits[0]?.object.userData.entry as Entry | undefined) ?? null;
        }
        if (hit !== this.hovered) {
            this.hovered = hit;
            this.renderer.domElement.style.cursor = hit ? "pointer" : "grab";
            this.listeners.hover.forEach((f) => f(hit?.part ?? null));
        }
        const active = this.hovered?.part.model ?? this.focus;
        for (const e of this.parts) {
            const on = !active || e.part.model === active;
            const hot = this.hovered === e;
            for (const m of e.meshes) {
                const mat = m.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
                mat.opacity += ((on ? 1 : 0.16) - mat.opacity) * 0.2;
                mat.depthWrite = mat.opacity > 0.9;
                const d = m.userData.draw as Drawing | undefined;
                if (d) mat.color.setHex(hot ? d.hoverFace : d.face);
                else if ("emissive" in mat) mat.emissive.setHex(this.hovered && e.part.model === this.hovered.part.model ? 0x111111 : 0x000000);
                const line = m.children[0] as THREE.LineSegments | undefined;
                if (line && d) {
                    const lm = line.material as THREE.LineBasicMaterial;
                    lm.opacity = mat.opacity;
                    lm.color.setHex(hot ? d.hoverEdge : d.edge);
                }
            }
        }
        this.renderer.render(this.scene, this.camera);
        this.listeners.frame.forEach((f) => f());
    }
}

export type PlacedCallout = Anchor & { side: "left" | "right"; lx: number; ly: number };

/** Exploded-diagram callouts: two columns sorted by height and spaced so labels never overlap. */
export function layoutCallouts(anchors: Anchor[], width: number, { gap = 34, margin = 40, spread = 0.12 } = {}): PlacedCallout[] {
    if (!anchors.length) return [];
    const cx = anchors.reduce((s, a) => s + a.x, 0) / anchors.length;
    const minX = Math.min(...anchors.map((a) => a.x));
    const maxX = Math.max(...anchors.map((a) => a.x));
    const sides: Record<"left" | "right", Anchor[]> = { left: [], right: [] };
    [...anchors].sort((a, b) => a.y - b.y).forEach((a, i) => sides[a.x < cx || (a.x === cx && i % 2) ? "left" : "right"].push(a));
    const out: PlacedCallout[] = [];
    for (const side of ["left", "right"] as const) {
        let last = -Infinity;
        const x = side === "left" ? Math.max(margin, minX - width * spread) : Math.min(width - margin, maxX + width * spread);
        for (const a of sides[side]) {
            const y = Math.max(a.y, last + gap);
            last = y;
            out.push({ ...a, side, lx: x, ly: y });
        }
    }
    return out;
}
