// EP001 "Open Loops" — pilot. 16:9, ~66 s. Timing is derived from the narration (audio/words.json).
import * as THREE from 'three';
import { createAndroid, POSES, walkPose, withIdle, mixPose, extend } from 'holo/android.js';
import { grid, trace, rings, ring, particles, door, lattice, setBackground, blobShadow, pillar } from 'holo/env.js';
import { cube, table, desk, chair, card, calendar, panel, arc, bar } from 'holo/props.js';
import { orbit, dolly } from 'holo/runtime.js';
import { INKS } from 'holo/text.js';
import { loadNarration } from 'holo/sync.js';
import { ease, clamp, rng } from 'holo/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export default async function () {
  const N = await loadNarration('/films/ep001_open_loops/audio');
  const w = N.w, we = N.we, cut = N.cut;
  const T = [];  // titles
  const title = (str, k, n, opt = {}) => { const t0 = (typeof k === 'number' ? k : w(k, n)) - 0.1; T.push({ str, t0, t1: opt.t1 ?? t0 + (opt.hold ?? 1.6), pos: opt.pos || [0.5, 0.14], size: opt.size || 60, color: opt.color || INKS.red, style: opt.style, align: opt.align }); };

  // ------------------------------------------------ shared builders
  const darkStage = (scene, add, o = {}) => { setBackground(scene, 'black', o.near ?? 4, o.far ?? 32); add(grid({ color: 0x8a8a8a, width: 1.25, step: o.step ?? 2.0 })); if (o.dust !== false) return add(particles({ count: 2500, spread: [16, 6, 16], center: [0, 3, 0], size: 0.02, opacity: 0.45 })); };
  const whiteStage = (scene, add, o = {}) => { setBackground(scene, 'white', o.near ?? 6, o.far ?? 42); add(grid({ color: 0x8f8f8f, width: 1.2, step: o.step ?? 2.6, size: 120 })); };
  const loopRing = (r, tilt) => { const g = new THREE.Group(); const a = arc({ r, width: 2.2 }); a.setProgress(1); g.add(a); g.rotation.x = tilt; return g; };

  const shots = [];
  const S = (o) => shots.push(o);

  // S01 desk, frozen reach toward a red cube  ------------------------------------------------
  S({ t0: 0, bg: 'black', xin: 'cut', build({ scene, add }) {
    const dust = darkStage(scene, add);
    const d = add(desk({ pol: 0 })); d.position.set(0.15, 0, 0.55);
    const c = add(chair({ pol: 0 })); c.position.set(0, 0, -0.1);
    const a = createAndroid(); add(a.root); a.root.position.set(0, 0, -0.12);
    const box0 = add(cube(0.22, { red: true, pol: 0 })); box0.position.set(0.55, 0.92, 0.75);
    return {
      update(lt) { a.pose(withIdle(extend(POSES.sit, { dir: { 'upper_arm.L': [0.45, -0.35, 0.8], 'forearm.L': [0.3, 0.0, 1] } }), lt)); dust.tick(lt); box0.rotation.y = lt * 0.4; box0.position.y = 0.92 + Math.sin(lt * 2) * 0.02; },
      camera: dolly([[0, [2.6, 0.7, 2.9], [0.2, 0.95, 0.3], 32], [1, [1.9, 1.05, 2.2], [0.25, 1.0, 0.35], 30]]),
      hud: (lt, t, P) => [{ t0: 0.4, t1: 2.6, anchor: () => P(V(0.55, 1.03, 0.75)), label: 'TASK', value: 'OPEN', side: 1, r: 18 }],
    };
  } });
  title('Never finished', 'finished', 0, { pos: [0.3, 0.16], hold: 0.75 });

  // S02 head close-up, red loop orbiting the head  -----------------------------------------------
  S({ t0: cut('l02'), bg: 'white', xin: 'smear', build({ scene, add }) {
    whiteStage(scene, add);
    const a = createAndroid(); add(a.root);
    const L1 = add(loopRing(0.26, 1.3)), L2 = add(loopRing(0.31, 1.5));
    L1.position.set(0, 1.88, 0); L2.position.set(0, 1.88, 0);
    return {
      update(lt) { a.pose(withIdle(POSES.stand, lt + 1)); L1.rotation.z = lt * 1.6; L2.rotation.z = -lt * 1.1; L1.rotation.y = lt * 0.7; },
      camera: orbit({ target: [0, 1.75, 0], radius: 1.55, height: 1.82, from: 28, to: 4, fov: 30 }),
      hud: (lt, t, P) => [{ t0: 0.9, t1: 3.3, anchor: () => P(V(0.06, 1.95, 0.1)), label: 'PROCESS', value: 'ACTIVE', side: -1, r: 15 }],
    };
  } });
  title('Still working', 'working', 0, { color: INKS.dark, pos: [0.5, 0.12], hold: 1.3 });
  title('Right now', 'right', 0, { pos: [0.72, 0.8], hold: 1.0 });

  // S03 café of wire tables, waiter walking  -----------------------------------------------------
  S({ t0: cut('l03'), bg: 'black', xin: 'smear', build({ scene, add }) {
    const dust = darkStage(scene, add, { step: 2.4 });
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 1; j++) {
      const tb = add(table({ pol: 0 })); tb.position.set(i * 1.9 + (j % 2) * 0.6, 0, j * 1.9);
      const ch = add(chair({ pol: 0 })); ch.position.set(i * 1.9 + (j % 2) * 0.6 - 0.62, 0, j * 1.9); ch.rotation.y = Math.PI / 2;
    }
    const a = createAndroid(); add(a.root);
    return {
      update(lt) { a.root.position.set(-3.2 + lt * 1.05, 0, 0.95); a.root.rotation.y = Math.PI / 2; a.pose(walkPose(lt * 5.0, 0.9)); dust.tick(lt); },
      camera: dolly([[0, [-5.5, 3.6, 6.2], [-1.2, 0.6, 0], 34], [1, [-2.0, 2.4, 5.0], [0.6, 0.8, 0.4], 32]]),
    };
  } });
  title('1920s', '1920s', 0, { pos: [0.24, 0.13], size: 92, hold: 2.0 });
  title('Berlin', 'berlin', 0, { color: INKS.light, pos: [0.76, 0.16], size: 44, hold: 1.6 });
  { const t0 = w('berlin') - 0.1, off = t0 - cut('l03');   // angle: low tracking on the waiter
    S({ t0, reuse: true, camera: lt => { const x = -3.2 + (lt + off) * 1.05; return { pos: [x - 1.0, 2.7, 3.2], target: [x + 0.3, 1.0, 0.95], fov: 32 }; } }); }

  // S04 the waiter, mid shot  ---------------------------------------------------------------------
  S({ t0: w('strange') - 0.08, bg: 'white', xin: 'glitch', build({ scene, add }) {
    whiteStage(scene, add);
    const tb = add(table()); tb.position.set(0.9, 0, -0.4);
    const a = createAndroid(); add(a.root);
    const sh = add(blobShadow(0.55, 0.1));
    return {
      update(lt) { a.pose(withIdle(POSES.stand, lt + 4)); },
      camera: orbit({ target: [0, 1.25, 0], radius: 3.4, height: 1.3, from: -30, to: -12, fov: 32 }),
      hud: (lt, t, P) => [{ t0: 0.3, t1: 2.8, anchor: () => P(V(0, 1.98, 0)), label: 'SUBJECT', value: 'WAITER', side: 1 }],
    };
  } });
  title('A waiter', 'waiter', 0, { color: INKS.dark, pos: [0.72, 0.5], hold: 1.2 });

  // S05 order cards orbiting his head  ---------------------------------------------------------
  S({ t0: cut('l04'), bg: 'black', xin: 'smear', build({ scene, add }) {
    const dust = darkStage(scene, add);
    const a = createAndroid(); add(a.root);
    const cards = [];
    for (let i = 0; i < 7; i++) { const c = add(card({ pol: 0 })); cards.push(c); }
    return {
      update(lt) {
        a.pose(withIdle(POSES.thinker, lt)); dust.tick(lt);
        cards.forEach((c, i) => { const ang = i / 7 * Math.PI * 2 + lt * 0.45; const k = ease.outCubic(clamp((lt - 0.4 - i * 0.12) / 0.6)); c.position.set(Math.cos(ang) * 1.05 * k, 1.75 + Math.sin(ang * 2 + i) * 0.12, Math.sin(ang) * 1.05 * k); c.lookAt(0, 1.8, 0); c.scale.setScalar(Math.max(0.001, k)); });
      },
      camera: dolly([[0, [0.6, 1.2, 4.2], [0, 1.6, 0], 32], [1, [0.3, 1.55, 3.1], [0, 1.72, 0], 30]]),
      hud: (lt, t, P) => [{ t0: 1.2, t1: 4.4, anchor: () => P(V(-0.05, 1.98, 0.1)), label: 'ORDERS', value: '7   NOTES: 0', side: -1 }],
    };
  } });
  title('Every open order', 'every', 0, { color: INKS.light, pos: [0.5, 0.12], size: 50, hold: 1.4 });
  title('Perfectly', 'perfectly', 0, { pos: [0.5, 0.86], hold: 0.9 });
  S({ t0: w('perfectly') - 0.12, reuse: true, camera: dolly([[0, [1.6, 0.9, 2.1], [0, 1.6, 0], 32], [1, [1.4, 0.95, 1.9], [0, 1.65, 0], 32]]) });

  // S06 one card pays out and dissolves  ------------------------------------------------------
  S({ t0: cut('l05'), bg: 'white', xin: 'zoom', build({ scene, add }) {
    whiteStage(scene, add);
    const c = add(card()); c.position.set(0, 1.3, 0);
    const R = rng(4), n = 2200, pos = new Float32Array(n * 3), sd = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = (R() - 0.5) * 0.32; pos[i * 3 + 1] = 1.3 + (R() - 0.5) * 0.44; pos[i * 3 + 2] = (R() - 0.5) * 0.02; sd[i] = R(); }
    const dustA = add(particles({ count: n, spread: [0.32, 0.44, 0.02], center: [0, 1.3, 0], color: 0x222222, size: 0.03, opacity: 0, additive: false, drift: 0 }));
    const gone = w('gone') - cut('l05');
    return {
      update(lt) {
        const k = clamp((lt - gone + 0.15) / 0.5);
        c.visible = k < 0.25; c.rotation.y = Math.sin(lt * 0.8) * 0.3; c.position.y = 1.3 + lt * 0.03;
        dustA.material.uniforms.opacity.value = k > 0 ? 1 - clamp((k - 0.5) / 0.5) * 0.7 : 0;
        dustA.material.uniforms.drift.value = k * 6; dustA.position.y = -k * 0.6; dustA.tick(lt * 2);
      },
      camera: dolly([[0, [0.0, 1.35, 1.8], [0, 1.3, 0], 30], [1, [0.25, 1.4, 1.35], [0, 1.3, 0], 30]]),
      hud: (lt, t, P) => [{ t0: 0.2, t1: gone, anchor: () => P(V(0.12, 1.5, 0)), label: 'BILL', value: 'PAID', side: 1, r: 14 }],
    };
  } });
  title('Gone', 'gone', 0, { pos: [0.5, 0.5], size: 120, hold: 0.9, style: 'title' });

  // S07 the lab: Zeigarnik at a desk with task blocks  ----------------------------------------------------
  S({ t0: cut('l06'), bg: 'white', xin: 'whip', build({ scene, add }) {
    whiteStage(scene, add);
    const d = add(desk()); d.position.set(0, 0, 0.6);
    const ch = add(chair()); ch.position.set(0, 0, -0.05);
    const a = createAndroid(); add(a.root); a.root.position.set(0, 0, -0.08);
    const blocks = []; for (let i = 0; i < 5; i++) { const b = add(cube(0.12)); b.position.set(-0.4 + i * 0.2, 0.74, 0.7); blocks.push(b); }
    return {
      update(lt) { a.pose(withIdle(extend(POSES.sit, { dir: { 'upper_arm.R': [-0.25, -0.75, 0.6], 'forearm.R': [0.15, -0.25, 1] } }), lt)); },
      camera: dolly([[0, [-2.4, 1.6, 3.2], [0, 0.9, 0.3], 32], [1, [-1.6, 1.4, 2.6], [0, 0.95, 0.3], 30]]),
      hud: (lt, t, P) => [{ t0: 0.5, t1: 3.0, anchor: () => P(V(0, 1.85, -0.08)), label: 'LAB', value: '1927', side: 1 }],
    };
  } });
  title('Bluma Zeigarnik', 'bluma', 0, { color: INKS.dark, pos: [0.5, 0.13], size: 52, hold: 1.9 });
  S({ t0: w('lab') - 0.1, reuse: true, camera: dolly([[0, [0.9, 1.15, 1.6], [0, 0.8, 0.6], 30], [1, [0.7, 1.1, 1.4], [0, 0.8, 0.6], 30]]) });

  // S08 a row of tasks; half get interrupted (turn red)  -------------------------------------------------
  S({ t0: cut('l07'), bg: 'black', xin: 'smear', build({ scene, add }) {
    const dust = darkStage(scene, add);
    const row = []; for (let i = 0; i < 10; i++) { const b = add(cube(0.42, { pol: 0 })); b.position.set(-4.5 + i, 0, 0); row.push(b); }
    const tInt = w('interrupted') - cut('l07');
    return {
      update(lt) { dust.tick(lt); row.forEach((b, i) => { b.setRed(i % 2 === 1 && lt > tInt + i * 0.06); b.rotation.y = lt * 0.2 + i; }); },
      camera: dolly([[0, [-6.0, 1.4, 3.0], [-2.5, 0.2, 0], 34], [1, [1.5, 1.8, 3.4], [3.0, 0.2, 0], 32]]),
    };
  } });
  title('Interrupted', 'interrupted', 0, { pos: [0.5, 0.16], hold: 1.6 });
  S({ t0: w('interrupted') - 0.08, reuse: true, camera: dolly([[0, [-1.6, 0.35, 1.7], [1.0, 0.25, 0], 32], [1, [-0.6, 0.4, 1.6], [2.0, 0.25, 0], 32]]) });

  // S09 recall bars: unfinished almost 2x  --------------------------------------------------------------
  S({ t0: cut('l08'), bg: 'white', xin: 'smear', build({ scene, add }) {
    whiteStage(scene, add);
    const b1 = add(bar({ w: 0.7, h: 0.01 })); b1.position.set(-0.6, 0, 0);
    const b2 = add(bar({ w: 0.7, h: 0.01, red: true })); b2.position.set(0.6, 0, 0);
    const tw = w('twice') - cut('l08');
    return {
      update(lt) { const k = ease.outCubic(clamp((lt - 0.4) / 1.2)); b1.setH(1.0 * k); b2.setH(Math.max(0.01, 1.0 * k + 0.9 * ease.outExpo(clamp((lt - tw) / 0.6)))); },
      camera: dolly([[0, [2.4, 1.0, 4.4], [0, 0.9, 0], 32], [1, [1.6, 1.2, 3.8], [0, 1.0, 0], 32]]),
      hud: (lt, t, P) => [{ t0: 0.6, t1: 3.6, anchor: () => P(V(0.6, 1.95, 0)), label: 'RECALL', value: 'UNFINISHED', side: 1, r: 14 }],
    };
  } });
  title('2x', 'twice', 0, { pos: [0.27, 0.36], size: 150, hold: 1.4, style: 'heavy' });
  S({ t0: w('twice') - 0.1, reuse: true, camera: dolly([[0, [2.7, 0.4, 3.6], [0.3, 1.0, 0], 34], [1, [2.4, 0.45, 3.3], [0.35, 1.1, 0], 34]]) });

  // S10 hologram with a loop running round the head  -----------------------------------------------
  S({ t0: cut('l09'), bg: 'black', xin: 'zoom', build({ scene, add }) {
    const dust = darkStage(scene, add, { step: 1.5 });
    const a = createAndroid({ mode: 'ghost', intensity: 1.0 }); add(a.root);
    const L1 = add(loopRing(0.42, 1.35)); L1.position.set(0, 1.86, 0);
    const core = add(particles({ count: 1200, shape: 'gauss', spread: [0.12, 0.12, 0.1], center: [0, 0, 0], color: 0xe01822, size: 0.03, opacity: 0.95, drift: 0.12, xray: true })); core.position.set(0, 1.88, 0.02);
    return {
      update(lt) { a.pose(withIdle(POSES.stand, lt + 2)); a.setXrayTime(lt); L1.rotation.z = lt * 2.2; dust.tick(lt); core.tick(lt); },
      camera: dolly([[0, [0.3, 1.5, 3.4], [0, 1.55, 0], 32], [1, [-0.3, 1.75, 2.3], [0, 1.7, 0], 30]]),
    };
  } });
  title('Open loop', 'open', 1, { pos: [0.5, 0.13], hold: 1.3 });
  title('In the background', 'background', 0, { color: INKS.light, pos: [0.5, 0.86], size: 40, hold: 1.0 });

  // S11 corridor of half-open doors  ---------------------------------------------------------------
  S({ t0: cut('l10'), bg: 'white', xin: 'smear', build({ scene, add }) {
    whiteStage(scene, add, { far: 34 });
    const doors = []; for (let i = 0; i < 9; i++) for (const sx of [-1, 1]) { const d = add(door({ polarity: 1 })); d.position.set(sx * 1.6, 0, -i * 2.4); d.rotation.y = sx * Math.PI / 2; doors.push(d); }
    const a = createAndroid(); add(a.root);
    return {
      update(lt) { a.root.position.set(0, 0, 1 - lt * 1.05); a.root.rotation.y = Math.PI; a.pose(walkPose(lt * 5.0, 0.9)); doors.forEach((d, i) => d.setOpen(0.18 + 0.12 * Math.sin(i * 1.7))); },
      camera: (lt) => ({ pos: [0.35, 1.5, 4.6 - lt * 1.0], target: [0, 1.1, -3 - lt * 1.0], fov: 36 }),
    };
  } });
  title('Almost starting', 'almost', 1, { color: INKS.dark, pos: [0.5, 0.13], size: 52, hold: 1.4 });

  // S12 unsent message panel  ---------------------------------------------------------------------
  S({ t0: w('message') - 0.25, bg: 'black', xin: 'glitch', build({ scene, add }) {
    darkStage(scene, add, { dust: false });
    const p = add(panel({ w: 1.6, h: 1.0, pol: 0, red: 0.35 })); p.position.set(0, 1.3, 0);
    return {
      update(lt) { p.rotation.y = -0.35 + lt * 0.12; p.position.y = 1.3 + Math.sin(lt) * 0.03; },
      camera: dolly([[0, [0.8, 1.4, 2.6], [0, 1.3, 0], 32], [1, [0.4, 1.35, 2.0], [0, 1.3, 0], 32]]),
      hud: (lt, t, P) => [{ t0: 0.3, t1: 2.0, anchor: () => P(V(0.45, 0.9, 0.05)), label: 'STATUS', value: 'UNSENT', side: 1, r: 13 }],
    };
  } });
  title('Never sent', 'sent', 0, { pos: [0.5, 0.15], hold: 0.9 });

  // S13 someday — a calendar with no date  ----------------------------------------------------------
  S({ t0: w('thing', 0) - 0.15, bg: 'white', xin: 'smear', build({ scene, add }) {
    whiteStage(scene, add);
    const c = add(calendar()); c.position.set(0, 1.3, 0); c.rotation.y = 0.35;
    return {
      update(lt) { c.rotation.y = 0.35 - lt * 0.08; },
      camera: dolly([[0, [0.9, 1.25, 3.2], [0, 1.3, 0], 32], [1, [0.5, 1.3, 2.6], [0, 1.3, 0], 32]]),
    };
  } });
  title('Someday', 'someday', 0, { pos: [0.5, 0.13], hold: 1.2 });

  // S14 open tabs floating around the head  ---------------------------------------------------------
  S({ t0: cut('l11'), bg: 'black', xin: 'zoom', build({ scene, add }) {
    const dust = darkStage(scene, add);
    const a = createAndroid(); add(a.root);
    const R = rng(11), tabs = [];
    for (let i = 0; i < 16; i++) { const p = add(panel({ w: 0.55, h: 0.34, pol: 0, red: R() < 0.4 ? 0.3 : 0 })); tabs.push([p, R() * Math.PI * 2, 0.9 + R() * 0.9, 1.3 + R() * 1.2, R()]); }
    return {
      update(lt) { a.pose(withIdle(POSES.stand, lt + 5)); dust.tick(lt); tabs.forEach(([p, a0, r, y, s], i) => { const k = ease.outCubic(clamp((lt - i * 0.08) / 0.5)); const ang = a0 + lt * (0.15 + s * 0.2); p.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r); p.lookAt(0, y, 0); p.scale.setScalar(Math.max(0.001, k)); }); },
      camera: orbit({ target: [0, 1.6, 0], radius: 3.6, height: 1.9, from: -20, to: 15, fov: 34 }),
    };
  } });
  title('Open tabs', 'tab', 0, { pos: [0.5, 0.13], hold: 1.6 });

  // S15 the turn: head turns to camera  --------------------------------------------------------------
  S({ t0: cut('l12'), bg: 'black', xin: 'glitch', build({ scene, add }) {
    darkStage(scene, add, { dust: false });
    const a = createAndroid(); add(a.root);
    return {
      update(lt) { const k = ease.inOutCubic(clamp((lt - 0.6) / 0.8)); a.pose({ ...POSES.stand, rot: { 'spine.005': [0, -55 * (1 - k), 0], 'spine.006': [4, -25 * (1 - k), 0] } }); },
      camera: dolly([[0, [0.0, 1.78, 1.25], [0, 1.78, 0], 30], [1, [0.0, 1.8, 1.0], [0, 1.8, 0], 30]]),
    };
  } });
  title('Nobody tells you', 'nobody', 0, { pos: [0.5, 0.86], size: 52, hold: 1.4 });

  // S16 the loop closes  ---------------------------------------------------------------------------
  S({ t0: cut('l13'), bg: 'white', xin: 'smear', build({ scene, add }) {
    whiteStage(scene, add);
    const p = add(pillar({ h: 1.0, r: 0.25 }));
    const A = add(arc({ r: 0.7, width: 2.6 })); A.position.y = 0.02;
    const tc = w('close') - cut('l13');
    return {
      update(lt) { A.setProgress(lt < tc ? 0.86 : 0.86 + 0.14 * ease.outExpo(clamp((lt - tc) / 0.25))); A.rotation.y = -lt * 0.25; },
      camera: dolly([[0, [1.6, 1.9, 2.6], [0, 0.6, 0], 32], [1, [1.2, 2.1, 2.1], [0, 0.55, 0], 32]]),
    };
  } });
  title("Don't finish it", 'finish', 0, { color: INKS.dark, pos: [0.5, 0.13], size: 50, hold: 0.9 });
  title('Close it', 'close', 0, { pos: [0.5, 0.86], hold: 0.95 });

  // S17 a specific plan — one red day  ------------------------------------------------------------
  S({ t0: cut('l14'), bg: 'white', xin: 'whip', build({ scene, add }) {
    whiteStage(scene, add);
    const c = add(calendar()); c.position.set(0.4, 1.4, 0); c.rotation.y = -0.3;
    const a = createAndroid(); add(a.root); a.root.position.set(-1.0, 0, 0.6); a.root.rotation.y = 0.7;
    const ts = w('specific') - cut('l14');
    return {
      update(lt) { a.pose(withIdle(mixPose(POSES.stand, POSES.reach, ease.inOutCubic(clamp((lt - ts + 0.4) / 0.6))), lt)); c.light(17, lt > ts); },
      camera: dolly([[0, [-0.2, 1.5, 4.4], [0, 1.3, 0], 34], [1, [0.0, 1.45, 3.6], [0.1, 1.3, 0], 32]]),
      hud: (lt, t, P) => [{ t0: ts + 0.1, t1: 3.7, anchor: () => P(V(0.4 + 0.14 * 0.95, 1.4 - 0.0, 0.02)), label: 'PLAN', value: 'SPECIFIC', side: 1, r: 14 }],
    };
  } });
  title('A specific plan', 'specific', 0, { color: INKS.dark, pos: [0.5, 0.09], size: 50, hold: 1.5 });
  title('Quiets the loop', 'quiets', 0, { color: INKS.dark, pos: [0.5, 0.86], size: 44, hold: 1.0 });
  S({ t0: w('quiets') - 0.1, reuse: true, camera: dolly([[0, [0.75, 1.4, 1.7], [0.5, 1.33, 0], 30], [1, [0.6, 1.38, 1.4], [0.5, 1.33, 0], 30]]) });

  // S18 decided — the loop stops  -------------------------------------------------------------------
  S({ t0: cut('l15'), bg: 'black', xin: 'smear', build({ scene, add }) {
    const dust = darkStage(scene, add, { step: 1.5 });
    const a = createAndroid({ mode: 'ghost', intensity: 1.0 }); add(a.root);
    const L1 = add(loopRing(0.42, 1.35)); L1.position.set(0, 1.86, 0);
    const td = w('decided') - cut('l15');
    return {
      update(lt) { a.pose(withIdle(POSES.stand, lt + 7)); a.setXrayTime(lt); dust.tick(lt); const spin = lt < td ? lt * 2.2 : td * 2.2 + (1 - Math.exp(-(lt - td) * 3)) * 0.7; L1.rotation.z = spin; L1.scale.setScalar(lt < td ? 1 : 1 - 0.25 * ease.outCubic(clamp((lt - td) / 0.5))); },
      camera: dolly([[0, [0.0, 1.7, 2.6], [0, 1.65, 0], 32], [1, [0.2, 1.75, 2.0], [0, 1.7, 0], 30]]),
    };
  } });
  title('Not done', 'done', 0, { color: INKS.light, pos: [0.5, 0.13], size: 52, hold: 1.2 });
  title('Decided', 'decided', 0, { pos: [0.5, 0.86], size: 72, hold: 1.1 });
  S({ t0: w('decided') - 0.1, reuse: true, camera: dolly([[0, [0.0, 1.92, 1.15], [0, 1.86, 0], 30], [1, [0.15, 1.9, 1.0], [0, 1.86, 0], 30]]) });

  // S19 pick one, write it down  ---------------------------------------------------------------------
  S({ t0: cut('l16'), bg: 'white', xin: 'whip', build({ scene, add }) {
    whiteStage(scene, add);
    const d = add(desk()); d.position.set(0, 0, 0.55);
    const ch = add(chair()); ch.position.set(0, 0, -0.05);
    const a = createAndroid(); add(a.root); a.root.position.set(0, 0, -0.08);
    const c = add(card({ w: 0.3, h: 0.4 })); c.position.set(0.15, 0.745, 0.6); c.rotation.x = -Math.PI / 2;
    return {
      update(lt) { a.pose(withIdle(extend(POSES.sit, { dir: { 'upper_arm.L': [0.25, -0.8, 0.55], 'forearm.L': [-0.15, -0.35, 1] }, rot: { 'spine.002': [12, 0, 0], 'spine.005': [20, 0, 0] } }), lt)); },
      camera: dolly([[0, [1.5, 1.9, 2.0], [0.1, 0.8, 0.4], 30], [1, [1.0, 1.75, 1.6], [0.1, 0.8, 0.45], 30]]),
      hud: (lt, t, P) => [{ t0: 0.8, t1: 2.6, anchor: () => P(V(0.15, 0.75, 0.6)), label: 'WHEN', value: 'TUE 19:00', side: 1, r: 14 }],
    };
  } });
  title('Pick one', 'pick', 0, { pos: [0.3, 0.13], hold: 1.0 });
  title('Exactly when', 'exactly', 0, { color: INKS.dark, pos: [0.66, 0.86], size: 50, hold: 1.0 });

  // S20 two minutes, tonight  --------------------------------------------------------------------
  S({ t0: cut('l17'), bg: 'black', xin: 'smear', build({ scene, add }) {
    const dust = darkStage(scene, add);
    const A = add(arc({ r: 0.9, width: 2.6 })); A.position.y = 0.02;
    const R2 = add(rings({ radii: [1.25, 1.6], width: 1.2 }));
    const a = createAndroid(); add(a.root);
    return {
      update(lt) { a.pose(withIdle(POSES.stand, lt + 9)); dust.tick(lt); A.setProgress(clamp(lt / 2.1)); A.rotation.y = Math.PI / 2; R2.rotation.y = lt * 0.2; },
      camera: dolly([[0, [2.3, 2.6, 3.3], [0, 0.8, 0], 32], [1, [1.6, 2.2, 2.6], [0, 0.9, 0], 32]]),
      hud: (lt, t, P) => [{ t0: 0.3, t1: 2.2, anchor: () => P(V(0.9, 0.02, 0)), label: 'TIMER', value: '02:00', side: 1, r: 12 }],
    };
  } });
  title('Two minutes', 'two', 0, { color: INKS.light, pos: [0.5, 0.13], size: 52, hold: 1.0 });
  title('Tonight', 'tonight', 0, { pos: [0.5, 0.86], size: 76, hold: 0.85 });

  // S21 carrying all of them  ----------------------------------------------------------------------
  S({ t0: cut('l18'), bg: 'white', xin: 'smear', build({ scene, add }) {
    whiteStage(scene, add);
    const a = createAndroid(); add(a.root);
    const sh = add(blobShadow(0.55, 0.1));
    const R = rng(21), bx = [];
    for (let i = 0; i < 14; i++) { const b = add(cube(0.16 + R() * 0.12, { red: R() < 0.5 })); bx.push([b, R() * 6.28, 0.5 + R() * 0.5, 1.0 + R() * 1.3]); }
    return {
      update(lt) { const x = -1.6 + lt * 0.9; a.root.position.set(x, 0, 0); a.root.rotation.y = Math.PI / 2; a.pose(walkPose(lt * 4.2, 0.7)); sh.position.x = x; bx.forEach(([b, a0, r, y], i) => { const ang = a0 + lt * 0.6; b.position.set(x + Math.cos(ang) * r - 0.25, y + Math.sin(lt * 2 + i) * 0.05, Math.sin(ang) * r); b.rotation.set(lt + i, lt * 0.7, 0); }); },
      camera: (lt) => { const x = -1.6 + lt * 0.9; return { pos: [x - 0.4, 1.3, 4.0], target: [x + 0.5, 1.1, 0], fov: 34 }; },
    };
  } });
  title('Either way', 'either', 0, { color: INKS.dark, pos: [0.5, 0.13], size: 54, hold: 1.2 });
  { const t0 = w('carrying') - 0.1, off = t0 - cut('l18');
    S({ t0, reuse: true, camera: lt => { const x = -1.6 + (lt + off) * 0.9; return { pos: [x + 2.2, 0.6, 1.7], target: [x, 1.2, 0], fov: 32 }; } }); }

  // S22 final question  ----------------------------------------------------------------------------
  S({ t0: cut('l19'), bg: 'black', xin: 'zoom', build({ scene, add }) {
    const dust = darkStage(scene, add, { step: 1.5 });
    add(lattice({ nx: 8, ny: 3, nz: 8, s: 1.6, center: [0, 0, -2], color: 0x5e5e5e }));
    const a = createAndroid({ mode: 'ghost', intensity: 1.0 }); add(a.root);
    const loops = []; for (let i = 0; i < 5; i++) { const L = add(loopRing(0.35 + i * 0.09, 1.2 + i * 0.12)); L.position.set(0, 1.86, 0); loops.push(L); }
    const core = add(particles({ count: 1200, shape: 'gauss', spread: [0.12, 0.12, 0.1], center: [0, 0, 0], color: 0xe01822, size: 0.03, opacity: 0.95, drift: 0.12, xray: true })); core.position.set(0, 1.42, 0.06);
    return {
      update(lt) { a.pose(withIdle(POSES.stand, lt + 3)); a.setXrayTime(lt); dust.tick(lt); core.tick(lt); loops.forEach((L, i) => { L.rotation.z = lt * (1.2 + i * 0.4) * (i % 2 ? -1 : 1); }); },
      camera: dolly([[0, [0.2, 0.5, 5.2], [0, 1.3, 0], 34], [1, [-0.6, 2.2, 3.4], [0, 1.4, 0], 30]]),
    };
  } });
  S({ t0: w('still', 1) - 0.1, reuse: true, camera: dolly([[0, [0.3, 4.2, 1.8], [0, 1.2, 0], 34], [1, [0.0, 4.6, 1.2], [0, 1.2, 0], 34]]) });
  T.push({ str: 'Which one is still running?', t0: w('which') - 0.1, t1: N.end + 1.0, pos: [0.5, 0.14], size: 54, color: INKS.red, crossCut: true });

  const dur = N.end + 1.6;
  return {
    duration: dur,
    shots,
    texts: T,
    glitches: [[w('strange'), 0.1, 0.7], [w('gone') + 0.05, 0.08, 0.6], [w('nobody') - 0.05, 0.1, 0.8], [w('running', 1) + 0.1, 0.12, 0.7]],
    logo: [[w('lab') + 0.2, 0.06, 0.12], [dur - 0.5, 0.06, 0.12]],
    hudCues: [0.4, cut('l02') + 0.9, w('strange') + 0.2, cut('l04') + 1.2, cut('l06') + 0.5, cut('l08') + 0.6, w('message'), w('specific'), cut('l16') + 0.8, cut('l17') + 0.3],
  };
}
