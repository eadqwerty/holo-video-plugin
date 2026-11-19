// Shot templates: the recurring HOLO set-ups as parameterised shots (distilled from EP001/EP002).
// Each returns a shot object for film.shots: { t0, bg, xin, build }.  Add titles/HUD in the film as usual.
//
//   import * as SH from 'holo/shots.js';
//   shots.push(SH.deskScene({ t0, bg:'black', xin:'smear', redObject:true, label:['TASK','OPEN'] }));
//   shots.push(SH.angle({ t0, camera: SH.closeOn([0, 1.8, 0], 1.3) }));      // angle cut on the previous scene
import * as THREE from 'three';
import { createAndroid, POSES, walkPose, walkWith, withIdle, mixPose, extend } from './android.js';
import { grid, particles, setBackground, blobShadow, lattice, aura as auraFx } from './env.js';
import { cube, desk, chair, arc, wall, boundary, heroProp } from './props.js';
import { orbit, dolly } from './runtime.js';
import { ease, clamp } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export function stage(scene, add, bg, o = {}) {
  if (bg === 'white') { setBackground(scene, 'white', o.near ?? 6, o.far ?? 42); add(grid({ color: 0x8f8f8f, width: 1.2, step: o.step ?? 2.6, size: 120 })); return null; }
  setBackground(scene, 'black', o.near ?? 4, o.far ?? 32); add(grid({ color: 0x8a8a8a, width: 1.25, step: o.step ?? 2.0 }));
  return o.dust === false ? null : add(particles({ count: 2500, spread: [16, 6, 16], center: [0, 3, 0], size: 0.02, opacity: 0.45 }));
}
const loopRing = (r, tilt) => { const g = new THREE.Group(); const a = arc({ r, width: 2.2 }); a.setProgress(1); g.add(a); g.rotation.x = tilt; return g; };

// camera helpers
export const closeOn = (target, dist = 1.4, side = 0.4, fov = 30) => dolly([[0, [target[0] + side, target[1] + 0.08, target[2] + dist], target, fov], [1, [target[0] + side * 0.6, target[1] + 0.06, target[2] + dist * 0.85], target, fov]]);
export const lowWide = (target, dist = 3.6, fov = 34) => dolly([[0, [target[0] + dist * 0.6, 0.45, target[2] + dist], target, fov], [1, [target[0] + dist * 0.45, 0.5, target[2] + dist * 0.9], target, fov]]);
export const overhead = (target, h = 6) => dolly([[0, [target[0] + 0.2, h, target[2] + 0.8], target, 34], [1, [target[0] + 0.2, h * 0.9, target[2] + 0.5], target, 34]]);

// angle cut on the previous scene
export const angle = ({ t0, camera, xin = 'cut' }) => ({ t0, reuse: true, camera, xin });

// 1. figure seated at a desk with an object (red = the open task)
export function deskScene({ t0, bg = 'black', xin = 'smear', object = 'cube', redObject = true, pose = 'reach', label = null, camera }) {
  return { t0, bg, xin, build({ scene, add }) {
    const pol = bg === 'white' ? 1 : 0, dust = stage(scene, add, bg);
    const d = add(desk({ pol })); d.position.set(0.15, 0, 0.55);
    const ch = add(chair({ pol })); ch.position.set(0, 0, -0.1);
    const a = createAndroid(); add(a.root); a.root.position.set(0, 0, -0.12);
    const ob = object === 'cube' ? add(cube(0.22, { red: redObject, pol })) : add(heroProp(object, { scale: 1.6 }));
    ob.position.set(0.5, object === 'cube' ? 0.92 : 0.745, 0.7);
    const arms = pose === 'reach' ? { 'upper_arm.L': [0.45, -0.35, 0.8], 'forearm.L': [0.3, 0.0, 1] } : pose === 'write' ? { 'upper_arm.L': [0.25, -0.8, 0.55], 'forearm.L': [-0.15, -0.35, 1] } : { 'upper_arm.L': [0.2, -0.75, 0.6], 'forearm.L': [-0.1, -0.3, 1], 'upper_arm.R': [-0.2, -0.75, 0.6], 'forearm.R': [0.1, -0.3, 1] };
    return {
      update(lt) { a.pose(withIdle(extend(POSES.sit, { dir: arms, rot: pose === 'heavy' ? { 'spine.005': [24, 0, 0] } : {} }), lt)); if (dust) dust.tick(lt); if (object === 'cube') ob.rotation.y = lt * 0.4; },
      camera: camera || dolly([[0, [2.4, 0.9, 2.8], [0.2, 0.95, 0.3], 32], [1, [1.8, 1.1, 2.2], [0.25, 1.0, 0.35], 30]]),
      hud: label ? (lt, t, P) => [{ t0: 0.4, t1: 9, anchor: () => P(ob.position.clone().add(V(0, 0.12, 0))), label: label[0], value: label[1], side: 1, r: 16 }] : undefined,
    };
  } };
}

