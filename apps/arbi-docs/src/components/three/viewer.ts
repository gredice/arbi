// three.js viewer for compiled ARBI scenes and single parts. Client-only: needs the DOM and WebGL.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import type { MeshRef, Scene, ScenePart, Vec3 } from "@/lib/types";
import { OutlineGeometry } from "./outlines";
import { configurePageControls } from "./page-controls";
import { StudioLighting } from "./studio-lighting";

const DATA = "/data/";

export type ViewerStyle = "light" | "line" | "ink";
type Drawing = { face: number; edge: number; hoverFace: number; hoverEdge: number };
type Entry = { object: THREE.Object3D; part: ScenePart; meshes: THREE.Mesh[] };
type Suspension = {
    entry: Entry;
    lines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    anchors: THREE.Vector3[];
    directions: THREE.Vector3[];
};
export type Anchor = { part: ScenePart; x: number; y: number };

// light: shaded product palette. line: booklet line art (white faces, dark edges).
// ink: line art for black sections that keeps each part's product role readable.
// Line art shows exact flat colors, so its materials skip tone mapping.
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
    return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color().setRGB(...color, THREE.SRGBColorSpace),
        roughness: metal ? 0.28 : 0.48,
        metalness: metal ? 0.8 : 0,
        clearcoat: metal ? 0 : 0.16,
        clearcoatRoughness: 0.4,
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
    private suspension?: Suspension;
    private studio?: StudioLighting;
    private environment?: THREE.WebGLRenderTarget;
    private composer?: EffectComposer;
    private occlusion?: GTAOPass;
    private antialias?: ShaderPass;
    private raycaster = new THREE.Raycaster();
    private pointer = new THREE.Vector2(9, 9);
    private localCamera = new THREE.Vector3();
    private inverseWorld = new THREE.Matrix4();
    private listeners: { [K in keyof Events]: Events[K][] } = { pick: [], hover: [], frame: [] };
    private resizeObserver: ResizeObserver;
    private visibility: IntersectionObserver;
    private visible = true;
    private running = true;

    constructor(
        private el: HTMLElement,
        private options: { style?: ViewerStyle; autoRotate?: boolean; fov?: number; interactive?: boolean; animate?: boolean; outlineOpacity?: number } = {},
    ) {
        const style = (this.options.style ??= "light");
        const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
        r.setPixelRatio(Math.min(devicePixelRatio, style === "light" ? 1.5 : 2));
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.toneMapping = style === "light" ? THREE.ACESFilmicToneMapping : THREE.NeutralToneMapping;
        r.domElement.style.cssText = "width:100%;height:100%;display:block";
        el.appendChild(r.domElement);
        if (style === "light") {
            const room = new RoomEnvironment();
            const pmrem = new THREE.PMREMGenerator(r);
            this.environment = pmrem.fromScene(room, 0.04);
            room.dispose();
            pmrem.dispose();
            this.scene.environment = this.environment.texture;
            this.scene.environmentIntensity = 0.35;
            this.scene.environmentRotation.set(Math.PI / 2, 0, 0);
            r.shadowMap.enabled = true;
            r.shadowMap.type = THREE.PCFShadowMap;
            // Orbiting changes the view, not the light or model: reuse its shadow map.
            r.shadowMap.autoUpdate = false;
            this.studio = new StudioLighting();
            this.scene.add(this.studio);
        }
        this.scene.add(this.root);
        this.camera = new THREE.PerspectiveCamera(options.fov ?? 28, 1, 1, 20000);
        this.camera.up.set(0, 0, 1);
        if (style === "light") {
            this.composer = new EffectComposer(r, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
            this.occlusion = new GTAOPass(this.scene, this.camera);
            this.occlusion.blendIntensity = 0.85;
            this.occlusion.updateGtaoMaterial({ samples: 16, distanceExponent: 1, distanceFallOff: 1 });
            this.antialias = new ShaderPass(FXAAShader);
            this.composer.addPass(new RenderPass(this.scene, this.camera));
            this.composer.addPass(this.occlusion);
            this.composer.addPass(new OutputPass());
            this.composer.addPass(this.antialias);
        }
        this.controls = new OrbitControls(this.camera, r.domElement);
        this.controls.enableDamping = true;
        this.controls.autoRotate = options.autoRotate ?? false;
        this.controls.autoRotateSpeed = 0.6;
        this.controls.enabled = options.interactive ?? true;
        configurePageControls(this.controls);
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
        if (options.animate !== false) tick();
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
        this.suspension?.lines.geometry.dispose();
        this.suspension?.lines.material.dispose();
        for (const e of this.parts) for (const m of e.meshes) {
            (m.material as THREE.Material).dispose();
            const line = m.children[0] as THREE.LineSegments<OutlineGeometry, THREE.LineBasicMaterial> | undefined;
            if (line?.geometry instanceof OutlineGeometry) {
                line.geometry.dispose();
                line.material.dispose();
            }
        }
        this.studio?.dispose();
        this.environment?.dispose();
        if (this.composer) {
            for (const pass of this.composer.passes) pass.dispose();
            // GTAOPass does not release these two shader materials itself.
            this.occlusion!.gtaoMaterial.dispose();
            this.occlusion!.blendMaterial.dispose();
            this.composer.dispose();
        }
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }

    private resize() {
        const { clientWidth: w, clientHeight: h } = this.el;
        if (!w || !h) return;
        this.renderer.setSize(w, h, false);
        if (this.composer) {
            this.composer.setSize(w, h);
            // Bound AO cost independently of screen size and device pixel ratio.
            const scale = Math.min(this.renderer.getPixelRatio(), 960 / Math.max(w, h));
            this.occlusion!.setSize(Math.round(w * scale), Math.round(h * scale));
            const pixels = this.renderer.getDrawingBufferSize(new THREE.Vector2());
            this.antialias!.uniforms.resolution.value.set(1 / pixels.x, 1 / pixels.y);
        }
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        if (this.options.animate === false && this.parts.length) {
            this.frame({ distance: 1.04 });
        }
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
            m.castShadow = m.receiveShadow = style === "light";
            if (style !== "light") {
                const d = drawing(part.color, style);
                m.userData.draw = d;
                const edges = new THREE.LineSegments(new OutlineGeometry(m.geometry), new THREE.LineBasicMaterial({ color: d.edge, toneMapped: false, transparent: true }));
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
            if (!this.running) return;
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
            if (!this.running) return;
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
        if (!this.running) return box.getSize(new THREE.Vector3());
        obj.position.sub(box.getCenter(new THREE.Vector3()));
        const holder = new THREE.Group();
        holder.add(obj);
        this.addPart(holder, { node: model, model, color, registered: true, href: `/parts/${model}`, group: "fixed", explode: [0, 0, 0] });
        this.frame({ distance: this.options.style === "light" ? 1.04 : 0.78 });
        return box.getSize(new THREE.Vector3());
    }

    get canExplode() {
        return this.parts.some((e) => (e.object.userData.offset as THREE.Vector3).lengthSq() > 0);
    }

    /** Schematic cables from assembled attachment points in mm; excluded from CAD camera fitting. */
    addSuspensionLines(model: string, points: Vec3[]) {
        const entry = this.parts.find((e) => e.part.model === model);
        if (!entry || !this.running) return;
        if (this.suspension) {
            this.suspension.lines.removeFromParent();
            this.suspension.lines.geometry.dispose();
            this.suspension.lines.material.dispose();
        }
        const anchors = points.map((p) => new THREE.Vector3(...p));
        const directions = anchors.map((p) => new THREE.Vector3(p.x, p.y, 0).normalize().multiplyScalar(0.55).setZ(1));
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(points.length * 6), 3));
        const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xe0e0e0, toneMapped: false, transparent: true, opacity: 0.8 }));
        // Endpoints extend beyond the view and update with the camera's far plane.
        lines.frustumCulled = false;
        lines.raycast = () => {};
        this.suspension = { entry, lines, anchors, directions };
        this.scene.add(lines);
    }

    private updateSuspension(active: string | null) {
        if (!this.suspension) return;
        const { entry, lines, anchors, directions } = this.suspension;
        const positions = lines.geometry.getAttribute("position");
        const offset = entry.object.userData.offset as THREE.Vector3;
        const start = new THREE.Vector3();
        const end = new THREE.Vector3();
        const direction = new THREE.Vector3();
        anchors.forEach((anchor, i) => {
            start.copy(anchor).addScaledVector(offset, this.explode).applyMatrix4(this.root.matrixWorld);
            direction.copy(directions[i]).transformDirection(this.root.matrixWorld);
            end.copy(start).addScaledVector(direction, this.camera.far * 2);
            positions.setXYZ(i * 2, start.x, start.y, start.z);
            positions.setXYZ(i * 2 + 1, end.x, end.y, end.z);
        });
        positions.needsUpdate = true;
        lines.material.opacity += ((!active || active === entry.part.model ? 0.8 : 0.16) - lines.material.opacity) * 0.2;
    }

    private pose(t: number) {
        for (const e of this.parts) e.object.position.copy(e.object.userData.base).addScaledVector(e.object.userData.offset, t);
    }

    /** distance 1 = the bounding sphere exactly fits the narrower field of view. */
    frame({ distance = 1, azimuth = -0.62, elevation = 0.42 } = {}) {
        // Fit the pose the explode animation is heading to, not the current frame.
        this.pose(this.target);
        const bounds = new THREE.Box3().setFromObject(this.root);
        const sphere = bounds.getBoundingSphere(new THREE.Sphere());
        this.studio?.fit(bounds);
        this.renderer.shadowMap.needsUpdate = true;
        if (this.occlusion) {
            this.occlusion.updateGtaoMaterial({ radius: sphere.radius * 0.12, thickness: sphere.radius * 0.04 });
        }
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
        if (this.options.animate === false) this.render();
    }

    setExplode(t: number) {
        this.target = t;
    }

    /** Snap to the target pose without animating. */
    settle() {
        this.explode = this.target;
        this.pose(this.explode);
        this.renderer.shadowMap.needsUpdate = true;
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
        const previousPose = this.explode;
        this.explode += (this.target - this.explode) * 0.08;
        if (this.explode !== previousPose) this.renderer.shadowMap.needsUpdate = true;
        this.pose(this.explode);
        this.controls.update();
        this.scene.updateMatrixWorld(true);
        let hit: Entry | null = null;
        if (this.pointer.x < 2 && this.controls.enabled) {
            this.raycaster.setFromCamera(this.pointer, this.camera);
            const hits = this.raycaster.intersectObjects(this.parts.flatMap((e) => e.meshes), false);
            hit = (hits[0]?.object.userData.entry as Entry | undefined) ?? null;
        }
        if (hit !== this.hovered) {
            this.hovered = hit;
            this.renderer.domElement.style.cursor = hit?.part.href ? "pointer" : "grab";
            this.listeners.hover.forEach((f) => f(hit?.part ?? null));
        }
        const active = this.hovered?.part.model ?? this.focus;
        this.updateSuspension(active);
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
                const line = m.children[0] as THREE.LineSegments<OutlineGeometry, THREE.LineBasicMaterial> | undefined;
                if (line && d) {
                    this.localCamera.copy(this.camera.position).applyMatrix4(this.inverseWorld.copy(m.matrixWorld).invert());
                    line.geometry.update(this.localCamera);
                    const lm = line.material;
                    lm.opacity = mat.opacity * (this.options.outlineOpacity ?? 1);
                    lm.color.setHex(hot ? d.hoverEdge : d.edge);
                }
            }
        }
        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
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
