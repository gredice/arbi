// Shared data + 3D layer for the ARBI website mockups.
// Reads only ./data (compiled by prepare.py from committed repository sources).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const DATA = new URL('../data/', import.meta.url).href;
export const SCENES = { 'camera-pod': 'pod', winch: 'winch' };
const json = (path) => fetch(DATA + path).then((r) => r.json());

// ---------------------------------------------------------------- data

let sitePromise;
export function loadSite() {
  sitePromise ??= (async () => {
    const [site, pod, winch] = await Promise.all([json('site.json'), json('pod/parts.json'), json('winch/parts.json')]);
    const scenes = { pod, winch };
    const models = site.registry.models;
    const modelById = Object.fromEntries(models.map((m) => [m.id, m]));
    const bomById = Object.fromEntries(site.bom.parts.map((p) => [p.id, p]));
    const slugOf = (path) => path.match(/assemblies\/([^/]+)\//)?.[1];
    const goods = Object.fromEntries(site.bom.summary.assemblyKnownGoods.map((g) => [g.assemblyId, g.amount]));
    const systems = site.bom.assemblies
      .filter((a) => a.kind === 'physical')
      .map((a) => {
        const slug = slugOf(a.documentation);
        const scene = SCENES[slug];
        return {
          ...a, slug, scene,
          models: models.filter((m) => m.assembly === slug),
          goods: goods[a.id] ?? null,
          doc: site.docs.find((d) => d.path === a.documentation),
          hero: scene === 'pod' ? 'pod/figures/assembled-covered.png' : scene === 'winch' ? 'winch/figures/cover-passive-installed.png' : null,
          exploded: scene === 'pod' ? 'pod/figures/enclosure-exploded.png' : scene === 'winch' ? 'winch/figures/cover-passive-exploded.png' : null,
        };
      });
    const systemBySlug = Object.fromEntries(systems.map((s) => [s.slug, s]));
    // Instances of each model inside the compiled scenes.
    const instances = {};
    for (const [key, sc] of Object.entries(scenes))
      for (const p of sc.parts) (instances[p.model] ??= { scene: key, count: 0, parts: [] }), instances[p.model].count++, instances[p.model].parts.push(p);
    const figureFor = (id) => {
      for (const [key, sc] of Object.entries(scenes)) {
        for (const name of [`part-${id}`, `part-${id.replace(/^winch-/, '')}`])
          if (sc.figures.includes(name)) return `${key}/figures/${name}.png`;
      }
      return null;
    };
    const meshFor = (id) => {
      const m = modelById[id];
      const inst = instances[id];
      if (inst?.scene === 'pod') return { kind: 'glb', node: inst.parts[0].node };
      if (m && m.output.endsWith('.stl') && (m.assembly === 'winch')) return { kind: 'stl', url: `winch/models/arbi/${m.output}` };
      if (inst?.scene === 'winch') return { kind: 'stl', url: `winch/${inst.parts[0].file}` };
      return null;
    };
    const bomForModel = (m) => (m?.bomPartIds ?? []).map((id) => bomById[id]).filter(Boolean);
    const modelsForBomPart = (id) => models.filter((m) => m.bomPartIds.includes(id));
    return { site, scenes, models, modelById, bomById, systems, systemBySlug, instances, figureFor, meshFor, bomForModel, modelsForBomPart };
  })();
  return sitePromise;
}

// ---------------------------------------------------------------- formatting + links

export const fmt = {
  eur: (v) => (v == null ? 'unknown' : `€${Number(v).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
  bytes: (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`),
  pad: (n, w = 2) => String(n).padStart(w, '0'),
  title: (id) => id.replace(/-/g, ' ').replace(/\b(r\d)/, '$1'),
  status: (s) => ({ 'concept-unvalidated': 'Concept · unvalidated', 'baseline-selected': 'Baseline selected', unresolved: 'Unresolved', approved: 'Approved', candidate: 'Candidate' }[s] ?? s ?? '—'),
};

export const links = {
  source: (path) => `https://github.com/gredice/arbi/blob/main/${path}`,
  raw: (path) => `https://github.com/gredice/arbi/raw/main/${path}`,
  release: (file) => `https://github.com/gredice/arbi/releases/latest/download/${file}`,
  releases: 'https://github.com/gredice/arbi/releases',
  commit: (sha) => `https://github.com/gredice/arbi/commit/${sha}`,
};

// Tiny hash router: #/path/segments
export function router(routes, render) {
  const run = () => {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const key = parts[0] ?? '';
    const handler = routes[key] ?? routes['*'];
    window.scrollTo({ top: 0 });
    render(handler, parts.slice(1));
  };
  addEventListener('hashchange', run);
  run();
}

// Markdown docs rendered from repository text bundled by prepare.py.
let docsPromise;
export async function renderDoc(path) {
  const { marked } = await import('https://cdn.jsdelivr.net/npm/marked@14.1.4/lib/marked.esm.js');
  docsPromise ??= json('docs.json');
  const text = (await docsPromise)[path] ?? `# Not found\n\n${path}`;
  const base = path.split('/').slice(0, -1);
  const resolve = (href) => {
    const out = [...base];
    for (const seg of href.split('/')) seg === '..' ? out.pop() : seg !== '.' && out.push(seg);
    return out.join('/');
  };
  const renderer = new marked.Renderer();
  renderer.link = ({ href, text }) => {
    if (/^https?:/.test(href)) return `<a href="${href}" target="_blank" rel="noreferrer">${text}</a>`;
    if (href.startsWith('#')) return `<a href="#/docs/${path}">${text}</a>`;
    const [file] = href.split('#');
    const target = resolve(file);
    if (/^(docs|hardware)\/.*\.md$|^bom\/README\.md$/.test(target)) return `<a href="#/docs/${target}">${text}</a>`;
    const bom = target.match(/^bom\/generated\/parts\/(.+)\.md$/);
    if (bom) return `<a href="#/bom/${bom[1]}">${text}</a>`;
    return `<a href="${links.source(target)}" target="_blank" rel="noreferrer">${text}</a>`;
  };
  renderer.image = ({ href, text }) => `<img src="${DATA + resolve(href)}" alt="${text}" loading="lazy">`;
  renderer.code = ({ text, lang }) => (lang === 'mermaid' ? `<pre class="mermaid-src">${text}</pre>` : `<pre><code>${text.replace(/</g, '&lt;')}</code></pre>`);
  return marked.parse(text, { renderer });
}

// Exploded-diagram callouts: anchors split into a left and right column, sorted by
// height and spaced so labels never overlap; returns label + anchor positions.
export function layoutCallouts(anchors, width, { gap = 26, margin = 56, spread = 0.18 } = {}) {
  if (!anchors.length) return [];
  const cx = anchors.reduce((s, a) => s + a.x, 0) / anchors.length;
  const minX = Math.min(...anchors.map((a) => a.x));
  const maxX = Math.max(...anchors.map((a) => a.x));
  const sides = { left: [], right: [] };
  [...anchors].sort((a, b) => a.y - b.y).forEach((a, i) => sides[a.x < cx || (a.x === cx && i % 2) ? 'left' : 'right'].push(a));
  const out = [];
  for (const [side, list] of Object.entries(sides)) {
    let last = -Infinity;
    const x = side === 'left' ? Math.max(margin, minX - width * spread) : Math.min(width - margin, maxX + width * spread);
    for (const a of list) {
      const y = Math.max(a.y, last + gap);
      last = y;
      out.push({ ...a, side, lx: x, ly: y });
    }
  }
  return out;
}

// ---------------------------------------------------------------- 3D

// Mockup-only exploded pose for the payload. Production should take this pose from
// the booklet renderer (integration.py / render_figures.py) so the site never authors geometry.
const POD_LAYERS = [
  [/^(rain-hood|cover-nut-)/, 215],
  [/^(pi|converter|capacitor)(-|$)|^pi-|-tie(-|$)/, 140],
  [/^(deck|frame-upper-washer-|frame-nut-)/, 95],
  [/^(enclosure-base|cover-bolt-|cover-bottom-washer-)/, 52],
  [/^spider-spacer-/, 22],
  [/^spider$/, 0],
  [/^(pan-mount|pan-servo|frame-bolt-|frame-lower-washer-)/, -44],
  [/^fairing-|^pan-fairing$/, -92],
];
const GROUP_DROP = { fixed: 0, pan: -150, tilt: -196 };

function podExplode(part) {
  const layer = POD_LAYERS.find(([re]) => re.test(part.node));
  const z = layer ? layer[1] : GROUP_DROP[part.group] ?? 0;
  const a = part.authoredExplode ?? [0, 0, 0];
  return new THREE.Vector3(a[0] * 3, a[1] * 3, z + (layer ? 0 : a[2] * 1.6));
}

function winchExplode(part, center, assemblyCenter) {
  const id = part.model;
  if (/winch-cover-(passive|powered)-(left|middle|right|transition)/.test(id)) return new THREE.Vector3(0, 0, 260);
  if (/winch-cover-.*shutter/.test(id)) return new THREE.Vector3(0, 220, 120);
  if (/fascia/.test(id)) return new THREE.Vector3(0, center.y > assemblyCenter.y ? 260 : -260, 140);
  if (/rear|blank/.test(id)) return new THREE.Vector3(0, -260, 100);
  if (/winch-cover-clip|cable-anchor/.test(id)) return new THREE.Vector3(0, 0, 120);
  if (/base-plate/.test(id)) return new THREE.Vector3(0, 0, -110);
  return new THREE.Vector3();
}

// line: booklet line art (white faces, dark edges). ink: the same drawing inverted for black sections.
const STYLES = {
  light: { env: 0.9 },
  dark: { env: 1.15, rim: true },
  line: { env: 0, edges: true, face: 0xffffff, edge: 0x111111, hoverFace: 0x161616, hoverEdge: 0xffffff },
  ink: { env: 0, edges: true, face: 0x0b0b0b, edge: 0xe8e8e4, hoverFace: 0xffffff, hoverEdge: 0x0b0b0b },
};

function partMaterial(color, style) {
  const st = STYLES[style];
  if (st.edges) return new THREE.MeshBasicMaterial({ color: st.face, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, transparent: true });
  const c = new THREE.Color().setRGB(...color, THREE.SRGBColorSpace);
  const metal = color[0] > 0.6 && color[0] < 0.75;
  return new THREE.MeshStandardMaterial({ color: c, roughness: metal ? 0.35 : 0.62, metalness: metal ? 0.7 : 0.0, transparent: true });
}

// trimesh GLBs carry no normals; crease at 30° so flat faces stay crisp.
const normalCache = new WeakMap();
function withNormals(g) {
  if (g.attributes.normal) return g;
  if (!normalCache.has(g)) normalCache.set(g, toCreasedNormals(g, Math.PI / 6));
  return normalCache.get(g);
}
const edgeCache = new WeakMap();
const edgesOf = (g) => (edgeCache.has(g) || edgeCache.set(g, new THREE.EdgesGeometry(g, 28)), edgeCache.get(g));

const stlCache = new Map();
function loadSTL(url) {
  if (!stlCache.has(url)) stlCache.set(url, new STLLoader().loadAsync(DATA + url));
  return stlCache.get(url);
}
let glbPromise;
const loadPodGLB = () => (glbPromise ??= new GLTFLoader().loadAsync(DATA + 'pod/assembled.glb'));

export class Viewer {
  constructor(el, { style = 'light', autoRotate = false, fov = 28, interactive = true } = {}) {
    this.el = el;
    this.style = style;
    this.parts = [];
    this.explode = 0;
    this.target = 0;
    this.hovered = null;
    this.focus = null;
    this.listeners = {};
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
    el.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    if (STYLES[style].env) {
      const pmrem = new THREE.PMREMGenerator(r);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = STYLES[style].env;
    }
    const key = new THREE.DirectionalLight(0xffffff, style === 'dark' ? 1.6 : 1.1);
    key.position.set(1, -1.4, 2.2);
    this.scene.add(key, new THREE.AmbientLight(0xffffff, style === 'dark' ? 0.15 : 0.35));
    if (STYLES[style].rim) {
      const rim = new THREE.DirectionalLight(0xffffff, 3.2);
      rim.position.set(-2, 2, 0.6);
      const fill = new THREE.HemisphereLight(0xffffff, 0x222222, 1.2);
      fill.position.set(0, 0, 1);
      this.scene.add(rim, fill);
    }
    this.camera = new THREE.PerspectiveCamera(fov, 1, 1, 20000);
    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = autoRotate;
    this.controls.autoRotateSpeed = 0.6;
    this.controls.enabled = interactive;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(9, 9);
    if (interactive) this.#bindPointer();
    this.ro = new ResizeObserver(() => this.#resize());
    this.ro.observe(el);
    this.#resize();
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      requestAnimationFrame(tick);
      this.#frame();
    };
    tick();
  }

  on(evt, fn) { (this.listeners[evt] ??= []).push(fn); return this; }
  #emit(evt, ...a) { (this.listeners[evt] ?? []).forEach((f) => f(...a)); }

  dispose() {
    this.running = false;
    this.ro.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  #resize() {
    const { clientWidth: w, clientHeight: h } = this.el;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  #bindPointer() {
    const dom = this.renderer.domElement;
    let down = null;
    dom.addEventListener('pointermove', (e) => {
      const b = dom.getBoundingClientRect();
      this.pointer.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      this.pointerClient = { x: e.clientX - b.left, y: e.clientY - b.top };
    });
    dom.addEventListener('pointerleave', () => this.pointer.set(9, 9));
    dom.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
    dom.addEventListener('pointerup', (e) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5 && this.hovered) this.#emit('pick', this.hovered.part);
    });
  }

  #addPart(object, part, explodeVec, unit) {
    object.userData.part = part;
    object.userData.base = object.position.clone();
    object.userData.offset = explodeVec.multiplyScalar(unit);
    const meshes = [];
    object.traverse((o) => o.isMesh && meshes.push(o));
    for (const m of meshes) {
      m.geometry = withNormals(m.geometry);
      m.material = partMaterial(part.color, this.style);
      m.userData.entry = null;
      if (STYLES[this.style].edges) {
        const edges = new THREE.LineSegments(edgesOf(m.geometry), new THREE.LineBasicMaterial({ color: STYLES[this.style].edge, transparent: true }));
        edges.raycast = () => {};
        m.add(edges);
      }
    }
    const entry = { object, part, meshes };
    meshes.forEach((m) => (m.userData.entry = entry));
    this.parts.push(entry);
    this.root.add(object);
  }

  async loadScene(key, data) {
    if (key === 'pod') {
      const gltf = await loadPodGLB();
      const scene = gltf.scene.clone(true);
      scene.scale.setScalar(1000); // GLB nodes carry metres; manifests use mm.
      const byNode = Object.fromEntries(data.parts.map((p) => [p.node, p]));
      const holder = new THREE.Group();
      holder.add(scene);
      this.root.add(holder);
      for (const node of [...scene.children]) {
        const part = byNode[node.name];
        if (!part) continue;
        node.parent.remove(node);
        const wrap = new THREE.Group();
        wrap.scale.setScalar(1000);
        wrap.add(node);
        this.#addPart(wrap, part, podExplode(part), 1);
      }
      holder.removeFromParent();
    } else {
      const geoms = await Promise.all(data.parts.map((p) => loadSTL(`winch/${p.file}`)));
      const box = new THREE.Box3();
      const items = data.parts.map((p, i) => {
        const mesh = new THREE.Mesh(geoms[i]);
        const m = new THREE.Matrix4().set(...p.matrix.flat());
        mesh.applyMatrix4(m);
        mesh.updateMatrixWorld();
        const c = new THREE.Box3().setFromObject(mesh);
        box.union(c);
        return { mesh, p, center: c.getCenter(new THREE.Vector3()) };
      });
      const C = box.getCenter(new THREE.Vector3());
      for (const { mesh, p, center } of items) this.#addPart(mesh, p, winchExplode(p, center, C), 1);
    }
    this.frame();
    return this;
  }

  async loadModel(site, id) {
    const mesh = site.meshFor(id);
    if (!mesh) return null;
    const color = site.instances[id]?.parts[0]?.color ?? [0.94, 0.94, 0.92];
    let obj;
    if (mesh.kind === 'glb') {
      const gltf = await loadPodGLB();
      const node = gltf.scene.getObjectByName(mesh.node).clone(true);
      node.position.set(0, 0, 0);
      obj = new THREE.Group();
      obj.scale.setScalar(1000);
      obj.add(node);
    } else {
      obj = new THREE.Mesh(await loadSTL(mesh.url));
    }
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    obj.position.sub(c);
    holder.add(obj);
    this.#addPart(holder, { node: id, model: id, color, registered: true }, new THREE.Vector3(), 1);
    this.frame({ distance: 0.78 });
    return box.getSize(new THREE.Vector3());
  }

  // distance 1 = the bounding sphere exactly fits the narrower field of view.
  frame({ distance = 1, azimuth = -0.62, elevation = 0.42 } = {}) {
    // Fit the pose the explode animation is heading to, not the current frame.
    for (const e of this.parts) e.object.position.copy(e.object.userData.base).addScaledVector(e.object.userData.offset, this.target);
    const sphere = new THREE.Box3().setFromObject(this.root).getBoundingSphere(new THREE.Sphere());
    for (const e of this.parts) e.object.position.copy(e.object.userData.base).addScaledVector(e.object.userData.offset, this.explode);
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const d = (sphere.radius / Math.sin(Math.min(vfov, hfov) / 2)) * distance;
    const c = sphere.center;
    this.camera.position.set(c.x + d * Math.cos(elevation) * Math.sin(azimuth), c.y - d * Math.cos(elevation) * Math.cos(azimuth), c.z + d * Math.sin(elevation));
    this.camera.near = d / 100;
    this.camera.far = d * 10;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(c);
    this.controls.update();
  }

  setExplode(t) { this.target = t; }

  setFocus(model) { this.focus = model; }

  // Screen-space anchors for labels (one per registered model, first instance).
  anchors() {
    const seen = new Set();
    const out = [];
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

  #frame() {
    this.explode += (this.target - this.explode) * 0.08;
    for (const e of this.parts) e.object.position.copy(e.object.userData.base).addScaledVector(e.object.userData.offset, this.explode);
    this.controls.update();
    // Hover pick
    let hit = null;
    if (this.pointer.x < 2 && this.controls.enabled) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const meshes = this.parts.flatMap((e) => e.meshes);
      hit = this.raycaster.intersectObjects(meshes, false)[0]?.object.userData.entry ?? null;
    }
    if (hit !== this.hovered) {
      this.hovered = hit;
      this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
      this.#emit('hover', hit?.part ?? null, this.pointerClient);
    } else if (hit) this.#emit('move', hit.part, this.pointerClient);
    const active = this.hovered?.part.model ?? this.focus;
    for (const e of this.parts) {
      const on = !active || e.part.model === active;
      for (const m of e.meshes) {
        const mat = m.material;
        mat.opacity += ((on ? 1 : 0.16) - mat.opacity) * 0.2;
        mat.depthWrite = mat.opacity > 0.9;
        const st = STYLES[this.style];
        const hot = this.hovered && e === this.hovered;
        if (st.edges) mat.color.setHex(hot ? st.hoverFace : st.face);
        else if (mat.emissive) mat.emissive.setHex(this.hovered && e.part.model === this.hovered.part.model ? (this.style === 'dark' ? 0x222222 : 0x111111) : 0x000000);
        const line = m.children[0];
        if (line) {
          line.material.opacity = mat.opacity;
          line.material.color.setHex(hot ? st.hoverEdge : st.edge);
        }
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.#emit('frame');
  }
}
