// Reusable props in the reference vocabulary: grey matcap solids with thin ink/light edges, red accents.
// Furniture is deliberately generic and low-detail (the refs' desks, chairs, cabinets, cards, calendars).
import * as THREE from 'three';
import { solid, box, edges, lineMat } from './env.js';
import { buildMatcaps, matcapMat, POLARITY_SWAP } from './materials.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

const M = () => buildMatcaps();
const ink = pol => (pol ? 0x161616 : 0xd6d6d6);

export function redBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0);
  const grp = new THREE.Group(); grp.add(new THREE.Mesh(g, matcapMat(M().red, { noRim: true })));
  return grp;
}

export function cube(s = 0.4, { red = false, pol = 1 } = {}) {
  const g = new THREE.BoxGeometry(s, s, s); g.translate(0, s / 2, 0);
  const grp = new THREE.Group();
  const mPlain = matcapMat(M().prop), mHot = matcapMat(M().red, { noRim: true });
  const mesh = new THREE.Mesh(g, mPlain);
  grp.add(mesh, edges(g, ink(pol), 1.3));
  grp.setRed = r => { mesh.material = r ? mHot : mPlain; };
  grp.setRed(red);
  return grp;
}

export function table({ r = 0.45, h = 0.74, pol = 1 } = {}) {
  const grp = new THREE.Group();
  const top = new THREE.CylinderGeometry(r, r, 0.04, 40); top.translate(0, h, 0);
  const leg = new THREE.CylinderGeometry(0.035, 0.035, h, 12); leg.translate(0, h / 2, 0);
  const foot = new THREE.CylinderGeometry(r * 0.45, r * 0.5, 0.03, 30); foot.translate(0, 0.015, 0);
  for (const g of [top, leg, foot]) grp.add(solid(g, { edge: ink(pol), edgeW: 1.1 }));
  return grp;
}

export function desk({ w = 1.4, d = 0.7, h = 0.74, pol = 1 } = {}) {
  const grp = new THREE.Group();
  const top = box(w, 0.04, d, { edge: ink(pol) }); top.position.y = h - 0.04; grp.add(top);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = box(0.04, h - 0.04, 0.04, { edge: ink(pol) }); l.position.set(x * (w / 2 - 0.04), 0, z * (d / 2 - 0.04)); grp.add(l); }
  return grp;
}

export function chair({ pol = 1 } = {}) {
  const grp = new THREE.Group(), s = 0.44, h = 0.45;
  const seat = box(s, 0.04, s, { edge: ink(pol) }); seat.position.y = h; grp.add(seat);
  const back = box(s, 0.45, 0.03, { edge: ink(pol) }); back.position.set(0, h + 0.04, -s / 2 + 0.015); grp.add(back);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = box(0.03, h, 0.03, { edge: ink(pol) }); l.position.set(x * (s / 2 - 0.03), 0, z * (s / 2 - 0.03)); grp.add(l); }
  return grp;
}

// order slip / note card: thin plate with ruled lines and a red stripe
export function card({ w = 0.32, h = 0.44, pol = 1, stripe = true } = {}) {
  const grp = new THREE.Group();
  const g = new THREE.BoxGeometry(w, h, 0.008);
  const plate = new THREE.Mesh(g, matcapMat(M().prop)); grp.add(plate); grp.add(edges(g, ink(pol), 1.2));
  const pos = [];
  for (let i = 0; i < 6; i++) { const y = h * 0.3 - i * h * 0.1; pos.push(-w * 0.35, y, 0.006, w * (0.1 + 0.25 * ((i * 7) % 5) / 4), y, 0.006); }
  grp.add(lineSegs(pos, ink(1), 1.0));
  if (stripe) { const r = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, h * 0.07, 0.01), matcapMat(M().red, { noRim: true })); r.position.set(0, h * 0.38, 0.004); grp.add(r); }
  grp.plate = plate;
  return grp;
}

function lineSegs(pos, color, width) {
  const { LineSegments2 } = LS; const g = new LS.LineSegmentsGeometry().setPositions(pos);
  return new LineSegments2(g, lineMat(color, width));
}
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
const LS = { LineSegments2, LineSegmentsGeometry };

