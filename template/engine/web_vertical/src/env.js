// Environment kit: perspective grids, red trace lines, rings, particles, wire spheres, lattices, props.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { buildMatcaps, matcapMat } from './materials.js';
import { rng, noise1, fbm1 } from './util.js';

export const PAPER = new THREE.Color(0.94, 0.945, 0.925);
export const INK = new THREE.Color(0.0, 0.0, 0.0);
export const RED = new THREE.Color(0.9, 0.08, 0.12);
const LINE_MATS = [];
export function setLineResolution(w, h) { for (const m of LINE_MATS) m.resolution.set(w, h); }
export function lineMat(color, width = 1.6, opts = {}) {
  const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity: opts.opacity ?? 1, dashed: !!opts.dashed, dashSize: opts.dashSize || 0.2, gapSize: opts.gapSize || 0.15, worldUnits: false, fog: true });
  m.resolution.set(1920, 1080); LINE_MATS.push(m); return m;
}

export function setBackground(scene, kind, fogNear = 6, fogFar = 60, { floor = true } = {}) {
  const c = kind === 'white' ? PAPER : INK;
  scene.background = c.clone();
  scene.fog = new THREE.Fog(c.clone(), fogNear, fogFar);
  // background-coloured floor: invisible in itself, but it writes depth so SSAO can lay soft contact shadows
  if (floor) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: c.clone(), fog: true }));
    f.rotation.x = -Math.PI / 2; f.position.y = -0.02; f.name = 'floor'; scene.add(f);
  }
}

// ------------------------------------------------------------------ perspective grid floor
// refs: sparse, thin, slightly broken lines receding to a horizon; vertical (depth) lines dominate.
export function grid({ size = 80, step = 2.2, color = 0x7a7a7a, width = 1.3, y = 0, opacity = 1, depthOnly = false, seed = 3 } = {}) {
  const pos = [], R = rng(seed), h = size / 2;
  for (let x = -h; x <= h + 1e-6; x += step) {
    // occasional broken segments (the refs' grid lines are not perfectly continuous)
    let z = -h;
    while (z < h) { const len = 6 + R() * 18; const z1 = Math.min(h, z + len); pos.push(x, y, z, x, y, z1); z = z1 + (R() < 0.25 ? R() * 1.5 : 0); }
  }
  if (!depthOnly) for (let z = -h; z <= h + 1e-6; z += step * 1.6) pos.push(-h, y, z, h, y, z);
  const g = new LineSegmentsGeometry().setPositions(pos);
  const l = new LineSegments2(g, lineMat(color, width, { opacity }));
  l.computeLineDistances();
  return l;
}

// a ring of red "seismograph" trace across the floor (draws on with progress 0..1)
export function trace({ from = [-12, 0.02, 2], to = [12, 0.02, -4], n = 420, amp = 0.18, color = RED, width = 2.0, seed = 1, spiky = 0.6 } = {}) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const d = b.clone().sub(a), side = new THREE.Vector3(-d.z, 0, d.x).normalize();
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const p = a.clone().lerp(b, t);
    const w = fbm1(t * 18, seed) * 0.6 + (noise1(t * 160, seed + 3) * spiky) * (0.4 + 0.6 * Math.abs(noise1(t * 7, seed + 9)));
    p.y += Math.abs(w) * amp * 0.7; p.addScaledVector(side, w * amp * 0.5);
    pts.push(p.x, p.y, p.z);
  }
  const g = new LineGeometry().setPositions(pts);
  const l = new Line2(g, lineMat(color, width));
  l.computeLineDistances();
  l.userData.n = n - 1;
  l.setProgress = p => { g.instanceCount = Math.max(0, Math.floor(l.userData.n * Math.min(1, p))); };
  return l;
}

export function ring({ r = 1, y = 0.01, color = RED, width = 1.6, seg = 128, dashed = false } = {}) {
  const pts = [];
  for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; pts.push(Math.cos(a) * r, y, Math.sin(a) * r); }
  const l = new Line2(new LineGeometry().setPositions(pts), lineMat(color, width, { dashed, dashSize: 0.12, gapSize: 0.08 }));
  l.computeLineDistances();
  return l;
}
export function rings({ radii = [0.6, 0.9, 1.3, 1.8], color = RED, width = 1.5 } = {}) {
  const g = new THREE.Group(); radii.forEach((r, i) => g.add(ring({ r, color, width: width * (1 - i * 0.12) }))); return g;
}

