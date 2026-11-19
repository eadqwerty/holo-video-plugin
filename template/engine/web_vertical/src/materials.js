// Materials for the HOLO look. All colour values are display values (colour management is off).
// The android's plates read as hard studio chrome in the references: bright softbox bands, a near-black
// horizon reflection band and crisp terminators. A matcap reproduces that exactly and works with skinning.
import * as THREE from 'three';

function paintMatcap(size, fn) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'), img = g.createImageData(size, size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = (i + 0.5) / size * 2 - 1, y = 1 - (j + 0.5) / size * 2, rr = x * x + y * y;
    const z = Math.sqrt(Math.max(0, 1 - rr));
    const [r, gg, b] = fn(x, y, z);
    const k = (j * size + i) * 4;
    img.data[k] = Math.max(0, Math.min(255, r * 255)); img.data[k + 1] = Math.max(0, Math.min(255, gg * 255)); img.data[k + 2] = Math.max(0, Math.min(255, b * 255)); img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace;
  return t;
}
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// studio environment seen in a chrome reflection (view space reflection vector r)
function studio(x, y, z) {
  const rx = 2 * z * x, ry = 2 * z * y, rz = 2 * z * z - 1;
  let e = 0.42 * sm(-0.9, -0.2, -ry);                    // floor bounce (mid grey)
  e += 1.05 * sm(0.18, 0.42, ry);                         // big overhead softbox
  e *= 1 - 0.92 * Math.exp(-Math.pow(ry / 0.13, 2));      // dark horizon band (the chrome "waist")
  e += 0.95 * Math.exp(-Math.pow((rx - 0.78) / 0.12, 2)) * sm(-0.4, 0.2, ry);   // strip light, right
  e += 0.55 * Math.exp(-Math.pow((rx + 0.82) / 0.10, 2)) * sm(-0.2, 0.3, ry);   // strip light, left
  if (rz < -0.2) e *= 0.6;
  return e;
}
const key = (x, y, z) => Math.max(0, x * -0.35 + y * 0.62 + z * 0.70);

export const MATCAPS = {};
export function buildMatcaps() {
  if (MATCAPS.plate) return MATCAPS;
  MATCAPS.plate = paintMatcap(256, (x, y, z) => { const v = 0.05 + 0.2 * key(x, y, z) + 0.7 * Math.min(studio(x, y, z), 1.05); return [v, v, v * 0.985]; });
  // white scenes: same studio, but the horizon band is grey not black and the floor bounce is bright —
  // refs' figures on white read as light chrome with soft grey modelling (ref4 18.5s, ref6 44.5s)
  MATCAPS.plateLight = paintMatcap(256, (x, y, z) => {
    const rx = 2 * z * x, ry = 2 * z * y;
    let e = 0.62 + 0.25 * sm(0.1, 0.5, ry) - 0.38 * Math.exp(-Math.pow((ry + 0.05) / 0.16, 2)) + 0.2 * Math.exp(-Math.pow((rx - 0.75) / 0.14, 2));
    const v = 0.10 + 0.25 * key(x, y, z) + 0.68 * e; return [v, v, v * 0.985]; });
  MATCAPS.suit = paintMatcap(256, (x, y, z) => { const v = 0.035 + 0.06 * key(x, y, z) + 0.30 * Math.pow(studio(x, y, z), 2.2); return [v, v, v]; });
  MATCAPS.red = paintMatcap(256, (x, y, z) => { const d = 0.30 + 0.75 * key(x, y, z), s = 0.35 * Math.pow(studio(x, y, z), 3); return [0.88 * d + s, 0.07 * d + s, 0.10 * d + s]; });
  MATCAPS.visor = paintMatcap(256, (x, y, z) => { const v = 0.015 + 0.55 * Math.pow(studio(x, y, z), 3); return [v, v, v]; });
  // matte props: soft gradient like the grey-shaded objects in the refs (no chrome bands)
  MATCAPS.prop = paintMatcap(256, (x, y, z) => { const v = 0.30 + 0.62 * key(x, y, z) + 0.12 * sm(0.2, 0.9, y); return [v, v, v * 0.99]; });
  MATCAPS.propDark = paintMatcap(256, (x, y, z) => { const v = 0.08 + 0.55 * key(x, y, z) + 0.1 * sm(0.2, 0.9, y); return [v, v, v]; });
  return MATCAPS;
}