// 2. walking track (side-on), optionally carrying a red cube
export function walkTrack({ t0, bg = 'white', xin = 'smear', carry = false, speed = 0.95 }) {
  return { t0, bg, xin, build({ scene, add }) {
    stage(scene, add, bg);
    const a = createAndroid(); add(a.root); const sh = add(blobShadow(0.55, 0.1));
    const c = carry ? add(cube(0.24, { red: true, pol: bg === 'white' ? 1 : 0 })) : null;
    const X = lt => -1.8 + lt * speed;
    return {
      update(lt) { a.root.position.set(X(lt), 0, 0); a.root.rotation.y = Math.PI / 2; a.pose(carry ? walkWith(lt * 4.4, POSES.carry, 0.7) : walkPose(lt * 4.6, 0.85)); sh.position.x = X(lt); if (c) { const p = a.root.localToWorld(V(0, 1.02, 0.42)); c.position.copy(p).add(V(0, -0.12, 0)); } },
      camera: lt => ({ pos: [X(lt) - 0.6, 1.3, 4.2], target: [X(lt) + 0.6, 1.05, 0], fov: 34 }),
    };
  } };
}

// 3. hologram (ghost) with spinning red loops round the head and a red core; stopAt (local s) freezes the loops
export function hologramLoops({ t0, bg = 'black', xin = 'zoom', loops = 1, stopAt = null, latticeOn = false, camera }) {
  return { t0, bg, xin, build({ scene, add }) {
    const dust = stage(scene, add, bg, { step: 1.5 });
    if (latticeOn) add(lattice({ nx: 8, ny: 3, nz: 8, s: 1.6, center: [0, 0, -3], color: 0x5e5e5e }));
    const a = createAndroid({ mode: 'ghost', intensity: 1.0 }); add(a.root);
    const L = []; for (let i = 0; i < loops; i++) { const r = add(loopRing(0.38 + i * 0.09, 1.25 + i * 0.12)); r.position.set(0, 1.86, 0); L.push(r); }
    const core = add(particles({ count: 1200, shape: 'gauss', spread: [0.12, 0.12, 0.1], center: [0, 0, 0], color: 0xe01822, size: 0.03, opacity: 0.95, drift: 0.12, xray: true })); core.position.set(0, 1.42, 0.06);
    return {
      update(lt) { a.pose(withIdle(POSES.stand, lt + 2)); a.setXrayTime(lt); if (dust) dust.tick(lt); core.tick(lt);
        L.forEach((r, i) => { const sp = (1.6 + i * 0.4) * (i % 2 ? -1 : 1); r.rotation.z = stopAt == null || lt < stopAt ? lt * sp : stopAt * sp + (1 - Math.exp(-(lt - stopAt) * 3)) * 0.6 * Math.sign(sp); }); },
      camera: camera || dolly([[0, [0.3, 1.5, 3.4], [0, 1.55, 0], 32], [1, [-0.3, 1.75, 2.3], [0, 1.7, 0], 30]]),
    };
  } };
}

// 4. row of cubes; indices in `red` turn red at local time redAt
export function objectRow({ t0, bg = 'black', xin = 'smear', n = 10, red = [1, 3, 5, 7, 9], redAt = 1.0 }) {
  return { t0, bg, xin, build({ scene, add }) {
    const pol = bg === 'white' ? 1 : 0, dust = stage(scene, add, bg);
    const row = []; for (let i = 0; i < n; i++) { const b = add(cube(0.42, { pol })); b.position.set(-(n - 1) / 2 + i, 0, 0); row.push(b); }
    return {
      update(lt) { if (dust) dust.tick(lt); row.forEach((b, i) => { b.setRed(red.includes(i) && lt > redAt + i * 0.06); b.rotation.y = lt * 0.2 + i; }); },
      camera: dolly([[0, [-(n / 2) - 1, 1.4, 3.0], [-n / 4, 0.2, 0], 34], [1, [n / 6, 1.8, 3.4], [n / 3, 0.2, 0], 32]]),
    };
  } };
}