// wall calendar / plan grid: cols x rows cells, any cell can be lit red
export function calendar({ cols = 7, rows = 5, cell = 0.28, pol = 1 } = {}) {
  const grp = new THREE.Group(), W = cols * cell, H = rows * cell + cell * 0.6;
  const g = new THREE.BoxGeometry(W + 0.06, H + 0.06, 0.04);
  grp.add(new THREE.Mesh(g, matcapMat(M().prop))); grp.add(edges(g, ink(pol), 1.3));
  const pos = [];
  for (let i = 0; i <= cols; i++) pos.push(-W / 2 + i * cell, -H / 2, 0.025, -W / 2 + i * cell, H / 2 - cell * 0.6, 0.025);
  for (let j = 0; j <= rows; j++) pos.push(-W / 2, -H / 2 + j * cell, 0.025, W / 2, -H / 2 + j * cell, 0.025);
  grp.add(lineSegs(pos, ink(1), 1.1));
  const header = new THREE.Mesh(new THREE.BoxGeometry(W, cell * 0.45, 0.02), matcapMat(M().red, { noRim: true })); header.position.set(0, H / 2 - cell * 0.3, 0.03); grp.add(header);
  const cells = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(cell * 0.86, cell * 0.86, 0.02), matcapMat(M().red, { noRim: true }));
    c.position.set(-W / 2 + (i + 0.5) * cell, H / 2 - cell * 0.6 - (j + 0.5) * cell, 0.03); c.visible = false; grp.add(c); cells.push(c);
  }
  grp.light = (k, on = true) => { if (cells[k]) cells[k].visible = on; };
  return grp;
}

// browser-tab / message panel floating in space
export function panel({ w = 0.9, h = 0.55, pol = 0, rows = 4, red = 0.3 } = {}) {
  const grp = new THREE.Group();
  const g = new THREE.BoxGeometry(w, h, 0.012);
  const m = matcapMat(pol ? M().prop : M().propDark, { transparent: true, opacity: 0.85 });
  grp.add(new THREE.Mesh(g, m)); grp.add(edges(g, ink(pol), 1.2));
  const pos = [];
  pos.push(-w / 2, h / 2 - 0.09, 0.008, w / 2, h / 2 - 0.09, 0.008);
  for (let i = 0; i < rows; i++) { const y = h / 2 - 0.17 - i * (h - 0.25) / rows; pos.push(-w * 0.42, y, 0.008, -w * 0.42 + w * (0.4 + 0.4 * ((i * 3) % 4) / 3), y, 0.008); }
  grp.add(lineSegs(pos, ink(pol), 1.0));
  if (red > 0) { const r = new THREE.Mesh(new THREE.BoxGeometry(w * red, 0.05, 0.014), matcapMat(M().red, { noRim: true })); r.position.set(w * (0.5 - red / 2) - 0.04, -h / 2 + 0.07, 0.006); grp.add(r); }
  return grp;
}

// arc that draws on (loop that "closes"); lies in XZ plane unless rotated
export function arc({ r = 0.6, color = 0xe41b26, width = 2.2, seg = 160 } = {}) {
  const pts = [];
  for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; pts.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
  const g = new LineGeometry().setPositions(pts);
  const l = new Line2(g, lineMat(color, width)); l.computeLineDistances();
  l.setProgress = p => { g.instanceCount = Math.max(0, Math.round(seg * Math.min(1, p))); };
  return l;
}

export function bar({ w = 0.5, h = 1, red = false, pol = 1 } = {}) {
  const grp = new THREE.Group();
  const g = new THREE.BoxGeometry(w, 1, w); g.translate(0, 0.5, 0);
  const mesh = new THREE.Mesh(g, matcapMat(red ? M().red : M().prop, { noRim: red }));
  const e = edges(g, ink(pol), 1.2);
  const inner = new THREE.Group(); inner.add(mesh, e); grp.add(inner);
  grp.setH = v => { inner.scale.y = Math.max(0.001, v); };
  grp.setH(h);
  return grp;
}

// wall segment with an optional doorway gap (doorway centred, opening 1.0 x 2.2); lies along X, faces +Z
// frame: true -> a free-standing doorway frame in the void (the refs' preferred staging; no wall surface)
export function wall({ w = 5, h = 2.8, t = 0.12, doorway = true, pol = 1, openW = 1.1, openH = 2.25, frame = false, tone } = {}) {
  const grp = new THREE.Group();
  const o = { edge: ink(pol), tone: tone || (pol ? 'prop' : 'propDark') };
  if (frame) {
    const post = 0.1;
    const L = box(post, openH + post, 0.22, o); L.position.x = -openW / 2 - post / 2; grp.add(L);
    const R = box(post, openH + post, 0.22, o); R.position.x = openW / 2 + post / 2; grp.add(R);
    const top = box(openW + 2 * post, post, 0.22, o); top.position.y = openH; grp.add(top);
    return grp;
  }
  if (!doorway) { const b = box(w, h, t, o); grp.add(b); return grp; }
  const side = (w - openW) / 2;
  const L = box(side, h, t, o); L.position.x = -openW / 2 - side / 2; grp.add(L);
  const R = box(side, h, t, o); R.position.x = openW / 2 + side / 2; grp.add(R);
  const top = box(openW, h - openH, t, o); top.position.y = openH; grp.add(top);
  return grp;
}