export function polyline(points, { color = RED, width = 1.6, dashed = false } = {}) {
  const l = new Line2(new LineGeometry().setPositions(points.flat()), lineMat(color, width, { dashed }));
  l.computeLineDistances(); return l;
}

// ------------------------------------------------------------------ particles
const PVS = /* glsl */`
  uniform float time, size, drift, pxScale; attribute float seed; varying float vS; varying float vA;
  void main(){
    vec3 p = position;
    p += drift * vec3(sin(time * 0.7 + seed * 40.0), sin(time * 0.53 + seed * 17.0) * 0.6, cos(time * 0.61 + seed * 29.0)) * 0.3;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp(size * (0.5 + 1.0 * fract(seed * 13.7)) * (6.0 / -mv.z), 1.0, size * 1.6) * pxScale;
    vA = 0.35 + 0.65 * fract(seed * 7.13); vS = seed;
    gl_Position = projectionMatrix * mv;
  }`;
const PFS = /* glsl */`
  uniform vec3 color; uniform float opacity, premul; varying float vA;
  void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.35, length(d)) * vA * opacity;
    // additive: premultiplied colour; normal blending: straight colour (it multiplies by alpha itself)
    gl_FragColor = vec4(color * mix(1.0, a, premul), a); }`;
export function particles({ count = 4000, shape = 'box', size = 0.035, spread = [10, 4, 10], center = [0, 2, 0], color = 0xffffff, opacity = 0.8, drift = 1, seed = 5, additive = true, xray = false } = {}) {
  const R = rng(seed), pos = new Float32Array(count * 3), sd = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let x, y, z;
    if (shape === 'sphere') { const u = R() * 2 - 1, a = R() * Math.PI * 2, r = Math.cbrt(R()); x = Math.sqrt(1 - u * u) * Math.cos(a) * r; y = u * r; z = Math.sqrt(1 - u * u) * Math.sin(a) * r; }
    else if (shape === 'gauss') { const g = () => (R() + R() + R() + R() - 2) / 2; x = g(); y = g(); z = g(); }
    else { x = R() - 0.5; y = R() - 0.5; z = R() - 0.5; }
    pos[i * 3] = center[0] + x * spread[0]; pos[i * 3 + 1] = center[1] + y * spread[1]; pos[i * 3 + 2] = center[2] + z * spread[2];
    sd[i] = R();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(sd, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, pxScale: { value: 1 }, size: { value: size * 100 }, drift: { value: drift }, color: { value: new THREE.Color(color) }, opacity: { value: opacity }, premul: { value: additive ? 1 : 0 } }, vertexShader: PVS, fragmentShader: PFS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const p = new THREE.Points(g, m); p.frustumCulled = false;
  if (xray) { m.depthTest = false; p.renderOrder = 6; }   // glow seen through a ghost body (ref7 red core)
  p.tick = t => { m.uniforms.time.value = t; };
  return p;
}

// ------------------------------------------------------------------ props
export function edges(geo, color = 0x111111, width = 1.4, threshold = 25) {
  const eg = new THREE.EdgesGeometry(geo, threshold);
  const g = new LineSegmentsGeometry().fromEdgesGeometry(eg);
  return new LineSegments2(g, lineMat(color, width));
}
export function solid(geo, { tone = 'prop', edge = 0x151515, edgeW = 1.3, polarity = 1 } = {}) {
  const M = buildMatcaps();
  const grp = new THREE.Group();
  const mesh = new THREE.Mesh(geo, matcapMat(M[tone]));
  grp.add(mesh);
  if (edge !== null) grp.add(edges(geo, edge, edgeW));
  grp.mesh = mesh;
  return grp;
}
export function box(w, h, d, opts = {}) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return solid(g, opts); }

