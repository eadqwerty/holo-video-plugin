// EP003 "Too Busy to See" (Darley & Batson 1973, hurry and helping). 16:9, ~69 s. Timing from audio/words.json.
// TRIAL: faster story pacing — tighter narration (179 wpm), more angle cuts (~36 shots), whip/glitch on beats.
import * as THREE from 'three';
import { createAndroid, POSES, walkPose, walkWith, withIdle, mixPose, extend } from 'holo/android.js';
import { grid, rings, particles, lattice, setBackground, blobShadow, polyline, box } from 'holo/env.js';
import { cube, card, wall, boundary, heroProp } from 'holo/props.js';
import { orbit, dolly } from 'holo/runtime.js';
import { INKS } from 'holo/text.js';
import { loadNarration } from 'holo/sync.js';
import { ease, clamp } from 'holo/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---- poses used only here -------------------------------------------------------------------------
// hurried walk: longer stride, torso and head pitched forward
const hurry = (ph, s = 1.15) => { const p = walkPose(ph, s); p.rot['spine.002'] = [10, 0, 0]; p.rot['spine.005'] = [8, 0, 0]; return p; };
// the man in the doorway: sitting on the ground, legs out, head down, arms limp
const SLUMP = {
  dir: { 'upper_arm.L': [0.3, -1, 0.2], 'forearm.L': [0.1, -0.55, 1], 'upper_arm.R': [-0.3, -1, 0.2], 'forearm.R': [-0.1, -0.55, 1],
    'thigh.L': [0.14, 0.08, 1], 'shin.L': [0.05, -0.3, 1], 'thigh.R': [-0.14, 0.08, 1], 'shin.R': [-0.05, -0.3, 1] },
  rot: { 'spine.001': [-8, 0, 0], 'spine.003': [14, 0, 0], 'spine.005': [40, 0, 0], 'spine.006': [12, 0, 0] },
  hips: [0, -0.86, -0.04],
};
// stopping to help: crouched, bent forward, right hand reaching down
const HELP = extend(POSES.stand, {
  dir: { 'thigh.L': [0.1, -0.55, 0.85], 'shin.L': [0, -1, -0.25], 'thigh.R': [-0.1, -0.55, 0.85], 'shin.R': [0, -1, -0.25],
    'upper_arm.R': [-0.15, -0.55, 0.85], 'forearm.R': [-0.05, -0.6, 0.8], 'upper_arm.L': [0.3, -0.9, 0.3], 'forearm.L': [0.2, -0.6, 0.6] },
  rot: { 'spine.002': [24, 0, 0], 'spine.003': [12, 0, 0], 'spine.005': [18, 0, 0] }, hips: [0, -0.34, -0.06],
});
const PHONE = { dir: { 'upper_arm.R': [-0.12, -0.92, 0.35], 'forearm.R': [0.4, 0.3, 1], 'upper_arm.L': [0.2, -1, 0.05], 'forearm.L': [0.1, -1, 0.15] } };
const HAND_UP = extend(POSES.stand, { dir: { 'upper_arm.R': [-0.25, 0.95, 0.15], 'forearm.R': [-0.05, 1, 0.1] } });

