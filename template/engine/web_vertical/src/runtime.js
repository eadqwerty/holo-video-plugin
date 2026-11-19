// HOLO runtime: boots a film module, schedules shots, runs transitions, drives the post chain.
import * as THREE from 'three';
import { Post, DEFAULT_POST } from './post.js';
import { TextLayer, HudLayer } from './text.js';
import { loadAndroid } from './android.js';
import { loadHeroProps } from './props.js';
import { setLineResolution } from './env.js';
import { setPolarity } from './materials.js';
import { clamp, smooth, hash, hash2, fbm1, ease, track } from './util.js';

THREE.ColorManagement.enabled = false;

// ------------------------------------------------------------------ transitions (measured, see STYLE_SPEC §5)
// each returns post-param deltas for a time d relative to the cut (d<0 outgoing, d>=0 incoming), fps-aware.
const TRANSITIONS = {
  // T1: smear-flash — the refs' default black<->white cut (ref3 5.3-5.9s, ref2 8.4-8.8s)
  smear(d, F, seed, toWhite) {
    const p = {};
    if (d < 0 && d > -0.17) { const k = 1 - (-d / 0.17); p.echo = 0.55 + 0.35 * k; p.smear = 3 * k; p.whip = [0.018 * k * (hash(seed) > 0.5 ? 1 : -1), 0]; p.dimScene = 1 - 0.65 * k; }
    if (d < 0 && d > -1.6 / F) { p.redBlobAmt = 0.95; p.redBlob = [0.25 + 0.5 * hash(seed + 1), 0.15 + 0.5 * hash(seed + 2)]; p.dimScene = 0.15; }
    if (d >= 0 && d < 1.2 / F) { if (toWhite) p.flashW = 1; else p.flashK = 1; }
    if (d >= 1.2 / F && d < 0.22) { const k = 1 - (d - 1.2 / F) / 0.2; p.lift = toWhite ? 0.55 * k : 0; p.exposure = toWhite ? 1 : 1 - 0.6 * k; p.echo = 0.4 * k; p.glyph = 1 - 0.4 * k; }
    return p;
  },
  // T2: zoom-through — push into the image (glyphs scale up), cut, land from an over-scaled frame (ref7 8.1-9.7s)
  zoom(d, F, seed) {
    const p = {};
    if (d < 0 && d > -0.3) { const k = ease.inCubic(1 + d / 0.3); p.zoom = 1 + 2.4 * k; p.zoomBlur = 2.5 * k; p.echo = 0.3 * k; }
    if (d >= 0 && d < 0.32) { const k = 1 - ease.outCubic(d / 0.32); p.zoom = 1 + 1.6 * k; p.zoomBlur = 2.0 * k; p.echo = 0.35 * k; }
    if (Math.abs(d) < 1 / F) p.flashW = 0.35;
    return p;
  },
  // T3: whip pan with directional blur + 1 flash frame (ref6 1.8-2.1s)
  whip(d, F, seed, toWhite) {
    const p = {}, dir = hash(seed) > 0.5 ? 1 : -1;
    if (d < 0 && d > -0.14) { const k = ease.inCubic(1 + d / 0.14); p.whip = [0.09 * k * dir, 0.01 * k]; p.echo = 0.4 * k; }
    if (d >= 0 && d < 0.16) { const k = 1 - ease.outCubic(d / 0.16); p.whip = [0.09 * k * dir, 0.01 * k]; p.echo = 0.4 * k; }
    if (d >= 0 && d < 1.1 / F) { if (toWhite) p.flashW = 0.85; else p.flashK = 0.7; }
    return p;
  },
  // T4: glitch cut — band displacement + RGB split for ~3 frames
  glitch(d, F, seed) {
    const p = {};
    if (Math.abs(d) < 3 / F) { p.glitch = 1 - Math.abs(d) * F / 3.5; p.glitchSeed = Math.floor(d * F) + seed * 10; p.streak = 4; }
    return p;
  },
  cut(d, F) { return Math.abs(d) < 1 / F ? { streak: 5, glitch: 0.25, glitchSeed: 3 } : {}; },
};

export function orbit({ target = [0, 1, 0], radius = 5, height = 1.6, from = 0, to = 20, fov = 35 }) {
  return (lt, dur) => {
    const a = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(from, to, ease.inOutSine(lt / dur)));
    return { pos: [target[0] + Math.sin(a) * radius, height, target[2] + Math.cos(a) * radius], target, fov };
  };
}
export function dolly(keys, e = ease.inOutSine) { // keys: [[u(0..1), pos[3], target[3], fov]]
  return (lt, dur) => {
    const u = lt / dur;
    return { pos: track(keys.map(k => [k[0], k[1]]), u, e), target: track(keys.map(k => [k[0], k[2]]), u, e), fov: track(keys.map(k => [k[0], k[3] ?? 35]), u, e) };
  };
}

