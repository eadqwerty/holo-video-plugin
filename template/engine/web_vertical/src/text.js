// Typography + HUD layers (2D canvases uploaded each frame).
//  TEXT layer: composited BEFORE the glyph matte (so titles carry the digit texture, as in the refs).
//  HUD layer:  composited AFTER (crisp mono callouts, target rings, leader lines).
//
// Title behaviour measured from the refs (ref2 8.8-11.0s, ref3 5.8-6.8s):
//   IN  (~4 frames): a soft horizontal noise cloud wider than the word condenses, then the word snaps sharp.
//   HOLD: static, sometimes a slow 1-3% drift / scale.
//   OUT (~3 frames): rows tear sideways into a dark/red smear cloud, then gone.
import * as THREE from 'three';
import { hash, hash2, clamp, smooth, ease, rng } from './util.js';

export const TYPE = {
  // refs 2-7: wide geometric (Eurostile-Extended-like) — Michroma is the closest open match; tight tracking.
  title: { font: 'Michroma', weight: 400, track: -0.035, case: 'upper' },
  // ref 1 secondary styles
  heavy: { font: 'ArchivoBlack', weight: 400, track: -0.01, case: 'upper' },
  fraktur: { font: 'Fraktur', weight: 700, track: 0.0, case: 'none' },
};
// vertical: Shorts/Reels/TikTok UI-safe area (fractions of the frame). The right ~20% holds the like/comment/save
// buttons, the bottom ~1/3 the title/description/sound row, the top ~10% the search bar. Titles and HUD stay inside.
export const SAFE = { x0: 0.05, x1: 0.80, y0: 0.10, y1: 0.66 };
export const INKS = { red: '#e41b26', redDim: '#c4161f', dark: '#2b2b2b', light: '#d9d9d9', white: '#f2f2f2', black: '#0a0a0a' };

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export class TextLayer {
  constructor(w, h) {
    this.w = w; this.h = h; this.s = Math.min(w, h) / 1080; this.portrait = h > w;
    this.cv = makeCanvas(w, h); this.g = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.NoColorSpace; this.tex.premultiplyAlpha = false; this.tex.flipY = false;
    this.cache = new Map();
    this.cloud = makeCanvas(Math.ceil(w / 6), Math.ceil(h / 6)); this.cg = this.cloud.getContext('2d');
  }
  // rasterise a text item once (sharp) — returns {cv, x, y, w, h}
  raster(item) {
    const key = JSON.stringify([item.str, item.style, item.size, item.color]);
    if (this.cache.has(key)) return this.cache.get(key);
    const st = TYPE[item.style || 'title'];
    const str = st.case === 'upper' ? item.str.toUpperCase() : item.str;
    let px = Math.round((item.size || 64) * this.s);
    const g0 = makeCanvas(8, 8).getContext('2d');
    const measure = s => { const ch = [...s]; const wd = ch.map(c => g0.measureText(c).width); return wd.reduce((a, b) => a + b, 0) + st.track * px * (ch.length - 1); };
    g0.font = `${st.weight} ${px}px ${st.font}`;
    // vertical: a title wider than 88% of the frame wraps onto two balanced lines, then shrinks if still too wide
    const maxW = this.portrait ? this.w * (SAFE.x1 - SAFE.x0) * 0.97 : this.w * 0.88;
    let lines = [str];
    if (measure(str) > maxW && str.includes(' ')) {
      const ws = str.split(' '); let best = null;
      for (let k = 1; k < ws.length; k++) { const a = ws.slice(0, k).join(' '), b = ws.slice(k).join(' '); const m = Math.max(measure(a), measure(b)); if (!best || m < best[0]) best = [m, [a, b]]; }
      lines = best[1];
    }
    while (Math.max(...lines.map(measure)) > maxW && px > 18) { px -= 2; g0.font = `${st.weight} ${px}px ${st.font}`; }
    const tr = st.track * px;
    const tw = Math.max(...lines.map(measure));
    const pad = Math.ceil(px * 0.4), lh = px * 1.25;
    const cv = makeCanvas(Math.ceil(tw + pad * 2), Math.ceil(px * 1.6 + lh * (lines.length - 1)));
    const g = cv.getContext('2d');
    g.font = g0.font; g.fillStyle = item.color || INKS.red; g.textBaseline = 'alphabetic';
    // slight stroke so the thin Michroma strokes survive the glyph matte the way the refs' heavier text does
    g.strokeStyle = g.fillStyle; g.lineWidth = px * 0.022; g.lineJoin = 'round';
    lines.forEach((ln, li) => {
      const chars = [...ln], widths = chars.map(c => g0.measureText(c).width);
      let x = pad + (tw - measure(ln)) / 2;
      chars.forEach((c, i) => { g.fillText(c, x, px * 1.18 + li * lh); g.strokeText(c, x, px * 1.18 + li * lh); x += widths[i] + tr; });
    });
    const r = { cv, w: cv.width, h: cv.height, pad };
    this.cache.set(key, r);
    return r;
  }

  draw(items, t, frame) {
    const g = this.g;
    g.clearRect(0, 0, this.w, this.h);
    for (const it of items) {
      if (t < it.t0 - 0.16 || t > it.t1 + (it.outDur ?? 0.12)) continue;
      const r = this.raster(it);
      const inD = it.inDur ?? 0.16, outD = it.outDur ?? 0.12;
      const pin = clamp((t - it.t0) / inD), pout = clamp((t - it.t1) / outD);
      const life = clamp((t - it.t0) / Math.max(0.01, it.t1 - it.t0));
      // anchor: pos in 0..1 screen coords of the text's centre (or left edge with align:'left')
      const sc = 1 + (it.grow ?? 0.025) * life;
      // vertical: titles live inside the UI-safe area. 16:9 left-side titles hug its left edge, right-side ones its
      // right edge (one line lower, so a left/right pair never collides), centred ones its centre; y is remapped
      // from the 16:9 band (0.12-0.86) into the safe band.
      const dw = r.w * sc, dh = r.h * sc;
      let cx, cy;
      if (this.portrait) {
        const X0 = SAFE.x0 * this.w, X1 = SAFE.x1 * this.w, Y0 = SAFE.y0 * this.h, Y1 = SAFE.y1 * this.h;
        const side = it.pos[0] < 0.4 ? -1 : it.pos[0] > 0.6 ? 1 : 0;
        cx = side < 0 ? X0 + dw / 2 - r.pad * sc : side > 0 ? X1 - dw / 2 + r.pad * sc : (X0 + X1) / 2;
        cy = Y0 + 0.05 * this.h + clamp((it.pos[1] - 0.12) / 0.74) * (Y1 - Y0 - 0.1 * this.h) + (side > 0 && it.pos[1] < 0.3 ? 0.055 * this.h : 0);
        cx = Math.min(Math.max(cx, X0 + dw / 2 - r.pad * sc), X1 - dw / 2 + r.pad * sc);
        cy = Math.min(Math.max(cy, Y0 + dh / 2), Y1 - dh / 2);
      } else {
        cx = it.pos[0] * this.w + (it.drift ? it.drift[0] * life * this.w : 0);
        cy = it.pos[1] * this.h + (it.drift ? it.drift[1] * life * this.h : 0);
      }
      const x = it.align === 'left' ? cx - r.pad * sc : it.align === 'right' ? cx - dw + r.pad * sc : cx - dw / 2;
      const y = cy - dh / 2;
      // cloud: before + during IN, and during OUT
      const cloudAmt = t < it.t0 ? smooth(it.t0 - 0.16, it.t0, t) : (pin < 1 ? 1 - ease.outCubic(pin) : 0) + (pout > 0 && pout < 1 ? Math.sin(pout * Math.PI) * 0.8 : 0);
      if (cloudAmt > 0.01) this.drawCloud(x, y, dw, dh, cloudAmt, it.color || INKS.red, frame, it.cloudSpread ?? 1);
      if (t < it.t0 || pout >= 1) continue;
      g.save();
      if (pout > 0) {
        // tear rows sideways + fade
        const rows = 14, rh = dh / rows;
        for (let k = 0; k < rows; k++) {
          const off = (hash2(k, frame) - 0.5) * dw * 0.35 * pout + dw * 0.18 * pout * (hash(k + 3.3) - 0.3);
          g.globalAlpha = (1 - pout) * (0.6 + 0.4 * hash2(k, frame + 1));
          g.drawImage(r.cv, 0, k * r.h / rows, r.w, r.h / rows, x + off, y + k * rh, dw, rh + 1);
        }
      } else {
        // IN: word resolves through a dither threshold (blocks), with a couple of frames of sideways jitter
        const a = ease.outExpo(pin);
        g.globalAlpha = 0.35 + 0.65 * a;
        const jit = pin < 1 ? (hash2(frame, 5) - 0.5) * dw * 0.04 * (1 - a) : 0;
        g.drawImage(r.cv, x + jit, y, dw, dh);
        if (pin < 1) { // punch noise holes while resolving
          g.globalCompositeOperation = 'destination-out';
          const bs = Math.max(2, 5 * this.s);
          for (let yy = y; yy < y + dh; yy += bs) for (let xx = x; xx < x + dw; xx += bs)
            if (hash2(xx * 0.37 + frame, yy * 0.71) > a) g.fillRect(xx, yy, bs, bs);
        }
      }
      g.restore();
    }
    this.tex.needsUpdate = true;
  }

  drawCloud(x, y, w, h, amt, color, frame, spread) {
    // fine-grain horizontal noise cloud (1-2 px specks at full res), denser in the core — refs ref2 8.8s / 10.5s
    const g = this.g, s = this.s;
    const cx = x + w / 2, cy = y + h / 2, rx = w * 0.58 * spread, ry = h * 0.55 + 14 * s;
    const R = rng(frame * 31 + Math.floor(x));
    const n = Math.floor(rx * ry * 0.05 * Math.min(1, amt));
    g.save(); g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, rr = Math.pow(R(), 0.7);
      const px = cx + Math.cos(a) * rr * rx, py = cy + Math.sin(a) * rr * ry * (0.6 + 0.4 * R());
      g.globalAlpha = Math.min(1, amt) * (0.2 + 0.55 * R()) * (1 - rr * 0.7);
      const d = (R() < 0.85 ? 1.5 : 2.5) * s;
      g.fillRect(px, py, d, d);
    }
    g.restore();
  }
}