export default async function () {
  const N = await loadNarration('/films/ep003_too_busy/audio');
  const w = N.w, cut = N.cut;
  const T = [];
  const title = (str, k, n, opt = {}) => { const t0 = (typeof k === 'number' ? k : w(k, n)) - 0.1; T.push({ str, t0, t1: t0 + (opt.hold ?? 1.3), pos: opt.pos || [0.5, 0.14], size: opt.size || 60, color: opt.color || INKS.red, style: opt.style }); };
  const at = (id, k, n = 0) => w(k, n) - cut(id);           // word time local to a line's shot
  const darkStage = (scene, add, o = {}) => { setBackground(scene, 'black', o.near ?? 4, o.far ?? 32); add(grid({ color: 0x8a8a8a, width: 1.25, step: o.step ?? 2.0 })); return o.dust === false ? null : add(particles({ count: 2500, spread: [16, 6, 16], center: [0, 3, 0], size: 0.02, opacity: 0.45 })); };
  const whiteStage = (scene, add, o = {}) => { setBackground(scene, 'white', o.near ?? 6, o.far ?? 42); add(grid({ color: 0x8f8f8f, width: 1.2, step: o.step ?? 2.6, size: 120 })); };
  const stage = (bg, scene, add, o) => (bg === 'white' ? (whiteStage(scene, add, o), null) : darkStage(scene, add, o));

  // the alley: a long wall with one doorway, the man slumped in it, two crates. Walkers pass along z = PATH.
  const PATH = -0.3;
  const alley = (add, pol, { man = true, ghostMan = false } = {}) => {
    const wl = add(wall({ w: 14, h: 3.0, pol })); wl.position.z = -1.1;
    const end = add(wall({ w: 4, h: 3.0, doorway: false, pol })); end.position.set(6.8, 0, 0.8); end.rotation.y = -Math.PI / 2;
    for (const [x, s] of [[-2.6, 0.5], [-2.15, 0.36], [2.9, 0.44]]) { const c = add(cube(s, { pol })); c.position.set(x, s / 2, -0.75); c.rotation.y = x; }
    let m = null;
    if (man) { m = createAndroid(ghostMan ? { mode: 'ghost', intensity: 1.0 } : {}); add(m.root); m.root.position.set(0, 0, -1.02); m.pose(SLUMP); }
    return m;
  };
  const coughRings = (add) => { const R = add(rings({ radii: [0.1, 0.17, 0.25], width: 1.4 })); R.position.set(0, 1.0, -0.5); R.rotation.x = Math.PI / 2; R.visible = false; return R; };
  const pulse = (R, lt, hits) => { const h = hits.filter(x => lt >= x - 0.05 && lt < x + 0.9); R.visible = h.length > 0; if (h.length) { const k = (lt - h[h.length - 1]) / 0.9; R.children.forEach((r, i) => { const s = 1 + clamp(k * 1.4 - i * 0.15, 0, 2) * 1.6; r.scale.set(s, 1, s); }); } };
  const spinClock = (c, lt, rate) => { const m = lt * rate; c.setTime(8 + Math.floor((55 + m) / 60), (55 + m) % 60, (lt * 60 * (rate > 30 ? 6 : 1)) % 60); };

  const shots = []; const S = o => shots.push(o);
  const A = (t0, camera, xin = 'cut') => S({ t0, reuse: true, camera, xin });   // angle cut

  // S01 hook: hurrying toward camera, camera retreating  ------------------------------------------
  S({ t0: 0, bg: 'black', xin: 'cut', build({ scene, add }) {
    const dust = darkStage(scene, add);
    const a = createAndroid(); add(a.root);
    const Z = lt => -3.2 + lt * 1.55;
    return {
      update(lt) { a.root.position.set(0, 0, Z(lt)); a.pose(hurry(lt * 6.6)); dust.tick(lt); },
      camera: lt => ({ pos: [0.7, 1.35, Z(lt) + 3.0 - lt * 0.15], target: [0, 1.25, Z(lt)], fov: 34 }),
      hud: (lt, t, P) => [{ t0: 0.35, t1: 2.6, anchor: () => P(a.root.position.clone().add(V(0, 2.0, 0))), label: 'STATUS', value: 'LATE', side: 1, r: 14 }],
    };
  } });
  A(w('talk') - 0.1, lt => { const z = -3.2 + (lt + w('talk') - 0.1) * 1.55; return { pos: [2.4, 0.42, z + 0.4], target: [0, 0.55, z], fov: 30 }; });
  title('Kindness', 'kindness', 0, { pos: [0.5, 0.86], size: 66, hold: 0.9 });

  // S02 stepping over the man (side-on, low)  ------------------------------------------------------
  S({ t0: cut('l02'), bg: 'white', xin: 'smear', build({ scene, add }) {
    whiteStage(scene, add);
    const m = alley(add, 1);
    const a = createAndroid(); add(a.root); const sh = add(blobShadow(0.55, 0.1));
    const ts = at('l02', 'stepped') + 0.25;
    const X = lt => (lt - ts) * 1.55;
    return {
      update(lt) { a.root.position.set(X(lt), 0, PATH); a.root.rotation.y = Math.PI / 2; a.pose(hurry(lt * 6.6)); sh.position.set(X(lt), 0, PATH); m.pose(withIdle(SLUMP, lt, 0.3)); },
      camera: lt => ({ pos: [X(lt) * 0.35 - 0.4, 0.75, 3.1], target: [X(lt) * 0.5, 0.55, -0.4], fov: 32 }),
      hud: (lt, t, P) => [{ t0: 0.2, t1: at('l02', 'man') - 0.1, anchor: () => P(V(0, 0.95, -0.85)), label: 'SUBJECT', value: 'IN NEED', side: -1, r: 13 }],
    };
  } });
  title('Stepped over', 'stepped', 0, { pos: [0.5, 0.13], hold: 1.1 });
  A(w('man') - 0.1, dolly([[0, [0.9, 0.35, 0.9], [0, 0.75, -0.9], 30], [1, [0.7, 0.4, 0.75], [0, 0.8, -0.95], 30]]));

  // S03 Princeton: two buildings, a dashed route between  -------------------------------------------
  const campus = (add, pol) => {
    for (const x of [-3.2, 3.2]) { const b = add(box(2.4, 2.6, 1.8, { polarity: pol })); b.position.set(x, 0, -1.2); const f = add(wall({ w: 2.4, h: 2.6, pol, openW: 0.9, openH: 1.9 })); f.position.set(x, 0, -0.28); }
    add(polyline([[-3.2, 0.02, 0.2], [-1.6, 0.02, 1.4], [1.6, 0.02, 1.4], [3.2, 0.02, 0.2]], { color: 0xe41b26, width: 2.0, dashed: true }));
  };
  S({ t0: cut('l03'), bg: 'black', xin: 'whip', build({ scene, add }) {
    const dust = darkStage(scene, add, { far: 40 });
    campus(add, 0);
    return {
      update(lt) { dust.tick(lt); },
      camera: dolly([[0, [6.5, 4.6, 8.0], [0, 0.8, 0], 34], [1, [4.6, 3.8, 6.6], [0, 0.9, 0], 34]]),
      hud: (lt, t, P) => [{ t0: 2.2, t1: 6.2, anchor: () => P(V(-3.2, 2.7, -1.2)), label: 'SITE', value: 'SEMINARY', side: 1 }],
    };
  } });
  title('1973', '1973', 0, { pos: [0.18, 0.14], size: 92, hold: 2.0 });
  title('Princeton', 'princeton', 0, { color: INKS.light, pos: [0.76, 0.16], size: 44, hold: 1.6 });
  A(w('darley') - 0.1, dolly([[0, [-6.0, 2.0, 3.8], [0.5, 1.0, -0.6], 34], [1, [-5.2, 2.1, 3.4], [0.8, 1.0, -0.6], 34]]));
  title('Darley & Batson', 'darley', 0, { color: INKS.light, pos: [0.5, 0.86], size: 46, hold: 1.6 });

  // S04 subjects: a row of seminarians  -------------------------------------------------------------
  S({ t0: cut('l04'), bg: 'white', xin: 'smear', build({ scene, add }) {
    whiteStage(scene, add);
    const row = [-1.8, -0.6, 0.6, 1.8].map((x, i) => { const a = createAndroid(); add(a.root); a.root.position.set(x, 0, -i * 0.15); return a; });
    return {
      update(lt) { row.forEach((a, i) => a.pose(withIdle(POSES.stand, lt + i * 1.7))); },
      camera: dolly([[0, [-3.2, 1.5, 3.6], [-0.6, 1.2, 0], 32], [1, [-1.6, 1.55, 3.2], [0.4, 1.25, 0], 32]]),
      hud: (lt, t, P) => [{ t0: 0.3, t1: 2.1, anchor: () => P(V(-0.6, 2.05, -0.15)), label: 'SUBJECTS', value: 'SEMINARIANS', side: 1, r: 14 }],
    };
  } });
  title('Seminary students', 'seminary', 0, { color: INKS.dark, pos: [0.5, 0.86], size: 52, hold: 1.2 });

  // S05 walk to another building, give a talk  ----------------------------------------------------
  S({ t0: cut('l05'), bg: 'black', xin: 'smear', build({ scene, add }) {
    const dust = darkStage(scene, add, { far: 40 });
    campus(add, 0);
    const a = createAndroid(); add(a.root);
    const P0 = [-3.2, 0.2], P1 = [-1.6, 1.4], P2 = [1.6, 1.4];
    const pos = lt => { const d = lt * 1.05; const l1 = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]); if (d < l1) { const k = d / l1; return [P0[0] + (P1[0] - P0[0]) * k, P0[1] + (P1[1] - P0[1]) * k, Math.atan2(P1[0] - P0[0], P1[1] - P0[1])]; } const k = Math.min(1, (d - l1) / 3.2); return [P1[0] + (P2[0] - P1[0]) * k, P1[1], Math.PI / 2]; };
    return {
      update(lt) { const [x, z, r] = pos(lt); a.root.position.set(x, 0, z); a.root.rotation.y = r; a.pose(walkPose(lt * 4.8, 0.9)); dust.tick(lt); },
      camera: dolly([[0, [-1.0, 3.2, 6.2], [-1.2, 0.6, 0.6], 34], [1, [0.4, 2.6, 5.4], [0, 0.7, 0.8], 34]]),
      hud: (lt, t, P) => [{ t0: 0.4, t1: 2.6, anchor: () => P(a.root.position.clone().add(V(0, 2.0, 0))), label: 'TASK', value: 'GIVE TALK', side: 1, r: 13 }],
    };
  } });
  title('Another building', 'building', 0, { color: INKS.light, pos: [0.5, 0.14], size: 50, hold: 1.2 });

  // S06 the Good Samaritan card  -------------------------------------------------------------------
  S({ t0: cut('l06'), bg: 'white', xin: 'smear', build({ scene, add }) {
    whiteStage(scene, add);
    const a = createAndroid(); add(a.root);
    const c = add(card({ w: 0.3, h: 0.42 }));
    return {
      update(lt) { a.pose(withIdle(POSES.carry, lt)); const p = a.root.localToWorld(V(0, 1.12, 0.42)); c.position.copy(p); c.rotation.set(-0.5, Math.PI, 0); },
      camera: dolly([[0, [1.3, 1.5, 2.6], [0, 1.2, 0.2], 30], [1, [0.9, 1.45, 2.2], [0, 1.2, 0.3], 30]]),
      hud: (lt, t, P) => [{ t0: 0.9, t1: 2.6, anchor: () => P(c.position.clone()), label: 'TALK', value: 'GOOD SAMARITAN', side: 1, r: 13 }],
    };
  } });
  title('Good Samaritan', 'samaritan', 0, { pos: [0.5, 0.86], size: 58, hold: 1.2 });
  title('A stranger', 'stranger', 0, { color: INKS.dark, pos: [0.5, 0.13], size: 52, hold: 0.8 });

  // S07 the switch: time vs late (two figures, two clocks)  ------------------------------------------
  S({ t0: cut('l07'), bg: 'black', xin: 'glitch', build({ scene, add }) {
    const dust = darkStage(scene, add);
    const L = createAndroid(); add(L.root); L.root.position.x = -1.1;
    const R = createAndroid(); add(R.root); R.root.position.x = 1.1;
    const cl = add(heroProp('clock', { scale: 0.7 })); cl.position.set(-1.1, 2.25, 0);
    const cr = add(heroProp('clock', { scale: 0.7 })); cr.position.set(1.1, 2.25, 0);
    const tl = at('l07', 'late');
    return {
      update(lt) {
        L.pose(withIdle(POSES.stand, lt)); spinClock(cl, lt, 1);
        const k = clamp((lt - tl + 0.3) / 0.4); R.pose(lt < tl - 0.3 ? withIdle(POSES.stand, lt + 2) : hurry((lt - tl) * 6.6)); R.root.position.z = Math.max(0, lt - tl) * 1.4; spinClock(cr, lt, 1 + k * 160);
        dust.tick(lt);
      },
      camera: dolly([[0, [0, 1.7, 5.4], [0, 1.4, 0], 32], [1, [0, 1.6, 4.8], [0, 1.4, 0], 32]]),
      hud: (lt, t, P) => [
        { t0: 0.8, t1: 3.9, anchor: () => P(V(-1.1, 1.75, 0)), label: 'TIME', value: 'PLENTY', side: -1, r: 13 },
        { t0: at('l07', 'others'), t1: 3.9, anchor: () => P(R.root.position.clone().add(V(0, 1.75, 0))), label: 'STATUS', value: 'LATE', side: 1, r: 13 },
      ],
    };
  } });
  title('Plenty of time', 'time', 0, { color: INKS.light, pos: [0.5, 0.14], size: 48, hold: 1.0 });
  A(w('late') - 0.1, lt => { const z = Math.max(0, lt + w('late') - 0.1 - cut('l07') - (w('late') - cut('l07'))) * 1.4; return { pos: [2.4, 1.5, z + 2.4], target: [1.1, 1.5, z], fov: 30 }; });
  title("You're late", 'late', 0, { pos: [0.5, 0.86], size: 62, hold: 0.7 });

  // S08 the alley, the man in the doorway  -----------------------------------------------------------
  S({ t0: cut('l08'), bg: 'white', xin: 'whip', build({ scene, add }) {
    whiteStage(scene, add);
    const m = alley(add, 1);
    const R = coughRings(add);
    const hits = [at('l08', 'coughed'), at('l08', 'groaned')];
    return {
      update(lt) { m.pose(withIdle(SLUMP, lt, 0.3)); pulse(R, lt, hits); },
      camera: dolly([[0, [-4.6, 1.5, 0.9], [0, 0.9, -0.8], 32], [1, [-2.6, 1.3, 0.6], [0, 0.8, -0.9], 32]]),
      hud: (lt, t, P) => [{ t0: at('l08', 'slumped'), t1: 4.6, anchor: () => P(V(0, 1.15, -0.9)), label: 'MAN', value: 'SLUMPED', side: 1, r: 13 }],
    };
  } });
  title('Alley', 'alley', 0, { color: INKS.dark, pos: [0.5, 0.13], size: 52, hold: 1.0 });
  A(w('coughed') - 0.1, dolly([[0, [-0.5, 1.1, 0.5], [0, 0.95, -0.95], 28], [1, [-0.4, 1.05, 0.38], [0, 0.95, -0.95], 28]]));
  title('Groaned', 'groaned', 0, { color: INKS.light, pos: [0.5, 0.86], size: 52, hold: 0.8 });

  // S09 with time to spare: one stops and crouches to help  -----------------------------------------
  S({ t0: cut('l09'), bg: 'black', xin: 'smear', build({ scene, add }) {
    darkStage(scene, add, { dust: false });
    const m = alley(add, 0);
    const a = createAndroid(); add(a.root);
    const stopT = 1.4;
    return {
      update(lt) {
        m.pose(withIdle(SLUMP, lt, 0.3));
        if (lt < stopT) { a.root.position.set(-1.9 + lt * 0.95, 0, PATH + 0.15); a.root.rotation.y = Math.PI / 2; a.pose(walkPose(lt * 4.6, 0.8)); }
        else { const k = ease.inOutCubic(clamp((lt - stopT) / 0.7)); a.root.position.set(-1.9 + stopT * 0.95 + k * 0.3, 0, PATH + 0.15); a.root.rotation.y = Math.PI / 2 + k * Math.PI / 2; a.pose(mixPose(POSES.stand, HELP, k)); }
      },
      camera: dolly([[0, [1.8, 1.3, 2.9], [-0.4, 0.9, -0.6], 32], [1, [1.4, 1.2, 2.4], [-0.3, 0.8, -0.7], 32]]),
      hud: (lt, t, P) => [{ t0: stopT + 0.6, t1: 3.2, anchor: () => P(V(-0.35, 1.5, PATH)), label: 'ACTION', value: 'STOPPED', side: -1, r: 13 }],
    };
  } });
  title('63%', 'sixtythree', 0, { pos: [0.2, 0.15], size: 110, hold: 2.1 });

  // S10 in a hurry: runs straight past  ------------------------------------------------------------
  S({ t0: cut('l10'), bg: 'white', xin: 'smear', build({ scene, add }) {
    whiteStage(scene, add);
    const m = alley(add, 1);
    const a = createAndroid(); add(a.root); const sh = add(blobShadow(0.55, 0.1));
    const cl = add(heroProp('clock', { scale: 0.55 }));
    const X = lt => -2.6 + lt * 1.7;
    return {
      update(lt) { m.pose(withIdle(SLUMP, lt, 0.3)); a.root.position.set(X(lt), 0, PATH); a.root.rotation.y = Math.PI / 2; a.pose(hurry(lt * 7)); sh.position.set(X(lt), 0, PATH); cl.position.set(X(lt), 2.35, PATH); cl.rotation.y = 0.4; spinClock(cl, lt, 200); },
      camera: dolly([[0, [-0.6, 1.4, 3.6], [-0.4, 1.0, -0.5], 32], [1, [0.4, 1.4, 3.4], [0.6, 1.0, -0.5], 32]]),
    };
  } });
  title('10%', 'ten', 0, { pos: [0.8, 0.15], size: 110, hold: 1.5 });

  // S11 the sermon topic: no significant difference  -------------------------------------------------
  S({ t0: cut('l11'), bg: 'black', xin: 'zoom', build({ scene, add }) {
    const dust = darkStage(scene, add);
    const cs = [[-0.75, true], [0.75, false]].map(([x, red]) => { const c = add(card({ w: 0.6, h: 0.84, pol: 0, stripe: red })); c.position.set(x, 1.3, 0); return c; });
    const eq = [0.05, -0.05].map(y => { const l = add(polyline([[-0.12, 0, 0], [0.12, 0, 0]], { color: 0xe41b26, width: 3 })); l.position.set(0, 1.3 + y, 0.02); l.visible = false; return l; });
    const td = at('l11', 'difference');
    return {
      update(lt) { dust.tick(lt); cs.forEach((c, i) => { c.rotation.y = Math.sin(lt * 0.8 + i) * 0.12; }); eq.forEach(l => { l.visible = lt > td - 0.1; }); },
      camera: dolly([[0, [0.3, 1.45, 3.4], [0, 1.3, 0], 32], [1, [0.1, 1.4, 2.8], [0, 1.3, 0], 32]]),
      hud: (lt, t, P) => [{ t0: td - 0.2, t1: 3.2, anchor: () => P(V(0, 1.8, 0)), label: 'EFFECT', value: 'N.S.', side: 1, r: 13 }],
    };
  } });
  title('Good Samaritan?', 'samaritan', 1, { color: INKS.light, pos: [0.5, 0.14], size: 48, hold: 1.2 });
  title('No difference', 'difference', 0, { pos: [0.5, 0.86], size: 58, hold: 0.9 });

  // S12 the clock beat the sermon  -------------------------------------------------------------------
  S({ t0: cut('l12'), bg: 'white', xin: 'smear', build({ scene, add }) {
    whiteStage(scene, add);
    const cl = add(heroProp('clock', { scale: 2.0 })); cl.position.set(-0.6, 0, 0);
    const c = add(card({ w: 0.3, h: 0.42 }));
    const ts = at('l12', 'sermon');
    return {
      update(lt) { spinClock(cl, lt, 30); const k = ease.inCubic(clamp((lt - ts + 0.6) / 0.5)); c.position.set(0.9, 1.1 - k * 1.09, 0.2); c.rotation.set(-Math.PI / 2 * k, 0.3, 0); },
      camera: dolly([[0, [1.4, 1.2, 3.6], [-0.1, 0.9, 0], 32], [1, [1.0, 1.1, 3.0], [0, 0.85, 0], 32]]),
    };
  } });
  title('The clock', 'clock', 0, { pos: [0.5, 0.13], size: 66, hold: 1.0 });
  A(w('sermon') - 0.1, dolly([[0, [1.5, 0.45, 1.1], [0.9, 0.05, 0.2], 30], [1, [1.35, 0.4, 0.95], [0.9, 0.05, 0.2], 30]]));
  title('Not the sermon', 'sermon', 0, { color: INKS.dark, pos: [0.5, 0.86], size: 52, hold: 0.8 });

  // S13 later, they remembered him: hologram head with the man as a red memory  ------------------------
  S({ t0: cut('l13'), bg: 'black', xin: 'zoom', build({ scene, add }) {
    const dust = darkStage(scene, add, { step: 1.5 });
    const a = createAndroid({ mode: 'ghost', intensity: 1.0 }); add(a.root);
    const core = add(particles({ count: 1200, shape: 'gauss', spread: [0.07, 0.07, 0.06], center: [0, 0, 0], color: 0xe01822, size: 0.028, opacity: 0.95, drift: 0.1, xray: true })); core.position.set(0, 1.86, 0.03);
    return {
      update(lt) { a.pose(withIdle(POSES.stand, lt + 2)); a.setXrayTime(lt); dust.tick(lt); core.tick(lt); },
      camera: dolly([[0, [1.1, 1.85, 1.7], [0, 1.8, 0], 30], [1, [0.7, 1.86, 1.25], [0, 1.82, 0], 30]]),
      hud: (lt, t, P) => [{ t0: at('l13', 'remembered'), t1: 2.4, anchor: () => P(V(0, 1.9, 0.05)), label: 'RECALL', value: 'THE MAN', side: 1, r: 13 }],
    };
  } });
  title('Remembered him', 'remembered', 0, { color: INKS.light, pos: [0.5, 0.86], size: 52, hold: 1.0 });

  // S14 the mind never caught up: a ghost copy trails the hurried body  ------------------------------
  S({ t0: cut('l14'), bg: 'white', xin: 'smear', build({ scene, add }) {
    whiteStage(scene, add);
    const m = alley(add, 1);
    const a = createAndroid(); add(a.root);
    const g = createAndroid({ mode: 'ghost', intensity: 1.0 }); add(g.root);
    const X = lt => -1.6 + lt * 1.55;
    return {
      update(lt) { m.pose(withIdle(SLUMP, lt, 0.3)); a.root.position.set(X(lt), 0, PATH); a.root.rotation.y = Math.PI / 2; a.pose(hurry(lt * 6.6));
        const gx = -1.6 + lt * 0.5; g.root.position.set(Math.min(gx, X(lt) - 0.6), 0, PATH - 0.05); g.root.rotation.y = Math.PI / 2 - 0.5 * clamp((lt - 0.6) / 0.8); g.pose(withIdle(POSES.stand, lt)); g.setXrayTime(lt); },
      camera: dolly([[0, [-0.4, 1.35, 3.5], [0, 1.0, -0.4], 32], [1, [0.3, 1.35, 3.3], [0.5, 1.0, -0.4], 32]]),
      hud: (lt, t, P) => [{ t0: at('l14', 'minds'), t1: 2.6, anchor: () => P(g.root.position.clone().add(V(0, 1.95, 0))), label: 'MIND', value: 'LAGGING', side: -1, r: 13 }],
    };
  } });
  title('Never caught up', 'caught', 0, { pos: [0.5, 0.13], size: 58, hold: 0.9 });
  A(w('minds') - 0.1, dolly([[0, [3.4, 0.6, 1.0], [0.2, 1.0, -0.3], 30], [1, [3.6, 0.65, 1.3], [0.6, 1.0, -0.3], 30]]));

  // S15 a narrowing map: red corridor lines close in ahead of a walking hologram  ---------------------
  S({ t0: cut('l15'), bg: 'black', xin: 'zoom', build({ scene, add }) {
    darkStage(scene, add, { dust: false, far: 30 });
    const a = createAndroid({ mode: 'ghost', intensity: 1.0 }); add(a.root);
    const G = add(new THREE.Group());
    for (const s of [-1, 1]) G.add(polyline([[s * 2.8, 0.02, 1.5], [s * 1.2, 0.02, -5], [s * 0.18, 0.02, -16]], { color: 0xe41b26, width: 2.2 }));
    const tn = at('l15', 'narrowing');
    return {
      update(lt) { const z = 0.5 - lt * 0.95; a.root.position.set(0, 0, z); a.root.rotation.y = Math.PI; a.pose(walkPose(lt * 4.6, 0.85)); a.setXrayTime(lt); G.position.z = z; G.scale.x = 1 - 0.75 * ease.inOutCubic(clamp((lt - tn + 0.2) / 1.0)); },
      camera: lt => ({ pos: [0.6, 3.8, 3.4 - lt * 0.95], target: [0, 0.6, -3 - lt * 0.95], fov: 36 }),
    };
  } });
  title('A narrowing map', 'narrowing', 0, { pos: [0.5, 0.86], size: 56, hold: 1.0 });

  // S16 you do this every day: walking, eyes on a phone  ----------------------------------------------
  const phoneIn = (a, ph) => { const b = a.bone('hand.R'); if (b) { b.getWorldPosition(ph.position); ph.position.add(V(0, 0.06, 0.06)); } ph.rotation.set(-0.9, a.root.rotation.y, 0); };
  S({ t0: cut('l16'), bg: 'white', xin: 'whip', build({ scene, add }) {
    whiteStage(scene, add);
    const a = createAndroid(); add(a.root);
    const ph = add(heroProp('phone', { scale: 1.0 }));
    const Z = lt => -2.4 + lt * 1.2;
    return {
      update(lt) { a.root.position.set(0, 0, Z(lt)); const p = walkWith(lt * 5.2, PHONE, 0.9); p.rot['spine.005'] = [24, 0, 0]; a.pose(p); phoneIn(a, ph); },
      camera: lt => ({ pos: [0.9, 1.45, Z(lt) + 2.8], target: [0, 1.3, Z(lt)], fov: 32 }),
      hud: (lt, t, P) => [{ t0: 0.2, t1: 1.3, anchor: () => P(ph.position.clone()), label: 'EYES', value: 'DOWN', side: 1, r: 12 }],
    };
  } });
  title('Every day', 'every', 0, { color: INKS.dark, pos: [0.5, 0.13], size: 54, hold: 0.8 });

  // S17 everything you rushed past: a fast track past a phone, a face, a raised hand ----------------------
  S({ t0: cut('l17'), bg: 'black', xin: 'smear', build({ scene, add }) {
    const dust = darkStage(scene, add);
    const a = createAndroid(); add(a.root);
    const tb = add(box(0.6, 0.74, 0.6, { polarity: 0 })); tb.position.set(-0.4, 0, -1.3);
    const ph = add(heroProp('phone', { scale: 1.2 })); ph.position.set(-0.4, 0.75, -1.3); ph.rotation.x = -Math.PI / 2;
    const fx = add(particles({ count: 400, shape: 'gauss', spread: [0.08, 0.02, 0.12], center: [0, 0, 0], color: 0xe01822, size: 0.03, opacity: 0.9, drift: 0.2 })); fx.position.set(-0.4, 0.8, -1.3);
    const f = createAndroid(); add(f.root); f.root.position.set(2.6, 0, -1.4); f.root.rotation.y = 0.5;
    const q = createAndroid(); add(q.root); q.root.position.set(5.6, 0, -1.4); q.root.rotation.y = 0.3;
    const X = lt => -2.2 + lt * 1.6;
    return {
      update(lt) { a.root.position.set(X(lt), 0, 0); a.root.rotation.y = Math.PI / 2; a.pose(hurry(lt * 6.8)); f.pose(withIdle(extend(POSES.stand, { rot: { 'spine.005': [0, -Math.min(40, Math.max(0, (X(lt) - 2.6) * 25)), 0] } }), lt)); q.pose(withIdle(HAND_UP, lt)); dust.tick(lt); fx.tick(lt); },
      camera: lt => ({ pos: [X(lt) - 0.4, 1.4, 3.6], target: [X(lt) + 0.8, 1.0, -0.6], fov: 34 }),
      hud: (lt, t, P) => [
        { t0: 0.1, t1: 1.5, anchor: () => P(V(-0.4, 0.85, -1.3)), label: 'TEXT', value: 'LATER', side: -1, r: 12 },
        { t0: at('l17', 'face'), t1: at('l17', 'question') - 0.1, anchor: () => P(V(2.6, 1.95, -1.4)), label: 'FACE', value: 'UNSEEN', side: 1, r: 12 },
        { t0: at('l17', 'question'), t1: 4.8, anchor: () => P(V(5.6, 2.35, -1.4)), label: 'QUESTION', value: 'SKIPPED', side: 1, r: 12 },
      ],
    };
  } });
  { const off = l => w(l) - 0.1 - cut('l17'); const X = lt => -2.2 + lt * 1.6;
    A(w('face') - 0.1, lt => ({ pos: [X(lt + off('face')) + 1.3, 1.75, 0.9], target: [2.6, 1.75, -1.4], fov: 30 }));
    A(w('question') - 0.1, lt => { const x = Math.min(X(lt + off('question')), 4.6); return { pos: [x + 0.5, 0.5, 2.4], target: [x + 1.4, 1.3, -0.6], fov: 32 }; }); }
  title('Later', 'later', 1, { color: INKS.light, pos: [0.5, 0.14], size: 50, hold: 0.9 });
  title('Rushed past', 'rushed', 0, { pos: [0.5, 0.86], size: 58, hold: 0.9 });

  // S18 it's how fast you're moving: stop, turn the head to camera  -------------------------------
  S({ t0: cut('l18'), bg: 'white', xin: 'glitch', build({ scene, add }) {
    whiteStage(scene, add, { step: 2.2 });
    const a = createAndroid(); add(a.root);
    const G = add(grid({ color: 0xa8a8a8, width: 1.0, step: 0.9, size: 40, y: 0.003 }));
    const tf = at('l18', 'fast');
    return {
      update(lt) { const k = ease.inOutCubic(clamp((lt - tf + 0.4) / 0.8)); a.pose(withIdle({ ...POSES.stand, rot: { 'spine.005': [0, -50 * (1 - k), 0], 'spine.006': [4, -20 * (1 - k), 0] } }, lt)); G.position.z = (lt * 2.4 * (1 - k)) % 0.9; },
      camera: orbit({ target: [0, 1.82, 0], radius: 1.25, height: 1.86, from: -20, to: 4, fov: 30 }),
    };
  } });
  title('Not who you are', 'who', 1, { color: INKS.dark, pos: [0.5, 0.13], size: 50, hold: 1.0 });
  title('How fast', 'fast', 0, { pos: [0.5, 0.86], size: 66, hold: 0.9 });

  // S19 honesty: one small study, forty students  -----------------------------------------------------
  S({ t0: cut('l19'), bg: 'black', xin: 'smear', build({ scene, add }) {
    const dust = darkStage(scene, add);
    const cs = []; for (let i = 0; i < 40; i++) { const c = add(cube(0.22, { pol: 0 })); c.position.set((i % 8 - 3.5) * 0.42, 0.11, (Math.floor(i / 8) - 2) * 0.42); c.visible = false; cs.push(c); }
    const tf = at('l19', 'forty');
    return {
      update(lt) { dust.tick(lt); cs.forEach((c, i) => { c.visible = lt > tf - 0.3 + i * 0.012; c.rotation.y = lt * 0.3 + i; }); },
      camera: dolly([[0, [2.6, 2.3, 3.2], [0, 0.2, 0], 32], [1, [1.8, 2.6, 2.6], [0, 0.2, 0], 32]]),
      hud: (lt, t, P) => [{ t0: tf + 0.3, t1: 2.8, anchor: () => P(V(0, 0.5, 0)), label: 'N', value: '40', side: 1, r: 13 }],
    };
  } });
  title('One small study', 'small', 0, { color: INKS.light, pos: [0.5, 0.14], size: 48, hold: 0.9 });
  title("But you've felt it", 'felt', 0, { pos: [0.5, 0.86], size: 54, hold: 0.9 });

  // S20 leave five minutes early: the clock hands wind back  ------------------------------------------
  S({ t0: cut('l20'), bg: 'white', xin: 'whip', build({ scene, add }) {
    whiteStage(scene, add);
    const cl = add(heroProp('clock', { scale: 2.0 }));
    const tf = at('l20', 'five');
    return {
      update(lt) { const k = ease.inOutCubic(clamp((lt - tf) / 0.8)); cl.setTime(8, 55 - 5 * k, (lt * 60) % 60); cl.rotation.y = -0.15 + lt * 0.05; },
      camera: dolly([[0, [0.7, 1.0, 3.2], [0, 0.9, 0], 32], [1, [0.4, 1.0, 2.6], [0, 0.9, 0], 32]]),
    };
  } });
  title('5 minutes early', 'five', 0, { pos: [0.5, 0.86], size: 58, hold: 1.2 });

  // S21 spend them looking up  ---------------------------------------------------------------------
  S({ t0: cut('l21'), bg: 'black', xin: 'smear', build({ scene, add }) {
    const dust = darkStage(scene, add);
    add(lattice({ nx: 6, ny: 2, nz: 6, s: 1.6, center: [0, 3.2, -1], color: 0x5e5e5e }));
    const a = createAndroid(); add(a.root);
    return {
      update(lt) { const k = ease.inOutCubic(clamp(lt / 0.7)); a.pose(withIdle(extend(POSES.stand, { rot: { 'spine.005': [-26 * k, 0, 0], 'spine.006': [-10 * k, 0, 0] } }), lt)); dust.tick(lt); },
      camera: dolly([[0, [0.8, 0.7, 2.2], [0, 1.6, 0], 32], [1, [0.6, 0.6, 1.9], [0, 1.7, 0], 32]]),
    };
  } });
  title('Look up', 'looking', 0, { pos: [0.5, 0.86], size: 66, hold: 1.0 });

  // S22 finale: the man in the doorway as a hologram, red core, red boundary  --------------------------
  S({ t0: cut('l22'), bg: 'black', xin: 'zoom', build({ scene, add }) {
    const dust = darkStage(scene, add, { step: 1.5 });
    add(lattice({ nx: 8, ny: 3, nz: 8, s: 1.6, center: [0, 0, -3], color: 0x5e5e5e }));
    const fr = add(wall({ frame: true, pol: 0 })); fr.position.z = -1.1;
    const b = add(boundary({ opacity: 0.8 })); b.position.z = -1.12;
    const m = createAndroid({ mode: 'ghost', intensity: 1.0 }); add(m.root); m.root.position.set(0, 0, -1.02);
    const core = add(particles({ count: 1200, shape: 'gauss', spread: [0.1, 0.1, 0.08], center: [0, 0, 0], color: 0xe01822, size: 0.03, opacity: 0.95, drift: 0.12, xray: true })); core.position.set(0, 0.62, -0.92);
    return {
      update(lt) { m.pose(withIdle(SLUMP, lt, 0.3)); m.setXrayTime(lt); dust.tick(lt); core.tick(lt); b.tick(lt); },
      camera: dolly([[0, [0.3, 1.2, 3.6], [0, 0.7, -1.0], 32], [1, [-0.4, 1.5, 2.8], [0, 0.75, -1.0], 30]]),
    };
  } });
  A(w('past', 1) - 0.2, dolly([[0, [0.4, 0.95, 1.2], [0, 0.75, -1.0], 30], [1, [0.3, 0.9, 1.0], [0, 0.72, -1.0], 30]]));
  T.push({ str: 'Who did you walk past today?', t0: w('who', 2) - 0.1, t1: N.end + 1.0, pos: [0.5, 0.14], size: 50, color: INKS.red, crossCut: true });

  const dur = N.end + 1.6;
  return {
    duration: dur, shots, texts: T,
    glitches: [[w('help') + 0.05, 0.08, 0.6], [w('switch') + 0.02, 0.1, 0.8], [w('hurry') + 0.05, 0.12, 0.9], [w('ten') + 0.05, 0.1, 0.7], [w('fast') + 0.05, 0.1, 0.8]],
    logo: [[w('princeton') + 0.3, 0.06, 0.12], [dur - 0.5, 0.06, 0.12]],
    hudCues: [0.35, cut('l02') + 0.2, cut('l03') + 2.2, cut('l04') + 0.3, cut('l05') + 0.4, cut('l06') + 0.9, cut('l07') + 0.8, w('others'), w('slumped'), cut('l09') + 2.0, w('difference') - 0.2, w('remembered'), w('minds'), cut('l16') + 0.2, cut('l17') + 0.1, w('face'), w('question'), w('forty') + 0.3],
  };
}
