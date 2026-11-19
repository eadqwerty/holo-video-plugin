// Deterministic helpers. Nothing here may depend on wall-clock time or Math.random.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const fract = x => x - Math.floor(x);

export function hash(n) { // 0..1, stable for integer-ish inputs
  n = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return n - Math.floor(n);
}
export const hash2 = (a, b) => hash(a * 157.31 + b * 113.97);

export function rng(seed = 1) { // mulberry32
  let a = (seed >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// 1-D value noise, smooth, -1..1
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 101.3), hash(i + 1 + seed * 101.3), u) * 2 - 1;
}
export const fbm1 = (x, seed = 0) => noise1(x, seed) * 0.6 + noise1(x * 2.13, seed + 7) * 0.28 + noise1(x * 4.37, seed + 13) * 0.12;

// easing — the references use long, soft ease-in-out camera moves and snappy (expo) text/flash timing
export const ease = {
  linear: t => t,
  inOutSine: t => -(Math.cos(Math.PI * clamp(t)) - 1) / 2,
  inOutCubic: t => (t = clamp(t), t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: t => 1 - Math.pow(1 - clamp(t), 3),
  inCubic: t => Math.pow(clamp(t), 3),
  outExpo: t => (t = clamp(t), t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: t => (t = clamp(t), t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutQuint: t => (t = clamp(t), t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
};

// keyframe track: [[t, value], ...] (value number or array), eased per segment
export function track(keys, t, e = ease.inOutSine) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [ta, va] = keys[i], [tb, vb] = keys[i + 1];
    if (t <= tb) {
      const u = e((t - ta) / (tb - ta));
      return Array.isArray(va) ? va.map((v, k) => lerp(v, vb[k], u)) : lerp(va, vb, u);
    }
  }
  return keys[keys.length - 1][1];
}

// first N digits of pi (Rabinowitz–Wagon spigot), returned as a string "31415926..."
export function piDigits(N = 4000) {
  const len = Math.floor(10 * N / 3) + 1;
  const a = new Array(len).fill(2);
  let out = '', nines = 0, predigit = 0;
  for (let j = 1; j <= N; j++) {
    let q = 0;
    for (let i = len; i > 0; i--) {
      const x = 10 * a[i - 1] + q * i;
      a[i - 1] = x % (2 * i - 1);
      q = Math.floor(x / (2 * i - 1));
    }
    a[0] = q % 10; q = Math.floor(q / 10);
    if (q === 9) nines++;
    else if (q === 10) { out += String(predigit + 1); out += '0'.repeat(nines); predigit = 0; nines = 0; }
    else { if (j > 1) out += String(predigit); predigit = q; if (nines) { out += '9'.repeat(nines); nines = 0; } }
  }
  return out + predigit;
}