// red "event boundary": a thin glowing red plane with scan lines (place in a doorway)
export function boundary({ w = 1.1, h = 2.25, opacity = 0.55 } = {}) {
  const grp = new THREE.Group();
  const m = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, opacity: { value: opacity } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float time, opacity; varying vec2 vUv;
      void main(){ float scan = 0.55 + 0.45 * sin(vUv.y * 160.0 - time * 6.0); float edge = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
        float band = smoothstep(0.03, 0.0, abs(fract(vUv.y - time * 0.35) - 0.5) - 0.0);
        gl_FragColor = vec4(vec3(0.92, 0.08, 0.13), (0.35 * scan + 0.6 * band) * edge * opacity); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); plane.position.y = h / 2; grp.add(plane);
  grp.tick = t => { m.uniforms.time.value = t; };
  grp.mat = m;
  return grp;
}

// film strip: a row of frames (panels) along X with sprocket ticks — "life like a film"
export function filmStrip({ n = 7, fw = 0.9, fh = 0.6, gap = 0.14, pol = 0 } = {}) {
  const grp = new THREE.Group(), frames = [];
  for (let i = 0; i < n; i++) { const p = panel({ w: fw, h: fh, pol, rows: 0, red: 0 }); p.position.x = (i - (n - 1) / 2) * (fw + gap); grp.add(p); frames.push(p); }
  const pos = [], W = n * (fw + gap);
  for (const y of [fh / 2 + 0.08, -fh / 2 - 0.08]) { pos.push(-W / 2, y, 0, W / 2, y, 0); for (let i = 0; i < n * 4; i++) { const x = -W / 2 + (i + 0.5) * W / (n * 4); pos.push(x - 0.03, y, 0.01, x + 0.03, y, 0.01); } }
  grp.add(lineSegs(pos, ink(pol), 1.2));
  grp.frames = frames;
  return grp;
}

// ------------------------------------------------------------------ hero props (engine/blender/build_props.py)
export const HERO_NAMES = ['brain', 'bulb', 'headphones', 'phone', 'cabinet', 'bed', 'clock', 'hourglass'];
const HERO = {};
export async function loadHeroProps(base = '/engine/assets/props/') {
  const L = new GLTFLoader();
  await Promise.all(HERO_NAMES.map(async n => { try { HERO[n] = (await L.loadAsync(base + n + '.glb')).scene; } catch (e) { console.error('HOLO hero prop missing', n); } }));
}
// heroProp('cabinet') -> Group (floor-standing, metres). Extras: cabinet.open(i, k 0..1); clock.setTime(h, m, s)
export function heroProp(name, { scale = 1 } = {}) {
  const Mc = M();
  const plate = matcapMat(Mc.plate); POLARITY_SWAP.push([plate, Mc.plate, Mc.plateLight]);
  const glass = matcapMat(Mc.plate, { transparent: true, opacity: 0.22, side: THREE.DoubleSide }); glass.depthWrite = false;
  const mats = { PLATE: plate, SUIT: matcapMat(Mc.suit), RED: matcapMat(Mc.red, { noRim: true }), VISOR: matcapMat(Mc.visor), GLASS: glass };
  const g = HERO[name].clone(true);
  g.traverse(o => { if (o.isMesh) { const nm = o.material && o.material.name; o.material = mats[nm] || plate; if (nm === 'GLASS') o.renderOrder = 2; } });
  g.scale.setScalar(scale);
  const grp = new THREE.Group(); grp.add(g);
  if (name === 'cabinet') {
    const dr = [0, 1, 2].map(i => g.getObjectByName('Drawer' + i));
    const home = dr.map(d => d.position.clone());
    grp.open = (i, k) => { if (dr[i]) dr[i].position.z = home[i].z + 0.5 * k; };   // drawers slide toward +Z (front)
  }
  if (name === 'clock') {
    const H = g.getObjectByName('HourHand'), Mi = g.getObjectByName('MinuteHand'), Se = g.getObjectByName('SecondHand');
    grp.setTime = (h, m = 0, sec = 0) => {
      if (H) H.rotation.z = -((h % 12) + m / 60) / 12 * Math.PI * 2;
      if (Mi) Mi.rotation.z = -(m + sec / 60) / 60 * Math.PI * 2;
      if (Se) Se.rotation.z = -sec / 60 * Math.PI * 2;
    };
  }
  return grp;
}