export async function boot({ film, width, height, fps, android }) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height; canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  await document.fonts.load('64px Michroma'); await document.fonts.load('600 64px PlexMono'); await document.fonts.load('64px ArchivoBlack'); await document.fonts.load('700 64px Fraktur');
  await document.fonts.ready;
  await loadAndroid(android ? `/engine/assets/android_${android}.glb` : undefined);   // ?android=mh -> android_mh.glb
  await loadHeroProps();
  setLineResolution(width, height);
  const post = new Post(renderer, width, height);
  const text = new TextLayer(width, height), hud = new HudLayer(width, height);
  const mod = await import(film);
  const F = typeof mod.default === 'function' ? await mod.default({ THREE, width, height, fps }) : mod.default;
  const shots = F.shots.map((s, i) => ({ ...s, i }));
  // angle cuts: {t0, reuse: true, camera, xin:'cut'} continues the previous scene (same objects, same animation clock)
  // from a new camera — the refs cut angles inside a sentence (avg shot ~2.4 s)
  for (const s of shots) if (s.reuse) { let b = s.i - 1; while (shots[b].reuse) b--; s.base = b; s.bg = s.bg || shots[b].bg; s.xin = s.xin || 'cut'; }
  for (let i = 0; i < shots.length; i++) shots[i].t1 = shots[i].t1 ?? (shots[i + 1] ? shots[i + 1].t0 : F.duration);
  // ---- VERTICAL (portrait) framing. Every camera keeps its position and aim, with a wider vertical FOV (x zoom);
  // films/<ep>/vertical.js may re-frame single shots: export default async () => ({ zoom: 1.35, shots: [
  //   { at: <seconds inside the shot>, aim: [x,y,z] | (lt, dur) => [x,y,z], pos: [..] | fn, shift: [dx,dy,dz], zoom: 1.6,
  //     follow: n (keep the n-th figure of the scene centred: camera pans with it, same offset), followY: 1.3 (aim height),
  //     dist: 1.6 (scale the camera's distance from its target), camera: (lt, dur, c) => ({ pos, target, fov }) }, ... ] })
  //   (at = any time inside that shot, incl. angle cuts); titles: [{ str, at?, pos: [x, y] in the safe area }]
  const portrait = height > width;
  let VZ = 1.5, VD = 1.2;   // default portrait framing: wider lens + camera pulled back (less 'zoomed in')
  if (portrait) {
    let V = null;
    try { const vm = await import(film.replace(/film\.js$/, 'vertical.js')); V = typeof vm.default === 'function' ? await vm.default() : vm.default; } catch (e) { if (!/Failed to fetch|404|Cannot find/.test(String(e))) console.error('vertical.js', e); }
    if (V) { VZ = V.zoom ?? VZ; VD = V.dist ?? VD; for (const o of V.shots || []) { const s = shots.find(s => o.at >= s.t0 && o.at < s.t1); if (s) s.vo = o; else console.warn('vertical.js: no shot at', o.at); } }
    // titles: [{ str: 'A WAITER', at?: <s>, pos: [x, y] }] moves a title inside the UI-safe area (0..1 of its width/height)
    if (V) for (const o of V.titles || []) {
      const it = (F.texts || []).find(x => x.str.toUpperCase() === o.str.toUpperCase() && (o.at == null || (o.at >= x.t0 - 0.2 && o.at <= x.t1)));
      if (it) it.vpos = o.pos; else console.warn('vertical.js: no title', o.str);
    }
  }
  for (const x of F.texts || []) {
    const sh = shots.find(s => x.t0 + 0.12 >= s.t0 && x.t0 + 0.12 < s.t1);
    if (sh && x.t1 > sh.t1 - 0.03 && !x.crossCut) x.t1 = sh.t1 - 0.03;
  }
  const built = new Map();
  const camera = new THREE.PerspectiveCamera(35, width / height, 0.05, 400);

  function build(shot) {
    if (built.has(shot.i)) return built.get(shot.i);
    for (const [k, v] of built) if (k < shot.i - 1) { v.scene.traverse(o => { o.geometry?.dispose?.(); }); built.delete(k); }
    const scene = new THREE.Scene();
    const ctx = { THREE, scene, camera, width, height, fps, shot, add: o => (scene.add(o), o) };
    const inst = shot.build(ctx) || {};
    inst.scene = scene; inst.ctx = ctx;
    built.set(shot.i, inst);
    return inst;
  }

  const project = (v) => { const p = v.clone().project(camera); if (p.z > 1) return null; return [(p.x * 0.5 + 0.5) * width, (-p.y * 0.5 + 0.5) * height]; };

  function render(t) {
    const frame = Math.round(t * fps);
    let si = shots.findIndex(s => t >= s.t0 && t < s.t1); if (si < 0) si = shots.length - 1;
    const shot = shots[si], lt = t - shot.t0, dur = shot.t1 - shot.t0;
    const baseShot = shot.reuse ? shots[shot.base] : shot;
    const inst = build(baseShot), blt = t - baseShot.t0;
    let bend = shot.t1; for (let k = baseShot.i + 1; k < shots.length && shots[k].reuse && shots[k].base === baseShot.i; k++) bend = shots[k].t1;
    const white = shot.bg === 'white';
    setPolarity(white ? 1 : 0);
    inst.update?.(blt, t, bend - baseShot.t0);
    // camera (an angle cut supplies its own; it gets local time within the angle)
    let c = shot.reuse ? shot.camera(lt, dur, inst) : (shot.camera || inst.camera)(lt, dur);
    if (portrait) {
      const o = shot.vo || {}, ev = v => (typeof v === 'function' ? v(lt, dur) : v);
      if (o.camera) c = o.camera(lt, dur, c);
      if (o.pos) c = { ...c, pos: ev(o.pos) };
      if (o.aim) c = { ...c, target: ev(o.aim) };
      if (o.shift) c = { ...c, pos: c.pos.map((v, i) => v + o.shift[i]), target: c.target.map((v, i) => v + o.shift[i]) };
      if (o.follow != null) {
        const figs = []; inst.scene.traverse(x => { if (x.userData.android) figs.push(x); });
        const fg = figs[o.follow];
        if (fg) { const p = fg.getWorldPosition(new THREE.Vector3()); const ty = o.followY ?? c.target[1]; const d = [p.x - c.target[0], ty - c.target[1], p.z - c.target[2]];
          c = { ...c, target: [p.x, ty, p.z], pos: c.pos.map((v, i) => v + d[i] * (o.followPos ?? 1)) }; }
      }
      const dk = VD * (o.dist ?? 1);
      if (dk !== 1) c = { ...c, pos: c.pos.map((v, i) => c.target[i] + (v - c.target[i]) * dk) };
      const z = o.zoom ?? VZ, f = (c.fov ?? 35) * Math.PI / 360;
      c = { ...c, fov: Math.min(100, 360 / Math.PI * Math.atan(Math.tan(f) * z)) };
    }
    const hh = shot.handheld ?? 1;
    const n = k => fbm1(t * 0.35, k) * 0.035 * hh;
    camera.position.set(c.pos[0] + n(1), c.pos[1] + n(2), c.pos[2] + n(3));
    camera.fov = c.fov ?? 35; camera.updateProjectionMatrix();
    camera.lookAt(c.target[0] + n(4) * 0.6, c.target[1] + n(5) * 0.6, c.target[2]);
    if (c.roll) camera.rotateZ(c.roll);
    camera.updateMatrixWorld();
    // post params: defaults -> bg preset -> film -> shot -> transitions -> events
    const P = { ...DEFAULT_POST, polarity: white ? 1 : 0, vignette: white ? 0.015 : 0.38, bloom: white ? 0.3 : 0.6, grain: white ? 0.045 : 0.07, haze: white ? 0 : 0.05, exposure: white ? 1 : 1.04, ...(F.post || {}), ...(shot.post || {}) };
    if (inst.post) Object.assign(P, inst.post(lt, t));
    const prevShot = shots[si - 1], nextShot = shots[si + 1];
    const applyT = (kind, d, toWhite, seed) => { const fn = TRANSITIONS[kind || 'smear']; if (fn) Object.assign(P, fn(d, fps, seed, toWhite)); };
    if (nextShot && t > nextShot.t0 - 0.35) applyT(nextShot.xin, t - nextShot.t0, nextShot.bg === 'white', si + 1);
    if (prevShot && lt < 0.4) applyT(shot.xin, lt, white, si);
    for (const [gt, gd, ga] of F.glitches || []) if (t >= gt && t < gt + gd) { P.glitch = Math.max(P.glitch, ga); P.glitchSeed = frame; P.streak = 3; }
    let logo = null;
    for (const [lt0, lx, ly] of F.logo || []) if (t >= lt0 && t < lt0 + 2.5 / fps) logo = [lx, ly, 0.85];
    // text + hud
    text.draw(F.texts || [], t, frame);
    const cal = (inst.hud ? inst.hud(blt, t, project) : []).map(h => ({ ...h, t0: h.t0 + baseShot.t0, t1: Math.min(h.t1 + baseShot.t0, shot.t1) }));
    hud.draw(cal, t, frame, P.polarity, { logo });
    post.render(inst.scene, camera, P, text.tex, hud.tex, frame);
  }

  const cues = () => ({
    duration: F.duration,
    cuts: shots.slice(1).map(s => ({ t: s.t0, kind: s.xin || 'smear', toWhite: s.bg === 'white' })),
    glitches: (F.glitches || []).map(([t, d, a]) => ({ t, d, a })),
    texts: (F.texts || []).map(x => ({ t0: x.t0, t1: x.t1, str: x.str })),
    hud: F.hudCues || [], logo: (F.logo || []).map(l => l[0]),
  });
  // fast capture: render, pack the finished frame to yuv420p on the GPU, send the bytes over a binary WebSocket
  const yuv = new Uint8Array(width * height * 3 / 2);
  let ws = null;
  function connect(url) { return new Promise((res, rej) => { ws = new WebSocket(url); ws.binaryType = 'arraybuffer'; ws.onopen = res; ws.onerror = rej; }); }
  function grab(t) {
    render(t);
    post.packYUV(yuv);
    return new Promise(res => { ws.onmessage = () => res(); ws.send(yuv); });
  }
  window.HOLO = { ready: false, duration: F.duration, render, grab, connect, fps, cues };
  render(0);
  window.HOLO.ready = true;
}