// 5. hero prop study: one prop on the floor, slow orbit (refs' white object studies: bulb, calendar, cabinet...)
export function propStudy({ t0, bg = 'white', xin = 'smear', prop = 'bulb', scale = 4, height = 0.9, aura = false, onUpdate }) {
  return { t0, bg, xin, build({ scene, add }) {
    const dust = stage(scene, add, bg);
    const p = add(heroProp(prop, { scale }));
    const fx = aura ? add(auraFx({ center: [0, height * 1.15, -0.3], spread: [1.2, 0.5, 0.8], count: 80000 })) : null;
    return {
      update(lt) { if (dust) dust.tick(lt); if (fx) fx.tick(lt); p.rotation.y = lt * 0.15; if (onUpdate) onUpdate(p, lt); },
      camera: orbit({ target: [0, height * 0.6, 0], radius: 2.2 + height, height: height * 0.9 + 0.4, from: -25, to: 10, fov: 32 }),
      prop: p,
    };
  } };
}

// 6. walk through a free-standing doorway (optionally with a red boundary plane)
export function thresholdWalk({ t0, bg = 'black', xin = 'smear', boundaryOn = true, toward = true }) {
  return { t0, bg, xin, build({ scene, add }) {
    const pol = bg === 'white' ? 1 : 0, dust = stage(scene, add, bg);
    add(wall({ frame: true, pol }));
    const b = boundaryOn ? add(boundary({ opacity: 0.75 })) : null;
    const a = createAndroid(); add(a.root);
    return {
      update(lt) { const z = -1.6 + lt * 0.95; a.root.position.set(0, 0, toward ? z : -z); a.root.rotation.y = toward ? 0 : Math.PI; a.pose(walkPose(lt * 4.6, 0.85)); if (b) b.tick(lt); if (dust) dust.tick(lt); },
      camera: dolly([[0, [1.6, 1.4, 3.4], [0, 1.1, -0.4], 32], [1, [1.0, 1.35, 2.8], [0, 1.1, 0.2], 32]]),
    };
  } };
}

// 7. head close-up (helmet), slow orbit; turnAt makes the head turn to camera
export function headClose({ t0, bg = 'white', xin = 'glitch', turnAt = null }) {
  return { t0, bg, xin, build({ scene, add }) {
    stage(scene, add, bg, { dust: false });
    const a = createAndroid(); add(a.root);
    return {
      update(lt) { const k = turnAt == null ? 1 : ease.inOutCubic(clamp((lt - turnAt) / 0.8)); a.pose(withIdle({ ...POSES.stand, rot: { 'spine.005': [0, -55 * (1 - k), 0], 'spine.006': [4, -25 * (1 - k), 0] } }, lt)); },
      camera: orbit({ target: [0, 1.82, 0], radius: 1.2, height: 1.86, from: -18, to: 4, fov: 30 }),
    };
  } };
}

// 8. final question: hologram + red core (+ doorway or loops), crane up — pair with a crossCut title
export function finale({ t0, bg = 'black', xin = 'zoom', doorway = false, loops = 0 }) {
  return { t0, bg, xin, build({ scene, add }) {
    const dust = stage(scene, add, bg, { step: 1.5 });
    add(lattice({ nx: 8, ny: 3, nz: 8, s: 1.6, center: [0, 0, -3], color: 0x5e5e5e }));
    let b = null; if (doorway) { const w = add(wall({ frame: true, pol: 0 })); w.position.z = -1.2; b = add(boundary({ opacity: 0.85 })); b.position.z = -1.2; }
    const a = createAndroid({ mode: 'ghost', intensity: 1.0 }); add(a.root); a.root.position.z = doorway ? 0.4 : 0;
    const L = []; for (let i = 0; i < loops; i++) { const r = add(loopRing(0.35 + i * 0.09, 1.2 + i * 0.12)); r.position.set(0, 1.86, a.root.position.z); L.push(r); }
    const core = add(particles({ count: 1200, shape: 'gauss', spread: [0.12, 0.12, 0.1], center: [0, 0, 0], color: 0xe01822, size: 0.03, opacity: 0.95, drift: 0.12, xray: true })); core.position.set(0, 1.42, a.root.position.z + 0.06);
    return {
      update(lt) { a.pose(withIdle(POSES.stand, lt + 3)); a.setXrayTime(lt); if (dust) dust.tick(lt); core.tick(lt); if (b) b.tick(lt); L.forEach((r, i) => { r.rotation.z = lt * (1.2 + i * 0.4) * (i % 2 ? -1 : 1); }); },
      camera: dolly([[0, [0.3, 0.6, 5.0], [0, 1.3, 0], 34], [1, [-0.6, 2.0, 3.6], [0, 1.4, 0], 30]]),
    };
  } };
}