// matcap + rim. rimAmt>0 brightens silhouettes (dark scenes: holographic edge); with a dark rimColor it
// inks the silhouette (white scenes), like the refs where figures on white get near-black contours.
export const RIM = { color: { value: new THREE.Color(1, 1, 1) }, amt: { value: 0.35 }, pow: { value: 2.4 } };
export function matcapMat(tex, opts = {}) {
  const m = new THREE.MeshMatcapMaterial({ matcap: tex, color: opts.color || 0xffffff, side: opts.side || THREE.FrontSide, transparent: !!opts.transparent, opacity: opts.opacity ?? 1 });
  m.onBeforeCompile = sh => {
    sh.uniforms.rimColor = RIM.color; sh.uniforms.rimAmt = opts.noRim ? { value: 0 } : RIM.amt; sh.uniforms.rimPow = RIM.pow;
    sh.fragmentShader = 'uniform vec3 rimColor; uniform float rimAmt; uniform float rimPow;\n' + sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      'float rimK = pow(1.0 - abs(normal.z), rimPow) * rimAmt; outgoingLight = mix(outgoingLight, rimColor, clamp(rimK, 0.0, 1.0));\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'rim' + (opts.noRim ? 0 : 1);
  return m;
}

// X-ray hologram (ref 7): additive fresnel shell + travelling scan bands, depth-sorted off.
export function xrayMat(opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color(opts.color || 0xffffff) }, intensity: { value: opts.intensity ?? 1 }, core: { value: opts.core ?? 0.12 }, dots: { value: opts.dots ?? 55 }, dotAmt: { value: opts.dotAmt ?? 0 } },
    vertexShader: /* glsl */`
      #include <common>
      #include <skinning_pars_vertex>
      varying vec3 vN; varying vec3 vW; varying vec3 vV;
      void main(){
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 wp = modelMatrix * vec4(transformed, 1.0); vW = wp.xyz;
        vN = normalize(normalMatrix * objectNormal);
        vec4 mv = viewMatrix * wp; vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float time, intensity, core, dots, dotAmt; uniform vec3 color;
      varying vec3 vN; varying vec3 vW; varying vec3 vV;
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float fres = pow(f, 1.8);
        float scan = 0.55 + 0.45 * sin(vW.y * 220.0);
        float band = smoothstep(0.0, 0.02, 0.02 - abs(fract(vW.y * 0.6 - time * 0.25) - 0.5) * 0.04);
        // surface dot lattice in world space (the refs' holograms read as dotted/particled skins)
        vec3 q = fract(vW * dots) - 0.5;
        float dot3 = smoothstep(0.22, 0.08, length(q.xy)) * smoothstep(0.5, 0.2, abs(q.z)) * dotAmt;
        float a = (core + fres * 0.95) * scan + band * 0.6 + dot3 * (0.25 + fres);
        gl_FragColor = vec4(color * a * intensity, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

export const POLARITY_SWAP = [];   // [material, darkTex, lightTex]
export function setPolarity(p) {
  for (const [m, d, l] of POLARITY_SWAP) { const t = p > 0.5 ? l : d; if (m.matcap !== t) { m.matcap = t; m.needsUpdate = true; } }
  // p = 0 dark scene, 1 white scene
  RIM.color.value.setScalar(p > 0.5 ? 0.02 : 1.0);
  RIM.amt.value = p > 0.5 ? 0.55 : 0.32;
}
