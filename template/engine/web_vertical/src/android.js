// Procedural armoured android (built by engine/blender/build_android.py) + direction-based posing.
// Character space (three.js): faces +Z, its left is +X, up is +Y. Height ~2.0 units (head top).
// Poses are written as DIRECTIONS a bone should point (child joint minus joint) plus optional
// character-space rotations, so they are independent of the exporter's bone-roll conventions.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { buildMatcaps, matcapMat, xrayMat, POLARITY_SWAP } from './materials.js';
import { clamp, lerp } from './util.js';

let TEMPLATE = null;
export async function loadAndroid(url = '/engine/assets/android.glb') {
  if (TEMPLATE) return TEMPLATE;
  const g = await new GLTFLoader().loadAsync(url);
  TEMPLATE = g.scene;
  return TEMPLATE;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const deg = Math.PI / 180;

// ------------------------------------------------------------------ pose library
// each entry: { dir: {bone: [x,y,z]}, rot: {bone: [rx,ry,rz] degrees, character space}, hips: [x,y,z] offset }
export const POSES = {
  stand: {
    dir: { 'upper_arm.L': [0.20, -1, 0.0], 'forearm.L': [0.10, -1, 0.10], 'upper_arm.R': [-0.20, -1, 0.0], 'forearm.R': [-0.10, -1, 0.10],
      'thigh.L': [0.02, -1, 0], 'shin.L': [0, -1, -0.02], 'thigh.R': [-0.02, -1, 0], 'shin.R': [0, -1, -0.02] },
  },
  armsUp: { // both hands to the head (putting on a headset)
    dir: { 'upper_arm.L': [0.85, 0.35, 0.35], 'forearm.L': [-0.45, 0.85, 0.25], 'upper_arm.R': [-0.85, 0.35, 0.35], 'forearm.R': [0.45, 0.85, 0.25],
      'thigh.L': [0.04, -1, 0], 'shin.L': [0, -1, 0], 'thigh.R': [-0.04, -1, 0], 'shin.R': [0, -1, 0] },
  },
  handsOpen: { // palms raised at chest height facing camera (ref 4 "mask" shot)
    dir: { 'upper_arm.L': [0.75, -0.55, 0.35], 'forearm.L': [0.15, 0.7, 0.7], 'upper_arm.R': [-0.75, -0.55, 0.35], 'forearm.R': [-0.15, 0.7, 0.7],
      'thigh.L': [0.04, -1, 0], 'shin.L': [0, -1, 0], 'thigh.R': [-0.04, -1, 0], 'shin.R': [0, -1, 0] },
  },
  reach: { // right arm reaching forward
    dir: { 'upper_arm.L': [0.2, -1, 0.05], 'forearm.L': [0.1, -1, 0.15], 'upper_arm.R': [-0.25, -0.05, 1], 'forearm.R': [-0.1, 0.05, 1],
      'thigh.L': [0.03, -1, 0], 'shin.L': [0, -1, 0], 'thigh.R': [-0.03, -1, 0], 'shin.R': [0, -1, 0] },
    rot: { 'spine.003': [6, -8, 0] },
  },
  sit: {
    dir: { 'upper_arm.L': [0.18, -0.9, 0.35], 'forearm.L': [0.05, -0.15, 1], 'upper_arm.R': [-0.18, -0.9, 0.35], 'forearm.R': [-0.05, -0.15, 1],
      'thigh.L': [0.08, -0.05, 1], 'shin.L': [0.0, -1, 0.05], 'thigh.R': [-0.08, -0.05, 1], 'shin.R': [0.0, -1, 0.05] },
    rot: { 'spine.002': [8, 0, 0] }, hips: [0, -0.52, -0.05],
  },
  lie: { // lying on back (bed scenes) — used with the root rotated -90° about X
    dir: { 'upper_arm.L': [0.22, -1, 0], 'forearm.L': [0.1, -1, 0], 'upper_arm.R': [-0.22, -1, 0], 'forearm.R': [-0.1, -1, 0],
      'thigh.L': [0.03, -1, 0], 'shin.L': [0, -1, 0], 'thigh.R': [-0.03, -1, 0], 'shin.R': [0, -1, 0] },
  },
  carry: { // both forearms forward at waist height, holding something in front of the chest
    dir: { 'upper_arm.L': [0.22, -0.85, 0.45], 'forearm.L': [-0.35, 0.05, 1], 'upper_arm.R': [-0.22, -0.85, 0.45], 'forearm.R': [0.35, 0.05, 1],
      'thigh.L': [0.03, -1, 0], 'shin.L': [0, -1, 0], 'thigh.R': [-0.03, -1, 0], 'shin.R': [0, -1, 0] },
  },
  thinker: { // hand to chin, head lowered
    dir: { 'upper_arm.L': [0.2, -1, 0.05], 'forearm.L': [0.1, -1, 0.15], 'upper_arm.R': [-0.35, -0.75, 0.55], 'forearm.R': [0.35, 0.9, 0.25],
      'thigh.L': [0.03, -1, 0], 'shin.L': [0, -1, 0], 'thigh.R': [-0.03, -1, 0], 'shin.R': [0, -1, 0] },
    rot: { 'spine.005': [18, 0, 0], 'spine.003': [6, 0, 0] },
  },
};

export function walkPose(phase, stride = 1) {
  const s = Math.sin(phase), c = Math.cos(phase);
  const th = 26 * stride * deg, kn = 50 * stride * deg;
  const leg = (sgn, ph) => {
    const a = Math.sin(ph) * th; const k = Math.max(0, Math.sin(ph + 1.3)) * kn + 6 * deg;
    return { thigh: [0.03 * sgn, -Math.cos(a), Math.sin(a)], shin: [0.0, -Math.cos(a - k), Math.sin(a - k)] };
  };
  const L = leg(1, phase), R = leg(-1, phase + Math.PI);
  const arm = (sgn, ph) => { const a = -Math.sin(ph) * 22 * stride * deg; return { ua: [0.17 * sgn, -Math.cos(a), Math.sin(a)], fa: [0.08 * sgn, -Math.cos(a + 0.35), Math.sin(a + 0.35)] }; };
  const AL = arm(1, phase), AR = arm(-1, phase + Math.PI);
  return {
    dir: { 'thigh.L': L.thigh, 'shin.L': L.shin, 'thigh.R': R.thigh, 'shin.R': R.shin, 'upper_arm.L': AL.ua, 'forearm.L': AL.fa, 'upper_arm.R': AR.ua, 'forearm.R': AR.fa },
    rot: { 'spine.001': [3, 5 * s, 0], 'spine.004': [0, -5 * s, 0] },
    hips: [0, -0.03 * Math.abs(c) * stride, 0],
  };
}

// patch a base pose (patch entries override; everything else — incl. hips — is inherited)
export function extend(base, patch) {
  return { dir: { ...(base.dir || {}), ...(patch.dir || {}) }, rot: { ...(base.rot || {}), ...(patch.rot || {}) }, hips: patch.hips || base.hips };
}

// walk while keeping the arms of another pose (e.g. carrying)
export function walkWith(phase, upper, stride = 0.8) {
  const w = walkPose(phase, stride);
  for (const k of ['upper_arm.L', 'forearm.L', 'upper_arm.R', 'forearm.R']) if (upper.dir[k]) w.dir[k] = upper.dir[k];
  return w;
}

export function mixPose(a, b, t) {
  const out = { dir: {}, rot: {}, hips: [0, 0, 0] };
  const keys = new Set([...Object.keys(a.dir || {}), ...Object.keys(b.dir || {})]);
  for (const k of keys) {
    const va = (a.dir || {})[k], vb = (b.dir || {})[k];
    out.dir[k] = va && vb ? va.map((v, i) => lerp(v, vb[i], t)) : (t < 0.5 ? va || vb : vb || va);
  }
  const rk = new Set([...Object.keys(a.rot || {}), ...Object.keys(b.rot || {})]);
  for (const k of rk) {
    const va = (a.rot || {})[k] || [0, 0, 0], vb = (b.rot || {})[k] || [0, 0, 0];
    out.rot[k] = va.map((v, i) => lerp(v, vb[i], t));
  }
  const ha = a.hips || b.hips || [0, 0, 0], hb = b.hips || a.hips || [0, 0, 0];
  out.hips = ha.map((v, i) => lerp(v, hb[i], t));
  return out;
}

// ------------------------------------------------------------------ instance
export function createAndroid(opts = {}) {
  const M = buildMatcaps();
  const root = new THREE.Group(); root.userData.android = true;   // vertical: lets vertical.js 'follow' a figure
  const model = SkeletonUtils.clone(TEMPLATE);
  root.add(model);
  const mode = opts.mode || 'chrome';
  const xr = mode === 'xray' ? xrayMat(opts) : null;
  const ghost = mode === 'ghost' ? matcapMat(M.prop, { color: new THREE.Color().setScalar((opts.intensity ?? 0.78) * 0.62) }) : null;
  // holographic skin layered over the ghost body: fresnel rim + dot lattice + travelling scan band
  const holo = mode === 'ghost' ? xrayMat({ intensity: 0.55, core: 0.02, dotAmt: 0.9, dots: 60 }) : null;
  const overlays = [];
  const mats = {
    SUIT: matcapMat(M.suit), PLATE: matcapMat(M.plate), RED: matcapMat(M.red, { noRim: true }), VISOR: matcapMat(M.visor),
  };
  POLARITY_SWAP.push([mats.PLATE, M.plate, M.plateLight]);
  model.traverse(o => {
    if (o.isMesh && (ghost || xr) && (o.name + ' ' + (o.parent?.name || '')).toLowerCase().match(/armour|helmet/) && !opts.keepArmour) { o.visible = false; return; }
    if (o.isMesh && ghost) {
      o.frustumCulled = false; o.material = ghost;
      if (o.isSkinnedMesh) { const h = new THREE.SkinnedMesh(o.geometry, holo); h.bind(o.skeleton, o.bindMatrix); h.frustumCulled = false; h.renderOrder = 3; overlays.push([o, h]); }
      return;
    }
    if (o.isMesh) {
      o.frustumCulled = false;
      const set = m => (xr ? (m.name === 'RED' ? mats.RED : xr) : (mats[m.name] || mats.PLATE));
      o.material = Array.isArray(o.material) ? o.material.map(set) : set(o.material);
      if (xr) o.renderOrder = 2;
    }
  });
  // GLTFLoader sanitises node names ("upper_arm.L" -> "upper_armL"); index both spellings
  for (const [o, h] of overlays) o.parent.add(h);
  const bones = {};
  model.traverse(o => { if (o.isBone) bones[o.name] = o; });
  const san = n => n.replace(/[\[\]\.:\/]/g, '').replace(/\s/g, '_');
  const B = n => bones[n] || bones[san(n)];
  const rest = {};
  for (const [n, b] of Object.entries(bones)) rest[n] = { q: b.quaternion.clone(), p: b.position.clone() };
  const hipsBone = B('spine');
  // hierarchical order (parents first)
  const order = [];
  model.traverse(o => { if (o.isBone) order.push(o); });
  const childOf = {};
  for (const b of order) { const c = b.children.find(x => x.isBone); if (c) childOf[b.name] = c; }

  // sanitized name -> original metarig name (pose tables use the original names)
  const RAW = {};
  for (const n of ['spine', 'spine.001', 'spine.002', 'spine.003', 'spine.004', 'spine.005', 'spine.006', 'shoulder.L', 'shoulder.R', 'upper_arm.L', 'upper_arm.R', 'forearm.L', 'forearm.R', 'hand.L', 'hand.R', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R', 'foot.L', 'foot.R', 'toe.L', 'toe.R']) RAW[san(n)] = n;
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _e = new THREE.Euler();
  const rootQ = new THREE.Quaternion();

  function applyPose(pose) {
    for (const [n, b] of Object.entries(bones)) { b.quaternion.copy(rest[n].q); b.position.copy(rest[n].p); }
    if (pose.hips && hipsBone) {
      // hips offset in character space -> bone parent space
      root.updateWorldMatrix(true, true);
      const parent = hipsBone.parent;
      const off = new THREE.Vector3(...pose.hips).applyQuaternion(root.getWorldQuaternion(rootQ));
      const pw = parent.getWorldQuaternion(_q).invert();
      const s = parent.getWorldScale(new THREE.Vector3());
      hipsBone.position.add(off.applyQuaternion(pw).divide(s));
    }
    root.updateWorldMatrix(true, true);
    root.getWorldQuaternion(rootQ);
    for (const b of order) {
      const r = pose.rot && (pose.rot[b.name] || pose.rot[RAW[b.name]]);
      const d = pose.dir && (pose.dir[b.name] || pose.dir[RAW[b.name]]);
      if (!r && !d) continue;
      b.updateWorldMatrix(true, true);
      const wq = b.getWorldQuaternion(new THREE.Quaternion());
      let delta = new THREE.Quaternion();
      if (r) {
        _e.set(r[0] * deg, r[1] * deg, r[2] * deg, 'YXZ');
        const cs = new THREE.Quaternion().setFromEuler(_e);
        delta = rootQ.clone().multiply(cs).multiply(rootQ.clone().invert());
      }
      if (d && childOf[b.name]) {
        b.getWorldPosition(_a);
        childOf[b.name].getWorldPosition(_b);
        const cur = _b.sub(_a).normalize().applyQuaternion(delta);
        const tgt = new THREE.Vector3(...d).normalize().applyQuaternion(rootQ);
        delta = new THREE.Quaternion().setFromUnitVectors(cur, tgt).multiply(delta);
      }
      const nw = delta.multiply(wq);
      const pq = b.parent.getWorldQuaternion(_q2).invert();
      b.quaternion.copy(pq.multiply(nw));
      b.updateWorldMatrix(false, true);
    }
  }

  const api = {
    root, bones, bone: B, mats, mode,
    pose(p) { applyPose(typeof p === 'string' ? POSES[p] : p); return api; },
    setXrayTime(t) { if (xr) xr.uniforms.time.value = t; if (holo) holo.uniforms.time.value = t; },
    height: 1.98,
  };
  applyPose(POSES.stand);
  return api;
}

// helper: idle breathing/sway layered on any pose
export function withIdle(pose, t, amt = 1) {
  const p = JSON.parse(JSON.stringify(pose));
  p.rot = p.rot || {};
  const add = (k, v) => { p.rot[k] = (p.rot[k] || [0, 0, 0]).map((x, i) => x + v[i]); };
  add('spine.003', [Math.sin(t * 1.6) * 1.2 * amt, 0, 0]);
  add('spine.005', [Math.sin(t * 0.7 + 1) * 2.0 * amt, Math.sin(t * 0.43) * 4 * amt, 0]);
  return p;
}
export { clamp };
