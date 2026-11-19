// EP002 "The Last Room" (doorway effect). 16:9, ~62 s. Timing from audio/words.json.
import * as THREE from 'three';
import { createAndroid, POSES, walkPose, walkWith, withIdle, mixPose, extend } from 'holo/android.js';
import { grid, trace, rings, particles, door, lattice, setBackground, blobShadow, polyline } from 'holo/env.js';
import { cube, table, desk, chair, panel, arc, wall, boundary, filmStrip, calendar, heroProp } from 'holo/props.js';
import { orbit, dolly } from 'holo/runtime.js';
import { INKS } from 'holo/text.js';
import { loadNarration } from 'holo/sync.js';
import { ease, clamp, rng } from 'holo/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export default async function () {
  const N = await loadNarration('/films/ep002_doorways/audio');
  const w = N.w, cut = N.cut;
  const T = [];
  const title = (str, k, n, opt = {}) => { const t0 = (typeof k === 'number' ? k : w(k, n)) - 0.1; T.push({ str, t0, t1: t0 + (opt.hold ?? 1.6), pos: opt.pos || [0.5, 0.14], size: opt.size || 60, color: opt.color || INKS.red, style: opt.style }); };
  const darkStage = (scene, add, o = {}) => { setBackground(scene, 'black', o.near ?? 4, o.far ?? 32); add(grid({ color: 0x8a8a8a, width: 1.25, step: o.step ?? 2.0 })); return o.dust === false ? null : add(particles({ count: 2500, spread: [16, 6, 16], center: [0, 3, 0], size: 0.02, opacity: 0.45 })); };
  const whiteStage = (scene, add, o = {}) => { setBackground(scene, 'white', o.near ?? 6, o.far ?? 42); add(grid({ color: 0x8f8f8f, width: 1.2, step: o.step ?? 2.6, size: 120 })); };
  const held = (pol = 1) => { const c = cube(0.24, { red: true, pol }); return c; };   // the carried object
  const holdAt = (a, c) => { const p = a.root.localToWorld(V(0, 1.02, 0.42)); c.position.copy(p).add(V(0, -0.12, 0)); c.rotation.y = a.root.rotation.y; };

  const shots = []; const S = o => shots.push(o);

  // S01 walking through a door toward camera, then stopping, blank  -------------------------------
  S({ t0: 0, bg: 'black', xin: 'cut', build({ scene, add }) {
    const dust = darkStage(scene, add);
    const wl = add(wall({ frame: true, pol: 0 })); wl.position.z = -1.2;
    const a = createAndroid(); add(a.root);
    return {
      update(lt) { const k = clamp(lt / 1.9); a.root.position.set(0, 0, -2.6 + 2.4 * ease.outCubic(k)); a.pose(lt < 1.9 ? walkPose(lt * 4.6, 0.8 * (1 - k * 0.6)) : withIdle(extend(POSES.stand, { rot: { 'spine.005': [0, 25 * Math.sin((lt - 1.9) * 2), 0] } }), lt)); dust.tick(lt); },
      camera: dolly([[0, [0.9, 1.25, 3.4], [0, 1.2, -1], 34], [1, [0.6, 1.45, 2.6], [0, 1.45, -0.5], 32]]),
      hud: (lt, t, P) => [{ t0: 1.7, t1: 3.0, anchor: () => P(V(0, 1.97, -0.2)), label: 'INTENT', value: '???', side: 1, r: 16 }],
    };
  } });
  title('Forget why', 'forget', 0, { pos: [0.5, 0.86], hold: 1.2 });

  // S02 the door itself, push into the doorway  ------------------------------------------------
  S({ t0: cut('l02'), bg: 'white', xin: 'smear', build({ scene, add }) {
    whiteStage(scene, add);
    const d = add(door({ polarity: 1, open: 0.35 }));
    const b = add(boundary({ opacity: 0 }));
    const td = w('door', 0) - cut('l02');
    return {
      update(lt) { b.tick(lt); b.mat.uniforms.opacity.value = 0.8 * ease.outCubic(clamp((lt - td + 0.1) / 0.3)); d.setOpen(0.35 + 0.1 * Math.sin(lt)); },
      camera: dolly([[0, [1.4, 1.3, 4.2], [0, 1.1, 0], 32], [1, [0.5, 1.2, 2.4], [0, 1.1, 0], 30]]),
    };
  } });
  title('Not your memory', 'memory', 0, { color: INKS.dark, pos: [0.5, 0.12], size: 52, hold: 1.0 });
  title("It's the door", 'door', 0, { pos: [0.5, 0.86], hold: 1.0 });

  // S03 the lab: a floorplan of rooms joined by doorways, top-down crane  ----------------------------
  S({ t0: cut('l03'), bg: 'black', xin: 'smear', build({ scene, add }) {
    const dust = darkStage(scene, add, { far: 40 });
    for (let i = -2; i <= 2; i++) { const wl = add(wall({ w: 6, pol: 0, h: 1.6 })); wl.position.set(0, 0, i * 4); }
    for (const x of [-3, 3]) { const sw = add(wall({ w: 16, doorway: false, pol: 0, h: 1.6 })); sw.position.set(x, 0, 0); sw.rotation.y = Math.PI / 2; }
    for (let i = -2; i < 2; i++) { const tb = add(table({ pol: 0 })); tb.position.set(1.4 * (i % 2 ? 1 : -1), 0, i * 4 + 2); }
    return {
      update(lt) { dust.tick(lt); },
      camera: dolly([[0, [7.5, 9.5, 9.0], [0, 0, 1], 34], [1, [4.0, 7.0, 4.5], [0, 0, -1.5], 34]]),
      hud: (lt, t, P) => [{ t0: 3.5, t1: 7.4, anchor: () => P(V(0, 1.6, 0)), label: 'TEST', value: 'DOORWAYS', side: 1 }],
    };
  } });
  title('2011', '2011', 0, { pos: [0.18, 0.14], size: 92, hold: 2.4 });
  title('Notre Dame', 'notre', 0, { color: INKS.light, pos: [0.74, 0.16], size: 44, hold: 2.2 });
  S({ t0: w('radvansky') - 0.1, reuse: true, camera: dolly([[0, [2.3, 3.4, 3.9], [-1.0, 0.4, 1.9], 34], [1, [2.0, 3.0, 3.6], [-1.2, 0.5, 1.9], 34]]) });
  S({ t0: w('notre') - 0.1, reuse: true, camera: dolly([[0, [0.2, 13, 0.6], [0, 0, 0], 34], [1, [0.2, 11.5, 0.4], [0, 0, -0.5], 34]]) });

  // S04 carrying an object from table to table  -----------------------------------------------------
  S({ t0: cut('l04'), bg: 'white', xin: 'smear', build({ scene, add }) {
    whiteStage(scene, add);
    const t1 = add(table()); t1.position.set(-2.2, 0, -0.7);
    const t2 = add(table()); t2.position.set(2.6, 0, -0.7);
    const a = createAndroid(); add(a.root);
    const c = add(held());
    const sh = add(blobShadow(0.55, 0.1));
    return {
      update(lt) { const x = -1.8 + lt * 0.95; a.root.position.set(x, 0, 0); a.root.rotation.y = Math.PI / 2; a.pose(walkWith(lt * 4.4, POSES.carry, 0.7)); holdAt(a, c); sh.position.x = x; },
      camera: (lt) => { const x = -1.8 + lt * 0.95; return { pos: [x - 0.6, 1.35, 4.2], target: [x + 0.6, 1.05, 0], fov: 34 }; },
    };
  } });
  title('Room after room', 'room', 1, { color: INKS.dark, pos: [0.5, 0.13], size: 54, hold: 1.6 });
  { const t0 = w('another') - 0.1, off = t0 - cut('l04');
    S({ t0, reuse: true, camera: lt => { const x = -1.8 + (lt + off) * 0.95; return { pos: [x + 2.0, 0.55, 1.6], target: [x, 1.0, 0], fov: 32 }; } }); }

  // S05 two lanes: through a doorway vs same distance, no door  -----------------------------------------
  S({ t0: cut('l05'), bg: 'black', xin: 'zoom', build({ scene, add }) {
    const dust = darkStage(scene, add);
    const wl = add(wall({ frame: true, pol: 0 })); wl.position.set(-1.3, 0, 0);
    const bd = add(boundary({ opacity: 0.7 })); bd.position.set(-1.3, 0, 0.0);
    const lane = add(polyline([[0.2, 0.01, -3], [0.2, 0.01, 3]], { color: 0xe41b26, width: 1.4, dashed: true }));
    const A = createAndroid(); add(A.root); const B = createAndroid(); add(B.root);
    const ca = add(held(0)), cb = add(held(0));
    return {
      update(lt) {
        const z = -2.2 + lt * 0.95;
        A.root.position.set(-1.3, 0, z); B.root.position.set(1.3, 0, z);
        A.pose(walkWith(lt * 4.4, POSES.carry, 0.7)); B.pose(walkWith(lt * 4.4 + 0.6, POSES.carry, 0.7));
        holdAt(A, ca); holdAt(B, cb); dust.tick(lt); bd.tick(lt);
      },
      camera: dolly([[0, [0, 3.6, 6.0], [0, 0.8, 0], 34], [1, [0, 3.0, 5.0], [0, 0.9, 0.4], 34]]),
      hud: (lt, t, P) => [
        { t0: 0.5, t1: 4.6, anchor: () => P(V(-1.3, 2.3, 0)), label: 'PATH A', value: 'DOORWAY', side: -1, r: 14 },
        { t0: 2.3, t1: 4.6, anchor: () => P(V(1.3, 2.3, 0)), label: 'PATH B', value: 'NO DOOR', side: 1, r: 14 },
      ],
    };
  } });
  title('Same distance', 'distance', 0, { color: INKS.light, pos: [0.5, 0.86], size: 48, hold: 1.4 });
  { const t0 = w('others') - 0.1, off = t0 - cut('l05');   // angle: side tracking along both lanes
    S({ t0, reuse: true, camera: lt => { const z = -2.2 + (lt + off) * 0.95; return { pos: [4.2, 1.35, z + 0.6], target: [0, 1.0, z], fov: 34 }; } }); }

  // S06 crossing the doorway: the carried object dissolves  ------------------------------------------
  S({ t0: cut('l06'), bg: 'white', xin: 'smear', build({ scene, add }) {
    whiteStage(scene, add);
    const wl = add(wall({ frame: true })); wl.position.z = 0;
    const bd = add(boundary({ opacity: 0.75 }));
    const a = createAndroid(); add(a.root);
    const c = add(held());
    const dustC = add(particles({ count: 1800, shape: 'gauss', spread: [0.25, 0.25, 0.25], center: [0, 0, 0], color: 0xe01822, size: 0.03, opacity: 0, additive: false, drift: 0 }));
    const tf = w('forgot') - cut('l06');
    return {
      update(lt) {
        const z = -1.6 + lt * 0.95; a.root.position.set(0, 0, z); a.pose(walkWith(lt * 4.4, POSES.carry, 0.7)); holdAt(a, c); bd.tick(lt);
        const k = clamp((lt - tf + 0.2) / 0.5); c.visible = k < 0.2; dustC.position.copy(c.position); dustC.material.uniforms.opacity.value = k > 0 ? 1 - k * 0.6 : 0; dustC.material.uniforms.drift.value = k * 5; dustC.tick(lt);
      },
      camera: dolly([[0, [1.6, 1.4, 3.4], [0, 1.1, -0.4], 32], [1, [1.0, 1.35, 2.8], [0, 1.1, 0.2], 32]]),
      hud: (lt, t, P) => [{ t0: 0.3, t1: tf, anchor: () => P(c.position.clone()), label: 'OBJECT', value: 'HELD', side: 1, r: 14 }],
    };
  } });
  title('Forgot more', 'forgot', 0, { pos: [0.5, 0.14], hold: 1.6 });
  { const t0 = w('forgot') - 0.3, off = t0 - cut('l06');
    S({ t0, reuse: true, camera: lt => { const z = -1.6 + (lt + off) * 0.95; return { pos: [1.5, 1.6, z + 2.6], target: [0, 1.3, z + 0.2], fov: 32 }; } }); }

  // S07 life as a film, cut into scenes  -------------------------------------------------------------
  S({ t0: cut('l07'), bg: 'black', xin: 'zoom', build({ scene, add }) {
    darkStage(scene, add, { dust: false });
    const f = add(filmStrip({ n: 9, pol: 0 })); f.position.set(0, 1.4, 0);
    // each frame holds a tiny 'scene' (hero props) — life cut into scenes
    const kinds = [['bed', 0.22], ['clock', 0.9], ['bulb', 1.6], ['phone', 2.0], ['headphones', 1.5], ['cabinet', 0.32], ['hourglass', 0.9], ['brain', 1.5], ['clock', 0.9]];
    f.frames.forEach((p, i) => { const [k, sc] = kinds[i]; const h = heroProp(k, { scale: sc }); h.position.set(0, -0.22, 0.09); if (k === 'bed') h.rotation.y = Math.PI / 2; if (k === 'clock') h.setTime(2 + i, 10); p.add(h); });
    const ts = w('scenes') - cut('l07');
    const marks = [];
    for (let i = 0; i < 8; i++) { const m = add(polyline([[0, -0.45, 0.05], [0, 0.45, 0.05]], { color: 0xe41b26, width: 2.2 })); m.position.set((i - 3.5) * 1.04, 1.4, 0); m.visible = false; marks.push(m); }
    return {
      update(lt) { f.position.x = -lt * 0.35; marks.forEach((m, i) => { m.position.x = (i - 3.5) * 1.04 - lt * 0.35; m.visible = lt > ts + i * 0.05; }); f.frames.forEach((p, i) => { p.position.z = lt > ts ? Math.sin(i * 1.3) * 0.15 * ease.outCubic(clamp((lt - ts) / 0.4)) : 0; }); },
      camera: dolly([[0, [-1.5, 1.7, 3.6], [0, 1.4, 0], 32], [1, [-0.6, 1.6, 3.0], [0.2, 1.4, 0], 32]]),
    };
  } });
  title('Not a film', 'film', 0, { color: INKS.light, pos: [0.5, 0.14], size: 50, hold: 1.4 });
  title('Scenes', 'scenes', 0, { pos: [0.5, 0.86], size: 72, hold: 1.0 });
  S({ t0: w('cuts') - 0.1, reuse: true, camera: dolly([[0, [0.5, 1.45, 1.6], [0.7, 1.4, 0], 30], [1, [0.2, 1.45, 1.4], [0.6, 1.4, 0], 30]]) });

  // S08 scene over: door closes, old scene filed away  ----------------------------------------------------
  S({ t0: cut('l08'), bg: 'white', xin: 'whip', build({ scene, add }) {
    whiteStage(scene, add);
    const d = add(door({ polarity: 1, open: 0.6 }));
    const panels = []; for (let i = 0; i < 5; i++) { const p = add(panel({ w: 0.7, h: 0.45, pol: 1, red: i === 0 ? 0.3 : 0 })); p.position.set(-1.6, 0.9 + i * 0.5, -0.6); p.rotation.y = 0.5; panels.push(p); }
    const tf = w('file') - cut('l08');
    return {
      update(lt) { d.setOpen(0.6 * (1 - ease.inOutCubic(clamp((lt - 0.2) / 0.9)))); panels.forEach((p, i) => { const k = ease.inCubic(clamp((lt - tf - i * 0.06) / 0.6)); p.position.set(-1.6 - k * 3, 0.9 + i * 0.5, -0.6 - k * 2); }); },
      camera: dolly([[0, [1.8, 1.5, 4.0], [-0.4, 1.2, 0], 32], [1, [1.3, 1.5, 3.4], [-0.4, 1.2, 0], 32]]),
    };
  } });
  title('Scene over', 'over', 0, { color: INKS.dark, pos: [0.62, 0.12], size: 52, hold: 1.1 });
  title('Start fresh', 'fresh', 0, { pos: [0.62, 0.86], hold: 0.9 });
  S({ t0: w('file') - 0.1, reuse: true, camera: dolly([[0, [-0.6, 1.6, 2.8], [-2.6, 1.7, -1.2], 32], [1, [-1.2, 1.7, 2.4], [-3.8, 1.8, -2.0], 32]]) });

  // S09 hologram head with a red boundary plane passing through  ---------------------------------------
  S({ t0: cut('l09'), bg: 'black', xin: 'smear', build({ scene, add }) {
    const dust = darkStage(scene, add, { step: 1.5 });
    const a = createAndroid({ mode: 'ghost', intensity: 1.0 }); add(a.root);
    const bd = add(boundary({ w: 1.2, h: 1.2, opacity: 0.85 })); bd.position.set(0, 1.25, 0); bd.rotation.y = Math.PI / 2;
    return {
      update(lt) { a.pose(withIdle(POSES.stand, lt + 2)); a.setXrayTime(lt); dust.tick(lt); bd.tick(lt); bd.position.x = -0.6 + lt * 0.5; },
      camera: dolly([[0, [1.3, 1.7, 2.4], [0, 1.6, 0], 32], [1, [0.8, 1.75, 1.9], [0, 1.7, 0], 30]]),
    };
  } });
  title('Event boundary', 'boundary', 0, { pos: [0.5, 0.13], hold: 1.8 });
  S({ t0: w('boundary') - 0.1, reuse: true, camera: dolly([[0, [-1.1, 1.8, 1.4], [0, 1.75, 0], 30], [1, [-0.9, 1.8, 1.2], [0, 1.75, 0], 30]]) });

  // S10 glitch -> tool  -----------------------------------------------------------------------------
  S({ t0: cut('l10'), bg: 'white', xin: 'glitch', build({ scene, add }) {
    whiteStage(scene, add);
    const a = createAndroid(); add(a.root);
    const tt = w('tool') - cut('l10');
    return {
      update(lt) { a.pose(withIdle(mixPose(POSES.stand, POSES.handsOpen, ease.inOutCubic(clamp((lt - tt + 0.3) / 0.5))), lt)); },
      camera: orbit({ target: [0, 1.5, 0], radius: 2.6, height: 1.6, from: 20, to: -5, fov: 30 }),
    };
  } });
  title('A glitch?', 'glitch', 0, { color: INKS.dark, pos: [0.3, 0.13], size: 52, hold: 1.0 });
  title('A tool', 'tool', 0, { pos: [0.7, 0.86], size: 72, hold: 0.9 });

  // S11 say it out loud at the threshold  ----------------------------------------------------------
  S({ t0: cut('l11'), bg: 'black', xin: 'smear', build({ scene, add }) {
    const dust = darkStage(scene, add);
    const wl = add(wall({ frame: true, pol: 0 })); wl.position.z = -0.6;
    const a = createAndroid(); add(a.root); a.root.position.z = 0.3;
    const R = add(rings({ radii: [0.12, 0.2, 0.3], width: 1.4 })); R.position.set(0.0, 1.8, 0.48); R.rotation.x = Math.PI / 2;
    const tl = w('loud') - cut('l11');
    return {
      update(lt) { a.pose(withIdle(POSES.stand, lt + 4)); dust.tick(lt); R.visible = lt > tl - 0.1; R.children.forEach((r, i) => { const s = 1 + ((lt * 1.6 + i * 0.33) % 1) * 1.5; r.scale.set(s, 1, s); }); },
      camera: dolly([[0, [1.4, 1.6, 2.6], [0, 1.6, 0], 32], [1, [1.0, 1.7, 2.1], [0, 1.7, 0], 30]]),
      hud: (lt, t, P) => [{ t0: 0.6, t1: 3.4, anchor: () => P(V(0.0, 1.8, 0.45)), label: 'SAY', value: 'KEYS', side: 1, r: 13 }],
    };
  } });
  title('Out loud', 'loud', 0, { pos: [0.5, 0.86], size: 66, hold: 0.9 });
  S({ t0: w('loud') - 0.1, reuse: true, camera: dolly([[0, [-0.5, 1.85, 1.3], [0, 1.8, 0.3], 30], [1, [-0.4, 1.85, 1.1], [0, 1.8, 0.3], 30]]) });

  // S12 carry it across the line  -------------------------------------------------------------------
  S({ t0: cut('l12'), bg: 'white', xin: 'whip', build({ scene, add }) {
    whiteStage(scene, add);
    const line = add(polyline([[-3, 0.01, 0], [3, 0.01, 0]], { color: 0xe41b26, width: 2.6 }));
    const a = createAndroid(); add(a.root);
    const c = add(held());
    const sh = add(blobShadow(0.55, 0.1));
    return {
      update(lt) { const z = -1.4 + lt * 0.9; a.root.position.set(0, 0, z); a.pose(walkWith(lt * 4.4, POSES.carry, 0.7)); holdAt(a, c); sh.position.z = z; },
      camera: dolly([[0, [2.6, 0.5, 2.0], [0, 0.7, -0.4], 32], [1, [2.2, 0.6, 2.6], [0, 0.8, 0.4], 32]]),
    };
  } });
  title('On purpose', 'purpose', 0, { pos: [0.5, 0.13], hold: 1.0 });

  // S13 the thought you can't put down — seated, a heavy red block on the desk  ------------------------------
  S({ t0: cut('l13'), bg: 'black', xin: 'smear', build({ scene, add }) {
    const dust = darkStage(scene, add);
    const d = add(desk({ pol: 0 })); d.position.set(0.15, 0, 0.55);
    const ch = add(chair({ pol: 0 })); ch.position.set(0, 0, -0.1);
    const a = createAndroid(); add(a.root); a.root.position.set(0, 0, -0.12);
    const c = add(cube(0.3, { red: true, pol: 0 })); c.position.set(0.15, 0.74, 0.62);
    const L = add(arc({ r: 0.32, width: 2 })); L.setProgress(1); L.position.set(0.15, 0.9, 0.62);
    return {
      update(lt) { a.pose(withIdle(extend(POSES.sit, { dir: { 'upper_arm.L': [0.2, -0.75, 0.6], 'forearm.L': [-0.1, -0.3, 1], 'upper_arm.R': [-0.2, -0.75, 0.6], 'forearm.R': [0.1, -0.3, 1] }, rot: { 'spine.005': [24, 0, 0], 'spine.002': [8, 0, 0] } }), lt)); L.rotation.x = 0.3; L.rotation.y = lt * 1.5; dust.tick(lt); },
      camera: dolly([[0, [2.0, 1.6, 2.4], [0.1, 0.9, 0.4], 30], [1, [1.5, 1.4, 2.0], [0.1, 0.9, 0.45], 30]]),
    };
  } });
  title("Can't put down", 'down', 0, { color: INKS.light, pos: [0.5, 0.13], size: 52, hold: 1.2 });
  title('Tonight', 'tonight', 0, { pos: [0.5, 0.86], size: 66, hold: 0.8 });
  S({ t0: w('tonight') - 0.1, reuse: true, camera: dolly([[0, [0.7, 1.15, 1.5], [0.15, 0.85, 0.6], 30], [1, [0.6, 1.1, 1.35], [0.15, 0.85, 0.6], 30]]) });

  // S14 set it down on the other side, walk out, door closes  ---------------------------------------
  S({ t0: cut('l14'), bg: 'white', xin: 'smear', build({ scene, add }) {
    whiteStage(scene, add);
    const d = add(door({ polarity: 1, open: 0.7 })); d.position.z = 0.02;
    const tb = add(table()); tb.position.set(1.2, 0, -1.4);
    const a = createAndroid(); add(a.root);
    const c = add(held());
    const tEnd = w('end') - cut('l14');
    return {
      update(lt) {
        const putT = 1.3;
        if (lt < putT) { a.root.position.set(0.9, 0, -0.9); a.root.rotation.y = Math.PI * 0.75; a.pose(POSES.carry); holdAt(a, c); }
        else { c.position.set(1.2, 0.74, -1.4); c.rotation.y = 0.6; const k = lt - putT; a.root.rotation.y = 0; a.root.position.set(0, 0, -0.9 + k * 0.95); a.pose(walkPose(k * 4.6, 0.85)); }
        d.setOpen(0.7 * (1 - ease.inOutCubic(clamp((lt - tEnd + 0.5) / 0.6))));
      },
      camera: dolly([[0, [2.2, 1.6, 3.6], [0.3, 1.0, -0.6], 32], [1, [1.6, 1.5, 4.2], [0, 1.1, 0.2], 32]]),
      hud: (lt, t, P) => [{ t0: 1.5, t1: 4.0, anchor: () => P(V(1.2, 0.9, -1.4)), label: 'THOUGHT', value: 'LEFT', side: 1, r: 13 }],
    };
  } });
  title('Walk out', 'walk', 2, { color: INKS.dark, pos: [0.5, 0.13], size: 52, hold: 1.0 });
  title('Let the scene end', 'end', 0, { pos: [0.5, 0.86], size: 54, hold: 1.0 });
  S({ t0: w('walk', 2) - 0.1, reuse: true, camera: dolly([[0, [1.9, 0.7, 3.3], [0, 1.2, 0.2], 34], [1, [1.6, 0.75, 3.6], [0, 1.25, 0.6], 34]]) });

  // S15 corridor of doors, hologram walking  -------------------------------------------------------
  S({ t0: cut('l15'), bg: 'black', xin: 'zoom', build({ scene, add }) {
    darkStage(scene, add, { far: 30, dust: false });
    for (let i = 0; i < 8; i++) { const wl = add(wall({ frame: true, pol: 0 })); wl.position.z = -i * 3.2; const b = add(boundary({ opacity: 0.4 })); b.position.z = -i * 3.2; b.tick(i); }
    const a = createAndroid({ mode: 'ghost', intensity: 1.0 }); add(a.root);
    return {
      update(lt) { a.root.position.set(0, 0, 1.4 - lt * 0.95); a.root.rotation.y = Math.PI; a.pose(walkPose(lt * 4.6, 0.85)); a.setXrayTime(lt); },
      camera: (lt) => ({ pos: [0.3, 1.5, 4.6 - lt * 0.95], target: [0, 1.2, -3 - lt * 0.95], fov: 36 }),
    };
  } });
  title('Every room', 'room', 3, { color: INKS.light, pos: [0.5, 0.13], size: 52, hold: 1.3 });
  title('One question', 'question', 0, { pos: [0.5, 0.86], size: 56, hold: 1.0 });

  // S16 close-up: what do we keep?  ----------------------------------------------------------------
  S({ t0: cut('l16'), bg: 'white', xin: 'glitch', build({ scene, add }) {
    whiteStage(scene, add);
    const a = createAndroid(); add(a.root);
    return {
      update(lt) { a.pose(withIdle(POSES.stand, lt + 6)); },
      camera: orbit({ target: [0, 1.82, 0], radius: 1.2, height: 1.86, from: -18, to: 4, fov: 30 }),
    };
  } });
  title('What do we keep?', 'keep', 0, { pos: [0.5, 0.86], size: 56, hold: 1.2 });

  // S17 final question: hologram before a glowing doorway  -----------------------------------------
  S({ t0: cut('l17'), bg: 'black', xin: 'zoom', build({ scene, add }) {
    const dust = darkStage(scene, add, { step: 1.5 });
    add(lattice({ nx: 8, ny: 3, nz: 8, s: 1.6, center: [0, 0, -3], color: 0x5e5e5e }));
    const wl = add(wall({ frame: true, pol: 0 })); wl.position.z = -1.2;
    const b = add(boundary({ opacity: 0.85 })); b.position.z = -1.2;
    const a = createAndroid({ mode: 'ghost', intensity: 1.0 }); add(a.root); a.root.position.z = 0.4;
    const core = add(particles({ count: 1200, shape: 'gauss', spread: [0.12, 0.12, 0.1], center: [0, 0, 0], color: 0xe01822, size: 0.03, opacity: 0.95, drift: 0.12, xray: true })); core.position.set(0, 1.42, 0.46);
    return {
      update(lt) { a.pose(withIdle(POSES.stand, lt + 3)); a.setXrayTime(lt); dust.tick(lt); core.tick(lt); b.tick(lt); },
      camera: dolly([[0, [0.3, 0.6, 5.0], [0, 1.3, 0], 34], [1, [-0.6, 2.0, 3.6], [0, 1.4, 0], 30]]),
    };
  } });
  S({ t0: w('last') - 0.25, reuse: true, camera: dolly([[0, [0.5, 1.75, 2.6], [0, 1.6, 0.4], 30], [1, [0.3, 1.72, 2.3], [0, 1.62, 0.4], 30]]) });
  T.push({ str: 'What did you leave in the last room?', t0: w('what', 2) - 0.1, t1: N.end + 1.0, pos: [0.5, 0.14], size: 50, color: INKS.red, crossCut: true });

  const dur = N.end + 1.6;
  return {
    duration: dur, shots, texts: T,
    glitches: [[w('door', 0) + 0.05, 0.08, 0.6], [w('forgot') + 0.05, 0.1, 0.7], [w('glitch') + 0.05, 0.12, 0.9], [w('keep') - 0.05, 0.1, 0.7]],
    logo: [[w('notre') + 0.3, 0.06, 0.12], [dur - 0.5, 0.06, 0.12]],
    hudCues: [1.7, cut('l03') + 3.5, cut('l05') + 0.5, cut('l05') + 2.3, cut('l06') + 0.3, cut('l11') + 0.6, cut('l14') + 1.5],
  };
}