export function door({ w = 1.0, h = 2.2, open = 0, polarity = 0 } = {}) {
  const grp = new THREE.Group();
  const frameC = polarity ? 0x222222 : 0xdddddd;
  const t = 0.07;
  grp.add(box(t, h + t, 0.18, { edge: frameC }).translateX(-w / 2 - t / 2));
  grp.add(box(t, h + t, 0.18, { edge: frameC }).translateX(w / 2 + t / 2));
  const top = box(w + 2 * t, t, 0.18, { edge: frameC }); top.position.y = h; grp.add(top);
  const leaf = new THREE.Group(); leaf.position.set(-w / 2, 0, 0);
  const panel = box(w, h, 0.05, { tone: 'prop', edge: frameC }); panel.position.x = w / 2; leaf.add(panel);
  const inset = box(w * 0.7, 0.04, 0.06, { tone: 'propDark', edge: null }); inset.position.set(w / 2, h * 0.86, 0.01); leaf.add(inset);
  grp.add(leaf);
  grp.setOpen = a => { leaf.rotation.y = -a * Math.PI * 0.55; };
  grp.setOpen(open);
  return grp;
}

export function wireSphere({ r = 1, lat = 10, lon = 14, color = 0xd8d8d8, width = 1.2, shell = 0.18 } = {}) {
  const grp = new THREE.Group(), pos = [];
  for (let i = 1; i < lat; i++) { const v = i / lat * Math.PI, y = Math.cos(v) * r, rr = Math.sin(v) * r; for (let k = 0; k < 96; k++) { const a = k / 96 * Math.PI * 2, b = (k + 1) / 96 * Math.PI * 2; pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr, Math.cos(b) * rr, y, Math.sin(b) * rr); } }
  for (let j = 0; j < lon; j++) { const a = j / lon * Math.PI * 2; for (let k = 0; k < 64; k++) { const v0 = k / 64 * Math.PI, v1 = (k + 1) / 64 * Math.PI; pos.push(Math.sin(v0) * Math.cos(a) * r, Math.cos(v0) * r, Math.sin(v0) * Math.sin(a) * r, Math.sin(v1) * Math.cos(a) * r, Math.cos(v1) * r, Math.sin(v1) * Math.sin(a) * r); } }
  grp.add(new LineSegments2(new LineSegmentsGeometry().setPositions(pos), lineMat(color, width, { opacity: 0.75 })));
  if (shell > 0) {
    const M = buildMatcaps();
    const m = matcapMat(M.plate, { transparent: true, opacity: shell, side: THREE.DoubleSide });
    m.depthWrite = false;
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.995, 48, 32), m));
  }
  return grp;
}

export function lattice({ nx = 6, ny = 3, nz = 6, s = 1.5, color = 0x8a8a8a, width = 1.1, center = [0, 0, 0] } = {}) {
  const pos = [], ox = center[0] - nx * s / 2, oz = center[2] - nz * s / 2, oy = center[1];
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) pos.push(ox + i * s, oy + j * s, oz, ox + i * s, oy + j * s, oz + nz * s);
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) pos.push(ox, oy + j * s, oz + k * s, ox + nx * s, oy + j * s, oz + k * s);
  for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) pos.push(ox + i * s, oy, oz + k * s, ox + i * s, oy + ny * s, oz + k * s);
  return new LineSegments2(new LineSegmentsGeometry().setPositions(pos), lineMat(color, width, { opacity: 0.7 }));
}

export function pillar({ h = 1.1, r = 0.22 } = {}) {
  const g = new THREE.Group();
  const shaft = new THREE.CylinderGeometry(r, r, h, 24, 1, false); shaft.translate(0, h / 2, 0);
  g.add(solid(shaft, { edge: 0x202020, edgeW: 1.0, threshold: 60 }));
  const cap = new THREE.BoxGeometry(r * 2.6, 0.08, r * 2.6); cap.translate(0, h + 0.04, 0); g.add(solid(cap));
  const base = new THREE.BoxGeometry(r * 2.6, 0.08, r * 2.6); base.translate(0, 0.04, 0); g.add(solid(base));
  return g;
}

// soft contact shadow
let SHADOW_TEX = null;
export function blobShadow(r = 0.7, opacity = 0.35) {
  if (!SHADOW_TEX) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); SHADOW_TEX = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.005; return m;
}

// dense red speckle aura (ref3 34.5s): many sub-pixel points, normal blending at low alpha -> soft pink haze with grain
export function aura({ center = [0, 2.3, -0.3], spread = [1.8, 0.7, 1.0], count = 140000, opacity = 0.6, color = 0xe0182a, seed = 9 } = {}) {
  return particles({ count, shape: 'gauss', spread, center, color, size: 0.016, opacity, additive: false, drift: 0.35, seed });
}