// ------------------------------------------------------------------ HUD
// callout = { t0, t1, anchor: () => [sx, sy] (screen px), label: 'HEADSET', value?, coords:true, ring:true, box:false, side:1 }
export class HudLayer {
  constructor(w, h) {
    this.w = w; this.h = h; this.s = Math.min(w, h) / 1080; this.portrait = h > w;
    this.cv = makeCanvas(w, h); this.g = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.NoColorSpace; this.tex.flipY = false;
    this.logo = null;
  }
  draw(callouts, t, frame, polarity, extras = {}) {
    const g = this.g, s = this.s;
    g.clearRect(0, 0, this.w, this.h);
    const ink = polarity > 0.5 ? '#111' : '#e8e8e8';
    for (const c of callouts) {
      if (t < c.t0 || t > c.t1) continue;
      const p = c.anchor(t); if (!p) continue;
      const life = t - c.t0, pin = clamp(life / 0.25), out = clamp((t - (c.t1 - 0.12)) / 0.12);
      if (out > 0 && hash2(frame, 9) < out) continue;               // flicker off
      if (pin < 1 && hash2(frame, 2) > 0.35 + pin) continue;        // flicker on
      const [x, y] = p;
      let side = c.side ?? 1;
      g.save();
      { // vertical: flip the label to the other side if it would run off the frame
        g.font = `500 ${19 * s}px PlexMono, ShareMono, monospace`;
        const lw = 68 * s + Math.max(g.measureText((c.label || '') + (c.value ? ': ' + c.value : '')).width, g.measureText('x  0000   y. 0000').width);
        const X0 = this.portrait ? SAFE.x0 * this.w : 12 * s, X1 = this.portrait ? SAFE.x1 * this.w : this.w - 12 * s;
        if (side > 0 && x + lw > X1) side = -1; else if (side < 0 && x - lw < X0) side = 1;
      }
      g.lineWidth = 1.6 * s; g.strokeStyle = INKS.red; g.fillStyle = INKS.red;
      if (c.ring !== false) {
        const rr = (c.r ?? 20) * s * (0.6 + 0.4 * ease.outCubic(pin));
        g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(x, y, 3.2 * s, 0, Math.PI * 2); g.fillStyle = polarity > 0.5 ? '#111' : '#eee'; g.fill();
        g.beginPath(); g.arc(x, y, 1.8 * s, 0, Math.PI * 2); g.fillStyle = INKS.red; g.fill();
      }
      if (c.box) { g.strokeStyle = ink; g.lineWidth = 1.4 * s; const bw = (c.box[0] || 70) * s, bh = (c.box[1] || 70) * s; g.strokeRect(x - bw / 2, y - bh / 2, bw, bh); }
      // leader line + label block
      let lx = x + side * 60 * s * ease.outCubic(pin), ly = y - 34 * s;
      if (this.portrait) {   // keep the label block inside the safe area (the leader line bends to reach it)
        ly = Math.min(Math.max(ly, SAFE.y0 * this.h + 44 * s), SAFE.y1 * this.h);
        const lw2 = 210 * s;
        lx = side > 0 ? Math.min(lx, SAFE.x1 * this.w - lw2) : Math.max(lx, SAFE.x0 * this.w + lw2);
      }
      g.strokeStyle = ink; g.lineWidth = 1.2 * s;
      g.beginPath(); g.moveTo(x + side * (c.ring !== false ? 20 * s : 0), y - 6 * s); g.lineTo(lx, ly); g.stroke();
      g.font = `500 ${19 * s}px PlexMono, ShareMono, monospace`; g.fillStyle = ink; g.textBaseline = 'bottom';
      g.textAlign = side > 0 ? 'left' : 'right';
      const tx = lx + side * 4 * s;
      const typed = Math.floor(clamp(life / 0.4) * 40);
      if (c.label) g.fillText((c.label + (c.value ? ': ' + c.value : '')).slice(0, typed), tx, ly - 19 * s);
      if (c.coords !== false) {
        const R = rng(Math.floor(c.t0 * 100) + 7);
        const xv = String(Math.floor(R() * 9000 + 500)).padStart(4, '0'), yv = String(Math.floor(R() * 9000 + 500)).padStart(4, '0');
        // refs: numbers re-roll a few times right after appearing
        const roll = life < 0.35 ? Math.floor(hash2(frame, 4) * 9000) : null;
        g.fillText(`x  ${roll ?? xv}   y. ${yv}`.slice(0, typed), tx, ly);
        g.strokeStyle = INKS.red; g.lineWidth = 1.6 * s;
        g.beginPath(); g.moveTo(tx, ly + 3 * s); g.lineTo(tx + side * 58 * s, ly + 3 * s); g.stroke();
      }
      g.restore();
    }
    // logo bug: original emblem, flashes for 1-3 frames (refs flash a channel mark at random moments)
    if (extras.logo) { this.drawLogo(extras.logo, polarity); }
    this.tex.needsUpdate = true;
  }
  drawLogo([x, y, a], polarity) {
    const g = this.g, s = this.s * 1.0, r = 26 * s;
    g.save(); g.globalAlpha = a; g.translate(x * this.w, y * this.h);
    g.strokeStyle = polarity > 0.5 ? '#5a5a5a' : '#8a8a8a'; g.fillStyle = g.strokeStyle; g.lineWidth = 6 * s;
    // original mark: a split hexagon with an inner bar ("H" for HOLO) — not the reference channel's logo
    g.beginPath();
    for (let i = 0; i < 6; i++) { const a0 = Math.PI / 6 + i * Math.PI / 3; g.lineTo(Math.cos(a0) * r, Math.sin(a0) * r); }
    g.closePath(); g.stroke();
    g.fillRect(-r * 0.5, -3 * s, r, 6 * s);
    g.clearRect(-2 * s, -r * 1.1, 4 * s, r * 2.2);
    g.restore();
  }
}
