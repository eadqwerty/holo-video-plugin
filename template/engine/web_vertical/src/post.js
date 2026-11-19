// HOLO post chain — reverse-engineered from the reference frames (see docs/STYLE_SPEC.md §3).
//
//  scene (MSAA, linear-as-display values, no colour management)
//   └─ GRADE   mono + red retention, contrast curve, exposure lift, text layer composited (text gets glyph texture too)
//       └─ CELL    average colour per 6x10px character cell (at 1080p)
//           └─ GLYPH  digits-of-pi matte: per-cell tone + digit stroke contrast + 1px cell gaps, polarity by bg
//               └─ BLOOM  quarter-res glow (red + highlights)
//                   └─ FINAL  zoom-through / whip blur, radial chroma (blue zoomed out -> yellow frame edge),
//                             frame echo (feedback), flashes, horizontal streak interference, grain, vignette,
//                             glitch bands, HUD layer, logo bug  ->  screen + history
import * as THREE from 'three';
import { piDigits } from './util.js';

const VS = /* glsl */`out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const HEAD = /* glsl */`precision highp float; in vec2 vUv; out vec4 outColor;
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float h11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
`;

function pass(frag, uniforms) {
  const m = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: 'in vec3 position; in vec2 uv;\n' + VS,
    fragmentShader: HEAD + frag, uniforms, depthTest: false, depthWrite: false,
  });
  return m;
}

const GRADE = /* glsl */`
uniform sampler2D tScene, tText; uniform vec2 res; uniform float exposure, contrast, redKeep, lift, textOn, soft, blackPt;
uniform vec3 paper; uniform float hazeAmt, hazeR; uniform vec2 hazePos;
uniform sampler2D tDepth; uniform float near, far, aoAmt, aoRad, pxPerUnit;
vec3 tap(vec2 o){ return texture(tScene, vUv + o / res).rgb; }
float linZ(float d){ return near * far / (far - d * (far - near)); }
// normal-oriented SSAO (Alchemy-style): view-space position from depth, normal from derivatives; only geometry
// ABOVE the surface occludes, so flat floors don't self-shadow. Soft contacts, seams and creases like the refs.
uniform vec2 tanHalf;
vec3 vpos(vec2 uv){ float z = linZ(texture(tDepth, uv).r); return vec3((uv * 2.0 - 1.0) * tanHalf * z, -z); }
float ssao(){
  float d0 = texture(tDepth, vUv).r;
  if (d0 >= 0.9999) return 1.0;
  vec3 P = vpos(vUv);
  vec3 N = normalize(cross(dFdx(P), dFdy(P)));
  float rpx = clamp(aoRad * pxPerUnit / -P.z, 3.0, 80.0);
  float occ = 0.0, rot = h12(gl_FragCoord.xy) * 6.2831;
  for (int i = 0; i < 16; i++) {
    float k = (float(i) + 0.5) / 16.0, a = float(i) * 2.39996 + rot;
    vec2 off = vec2(cos(a), sin(a)) * rpx * k;
    vec3 S = vpos(vUv + off / res) - P;
    float dd = dot(S, S);
    occ += max(0.0, dot(N, S) - 0.004 * -P.z) / (dd + 0.01) * (1.0 - smoothstep(aoRad * aoRad, 4.0 * aoRad * aoRad, dd));
  }
  return clamp(1.0 - occ / 16.0 * 0.9, 0.0, 1.0);
}
void main(){
  // soft optical blur (refs: shading is soft, only the glyph matte is pixel-crisp)
  float ao = aoAmt > 0.0 ? ssao() : 1.0;
  vec3 c = tap(vec2(0.0)) * 0.36 + (tap(vec2(soft, 0.0)) + tap(vec2(-soft, 0.0)) + tap(vec2(0.0, soft)) + tap(vec2(0.0, -soft))) * 0.12
         + (tap(vec2(soft, soft)) + tap(vec2(-soft, soft)) + tap(vec2(soft, -soft)) + tap(vec2(-soft, -soft))) * 0.04;
  c *= mix(1.0, ao, aoAmt);
  // red retention: hue-selective desaturation. Everything that is not red becomes neutral grey; reds keep their
  // own chroma (so pale pink speckle clouds stay pink, deep reds stay crimson), nudged toward the house crimson hue.
  float L = luma(c);
  float redness = c.r - max(c.g, c.b);
  float red = smoothstep(0.012, 0.09, redness) * step(c.g, c.r) * redKeep;
  vec3 chroma = (c - vec3(L)) * 1.2;
  chroma.b = mix(chroma.b, chroma.g + 0.16 * redness, 0.6);   // crimson lean (blue slightly above green)
  c = vec3(L) + chroma * red;
  // atmospheric haze (dark scenes are never pure black in the refs: p50 ~ 3-9/255, p75 ~ 14-58/255)
  vec2 hq = (vUv - hazePos) * vec2(res.x / res.y, 1.0);
  c += hazeAmt * exp(-dot(hq, hq) / (hazeR * hazeR)) * (1.0 - c);
  // tone curve
  c = c * exposure;
  vec3 x = clamp(c, 0.0, 1.0);
  vec3 sc = x * x * (3.0 - 2.0 * x);
  c = mix(x, sc, contrast);
  c = c + lift * (1.0 - c);
  // text layer sits on the scene BEFORE the glyph pass, like the references
  vec4 t = texture(tText, vec2(vUv.x, 1.0 - vUv.y));
  c = mix(c, t.rgb / max(t.a, 1e-4), t.a * textOn);
  // output range: refs never reach 255 — paper white is warm (239,240,235), black floor ~2/255
  c = mix(vec3(blackPt), paper, c);
  outColor = vec4(c, 1.0);
}`;

const CELL = /* glsl */`
uniform sampler2D tSrc; uniform vec2 res, cell;
void main(){
  vec2 cpx = floor(vUv * res / cell) * cell;     // cell origin in px (vUv is cell-grid uv here)
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) {
    vec2 p = cpx + cell * (vec2(float(i), float(j)) + 0.5) / 3.0;
    acc += texture(tSrc, p / res).rgb;
  }
  outColor = vec4(acc / 9.0, 1.0);
}`;

const GLYPH = /* glsl */`
uniform sampler2D tSrc, tCell, tAtlas, tDigits; uniform vec2 res, cell, digitsSize; uniform float amount, polarity, detail, gapAmt, scroll;
void main(){
  vec2 px = vUv * res;
  px.y = res.y - px.y;                        // top-left origin like text
  vec2 g = px / cell; vec2 ci = floor(g); vec2 f = fract(g);
  vec2 cuv = (ci + 0.5) / (res / cell); cuv.y = 1.0 - cuv.y;
  vec3 cc = texture(tCell, cuv).rgb;
  vec3 c0 = texture(tSrc, vUv).rgb;
  vec3 m = mix(cc, c0, detail);
  float L = luma(m);
  // which digit lives in this cell: the digits of pi, wrapped like lines of text
  vec2 di = mod(ci + vec2(0.0, floor(scroll)), digitsSize);
  float d = texelFetch(tDigits, ivec2(di), 0).r * 255.0;
  vec2 auv = vec2((d + f.x) / 11.0, f.y);
  vec2 dx = dFdx(g) / vec2(11.0, 1.0), dy = dFdy(g) / vec2(11.0, 1.0);
  float gl = textureGrad(tAtlas, auv, dx, dy).r;
  // gaps between character cells (1px column + 1px row at 1080p)
  float gx = step(f.x, 1.0 / cell.x * 1.0), gy = step(f.y, 1.0 / cell.y * 1.0);
  float gap = max(gx, gy);
  // contrast envelope: none on pure paper white / pure black, full in between
  float A = smoothstep(0.012, 0.07, L) * mix(1.0 - 0.55 * smoothstep(0.86, 0.95, L), 1.0 - smoothstep(0.83, 0.915, L), polarity) * amount;
  // dark-scene polarity: light digits on a darker cell; white-scene polarity: ink digits on a lighter cell
  vec3 lightG = m * mix(1.0 - 0.62 * A, 1.0 + 1.05 * A, gl) * (1.0 - gapAmt * A * gap);
  vec3 inkG   = m * mix(1.0 + 0.30 * A, 1.0 - 0.88 * A, gl) * (1.0 - gapAmt * 0.75 * A * gap);
  // red keeps its hue through the matte; never brighter than paper
  vec3 o = mix(lightG, inkG, polarity);
  outColor = vec4(clamp(o, 0.0, 0.945), 1.0);
}`;

const DOWN = /* glsl */`
uniform sampler2D tSrc; uniform vec2 texel; uniform float thresh;
void main(){
  vec3 a = texture(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb + texture(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb
         + texture(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb + texture(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb;
  a *= 0.25;
  float red = clamp((a.r - max(a.g, a.b)) * 2.0, 0.0, 1.0);
  float k = max(smoothstep(thresh, 1.0, luma(a)) * 0.6, red);
  outColor = vec4(a * k, 1.0);
}`;
const BLUR = /* glsl */`
uniform sampler2D tSrc; uniform vec2 dir;
void main(){
  vec3 s = texture(tSrc, vUv).rgb * 0.2270270270;
  s += texture(tSrc, vUv + dir * 1.3846153846).rgb * 0.3162162162; s += texture(tSrc, vUv - dir * 1.3846153846).rgb * 0.3162162162;
  s += texture(tSrc, vUv + dir * 3.2307692308).rgb * 0.0702702703; s += texture(tSrc, vUv - dir * 3.2307692308).rgb * 0.0702702703;
  outColor = vec4(s, 1.0);
}`;

const FINAL = /* glsl */`
uniform sampler2D tSrc, tBloom, tPrev, tHud; uniform vec2 res; uniform float frame, time;
uniform float bloom, chroma, echo, smear, zoom, zoomBlur, flashW, flashK, flashR, grain, streak, streakDark, vignette,
              glitch, glitchSeed, hudOn, polarity, softness, dimScene;
uniform vec2 whip, redBlob, zoomCenter; uniform float redBlobAmt;
vec3 src(vec2 uv){
  // zoom-through + radial blur, whip blur (applied to the glyph image so glyphs scale like the refs)
  vec2 c = zoomCenter;
  vec2 u = c + (uv - c) / zoom;
  vec3 acc = vec3(0.0); float w = 0.0;
  for (int i = 0; i < 10; i++) {
    float k = float(i) / 9.0;
    vec2 p = c + (u - c) * (1.0 - zoomBlur * k * 0.18) + whip * (k - 0.5);
    float wk = 1.0 - k * 0.5;
    // radial chroma: blue zoomed OUT (samples past the edge -> black -> yellow rim), red slightly in
    vec2 pr = c + (p - c) * (1.0 - chroma * 0.4), pb = c + (p - c) * (1.0 + chroma);
    vec3 s;
    s.r = texture(tSrc, pr).r; s.g = texture(tSrc, p).g;
    s.b = (pb.x < 0.0 || pb.x > 1.0 || pb.y < 0.0 || pb.y > 1.0) ? 0.0 : texture(tSrc, pb).b;
    acc += s * wk; w += wk;
  }
  return acc / w;
}
void main(){
  vec2 uv = vUv;
  vec2 px = uv * res;
  float rowH = min(res.x, res.y) / 1080.0 * 2.0;
  // glitch: horizontal band displacement
  if (glitch > 0.0) {
    float band = floor(px.y / (res.y * (0.02 + 0.08 * h11(floor(glitchSeed * 7.0)))));
    float r = h12(vec2(band, floor(glitchSeed * 13.0)));
    if (r < glitch * 0.6) uv.x += (h12(vec2(band, glitchSeed)) - 0.5) * 0.12 * glitch;
  }
  // streak rows also tear the image by a pixel or two
  float row = floor(px.y / rowH);
  float rs = h12(vec2(row, floor(frame)));
  float inStreak = 0.0;
  if (rs > 1.0 - 0.06 * streak) {
    float x0 = h12(vec2(row, frame + 3.1)), len = 0.15 + 0.7 * h12(vec2(row, frame + 7.7));
    inStreak = step(x0, uv.x) * step(uv.x, x0 + len) * (0.5 + 0.5 * h12(vec2(row, frame + 1.3)));
    uv.x += inStreak * (h12(vec2(row, frame + 9.0)) - 0.5) * 4.0 / res.x;
  }
  vec3 c = src(uv);
  if (glitch > 0.0) { // rgb split on glitch frames
    float o = glitch * 0.012;
    c.r = mix(c.r, src(uv + vec2(o, 0.0)).r, glitch);
    c.b = mix(c.b, src(uv - vec2(o, 0.0)).b, glitch);
  }
  c += texture(tBloom, uv).rgb * bloom;
  c *= dimScene;
  // red blurred blob flash between scenes (soft ellipse, slightly smeared)
  if (redBlobAmt > 0.0) {
    vec2 d = (vUv - redBlob) * vec2(res.x / res.y, 1.0) * vec2(0.55, 1.6);
    float b = exp(-dot(d, d) * 18.0) * redBlobAmt;
    c = mix(c, vec3(0.85, 0.08, 0.14), clamp(b, 0.0, 1.0));
  }
  // horizontal streak interference (the faint grey lines that run over the white backgrounds)
  float sd = mix(0.045, -0.035, polarity) * streakDark; // on white: darker lines; on black: faint lighter lines
  c -= inStreak * sd * (polarity > 0.5 ? 1.0 : -1.0) * (0.6 + 0.4 * luma(c));
  // frame echo (temporal feedback); smear stretches the echo horizontally
  if (echo > 0.0) {
    vec3 p = texture(tPrev, vUv + vec2(smear * 0.004, 0.0)).rgb;
    c = mix(c, max(c * 0.6, p), echo);
  }
  // flashes
  c = mix(c, vec3(0.94, 0.945, 0.925), flashW);
  c = mix(c, vec3(0.0), flashK);
  c = mix(c, vec3(0.80, 0.07, 0.13), flashR);
  // vignette (dark scenes)
  vec2 q = vUv - 0.5; c *= 1.0 - vignette * smoothstep(0.25, 0.85, length(q * vec2(1.0, 0.8)) * 1.25);
  // HUD (crisp, after the glyph matte)
  vec4 h = texture(tHud, vec2(vUv.x, 1.0 - vUv.y));
  c = mix(c, h.rgb / max(h.a, 1e-4), h.a * hudOn);
  // fine luminance grain
  float n = h12(px + fract(frame * 0.6180339) * 1000.0) - 0.5;
  c += n * grain * (0.35 + 0.65 * (1.0 - abs(luma(c) - 0.5) * 1.4));
  vec3 cn = vec3(h12(px + 17.0 + frame), h12(px + 53.0 + frame), h12(px + 91.0 + frame)) - 0.5;
  c += cn * grain * 0.55 * smoothstep(0.05, 0.4, luma(c)) * (1.0 - smoothstep(0.85, 0.93, luma(c)));
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const COPY = /* glsl */`uniform sampler2D tSrc; void main(){ outColor = vec4(texture(tSrc, vUv).rgb, 1.0); }`;

// Pack the finished frame into planar YUV 4:2:0 (BT.709, limited range) inside an RGBA8 target of (W/4) x (H*3/2):
// every texel = 4 consecutive bytes of the yuv420p byte stream, rows ordered so readPixels() returns the stream
// directly. 3.1 MB/frame instead of 8.3 MB of RGBA -> the capture bottleneck (page->node transfer) drops ~2.7x.
const PACK = /* glsl */`
uniform sampler2D tSrc; uniform ivec2 size;
vec3 rgbAt(ivec2 p){ return texelFetch(tSrc, ivec2(p.x, size.y - 1 - p.y), 0).rgb; }   // p in top-down pixels
float Yof(vec3 c){ return (16.0 + 219.0 * dot(c, vec3(0.2126, 0.7152, 0.0722))) / 255.0; }
vec2 UVof(vec3 c){ return (128.0 + 224.0 * vec2(dot(c, vec3(-0.1146, -0.3854, 0.5)), dot(c, vec3(0.5, -0.4542, -0.0458)))) / 255.0; }
float chroma(int b, int plane){        // byte index b inside the U or V plane
  int cw = size.x / 2; int r = b / cw, cc = b - r * cw;
  ivec2 p = ivec2(cc * 2, r * 2);
  vec3 c = (clamp(rgbAt(p), 0.0, 1.0) + clamp(rgbAt(p + ivec2(1, 0)), 0.0, 1.0) + clamp(rgbAt(p + ivec2(0, 1)), 0.0, 1.0) + clamp(rgbAt(p + ivec2(1, 1)), 0.0, 1.0)) * 0.25;
  vec2 uv = UVof(c); return plane == 0 ? uv.x : uv.y;
}
void main(){
  int x = int(gl_FragCoord.x), row = int(gl_FragCoord.y);
  int W = size.x, H = size.y;
  vec4 o;
  if (row < H) {
    for (int k = 0; k < 4; k++) o[k] = Yof(clamp(rgbAt(ivec2(x * 4 + k, row)), 0.0, 1.0));
  } else {
    int r = row - H; int plane = r < H / 4 ? 0 : 1; if (plane == 1) r -= H / 4;
    int base = r * W + x * 4;
    for (int k = 0; k < 4; k++) o[k] = chroma(base + k, plane);
  }
  outColor = o;
}`;

export class Post {
  constructor(renderer, w, h) {
    this.r = renderer; this.w = w; this.h = h;
    const rt = (W, H, o = {}) => new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, ...o });
    this.sceneRT = rt(w, h, { depthBuffer: true, samples: 4 });
    this.sceneRT.depthTexture = new THREE.DepthTexture(w, h);
    this.sceneRT.depthTexture.type = THREE.FloatType;
    this.gradeRT = rt(w, h);
    this.cell = new THREE.Vector2(6 * Math.min(w, h) / 1080, 10 * Math.min(w, h) / 1080);   // vertical: scale by the short side
    this.cols = Math.ceil(w / this.cell.x); this.rows = Math.ceil(h / this.cell.y);
    this.cellRT = rt(this.cols, this.rows, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.glyphRT = rt(w, h);
    this.b1 = rt(w >> 2, h >> 2); this.b2 = rt(w >> 2, h >> 2);
    this.hist = [rt(w, h), rt(w, h)]; this.hi = 0;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.qscene = new THREE.Scene(); this.qscene.add(this.quad);
    this.qcam = new THREE.Camera();
    this.atlas = this.makeAtlas();
    this.digits = this.makeDigits();
    const u = v => ({ value: v });
    this.mGrade = pass(GRADE, { tScene: u(this.sceneRT.texture), tText: u(null), res: u(new THREE.Vector2(w, h)), exposure: u(1), contrast: u(0.35), redKeep: u(1), lift: u(0), textOn: u(1), soft: u(1.4 * Math.min(w, h) / 1080), blackPt: u(0.008), paper: u(new THREE.Vector3(0.937, 0.941, 0.922)), hazeAmt: u(0), hazeR: u(0.6), hazePos: u(new THREE.Vector2(0.5, 0.55)), tDepth: u(this.sceneRT.depthTexture), tanHalf: u(new THREE.Vector2(1, 1)), near: u(0.05), far: u(400), aoAmt: u(0.6), aoRad: u(0.35), pxPerUnit: u(1000) });
    this.mCell = pass(CELL, { tSrc: u(this.gradeRT.texture), res: u(new THREE.Vector2(w, h)), cell: u(this.cell) });
    this.mGlyph = pass(GLYPH, { tSrc: u(this.gradeRT.texture), tCell: u(this.cellRT.texture), tAtlas: u(this.atlas), tDigits: u(this.digits), digitsSize: u(new THREE.Vector2(this.digits.image.width, this.digits.image.height)), res: u(new THREE.Vector2(w, h)), cell: u(this.cell), amount: u(1), polarity: u(0), detail: u(0.35), gapAmt: u(0.5), scroll: u(0) });
    this.mDown = pass(DOWN, { tSrc: u(this.glyphRT.texture), texel: u(new THREE.Vector2(1 / w, 1 / h)), thresh: u(0.8) });
    this.mBlur = pass(BLUR, { tSrc: u(null), dir: u(new THREE.Vector2()) });
    this.mFinal = pass(FINAL, {
      tSrc: u(this.glyphRT.texture), tBloom: u(this.b1.texture), tPrev: u(null), tHud: u(null), res: u(new THREE.Vector2(w, h)), frame: u(0), time: u(0),
      bloom: u(0.55), chroma: u(0.0042), echo: u(0), smear: u(0), zoom: u(1), zoomBlur: u(0), zoomCenter: u(new THREE.Vector2(0.5, 0.5)), whip: u(new THREE.Vector2()),
      flashW: u(0), flashK: u(0), flashR: u(0), grain: u(0.05), streak: u(1), streakDark: u(1), vignette: u(0.25), glitch: u(0), glitchSeed: u(0),
      hudOn: u(1), polarity: u(0), softness: u(0), dimScene: u(1), redBlob: u(new THREE.Vector2(0.5, 0.8)), redBlobAmt: u(0),
    });
    this.mCopy = pass(COPY, { tSrc: u(null) });
    this.mPack = pass(PACK, { tSrc: u(null), size: u(new THREE.Vector2(w, h)) });
    this.packRT = new THREE.WebGLRenderTarget(w / 4, h * 3 / 2, { type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
    this.last = null;
  }

  // read the most recent frame as a yuv420p byte stream (W*H*1.5 bytes)
  packYUV(out) {
    this.mPack.uniforms.tSrc.value = this.last;
    this.run(this.mPack, this.packRT);
    this.r.readRenderTargetPixels(this.packRT, 0, 0, this.w / 4, this.h * 3 / 2, out);
    this.r.setRenderTarget(null);
    return out;
  }

  makeAtlas() {
    // 11 glyphs ('0'..'9', blank) in a strip; drawn large, sampled with mip-mapping so they stay crisp at 6x10px
    const gw = 48, gh = 80, cv = document.createElement('canvas');
    cv.width = gw * 11; cv.height = gh;
    const g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = `600 ${gh * 0.86}px PlexMono, ShareMono, monospace`;
    for (let i = 0; i < 10; i++) g.fillText(String(i), gw * i + gw * 0.55, gh * 0.84);
    const t = new THREE.CanvasTexture(cv);
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
    return t;
  }

  makeDigits() {
    // the digit stream that the references reveal when zoomed in: 3.14159265358979...
    const N = 6000, s = piDigits(N);
    const cols = 512, rows = 192, data = new Uint8Array(cols * rows);
    let k = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      // occasional blanks like word gaps in a text dump
      const ch = s[(k++) % s.length];
      data[y * cols + x] = (k % 97 === 0 || k % 211 === 0) ? 10 : Number(ch);
    }
    const t = new THREE.DataTexture(data, cols, rows, THREE.RedFormat, THREE.UnsignedByteType);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
    return t;
  }

  run(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qscene, this.qcam); }

  render(scene, camera, P, textTex, hudTex, frame) {
    const r = this.r;
    r.setRenderTarget(this.sceneRT); r.clear(); r.render(scene, camera);
    const G = this.mGrade.uniforms;
    G.tText.value = textTex; G.exposure.value = P.exposure; G.contrast.value = P.contrast; G.lift.value = P.lift; G.redKeep.value = P.redKeep;
    G.near.value = camera.near; G.far.value = camera.far; G.aoAmt.value = P.ao; G.aoRad.value = P.aoRad;
    const th = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    G.pxPerUnit.value = this.h / (2 * th); G.tanHalf.value.set(th * camera.aspect, th);
    G.hazeAmt.value = P.haze; G.hazeR.value = P.hazeR; G.hazePos.value.set(P.hazePos[0], P.hazePos[1]); G.soft.value = P.soft * Math.min(this.w, this.h) / 1080;
    this.run(this.mGrade, this.gradeRT);
    this.run(this.mCell, this.cellRT);
    const Y = this.mGlyph.uniforms;
    Y.amount.value = P.glyph; Y.polarity.value = P.polarity; Y.detail.value = P.glyphDetail; Y.scroll.value = P.glyphScroll;
    this.run(this.mGlyph, this.glyphRT);
    this.run(this.mDown, this.b1);
    this.mBlur.uniforms.tSrc.value = this.b1.texture; this.mBlur.uniforms.dir.value.set(4 / this.w, 0); this.run(this.mBlur, this.b2);
    this.mBlur.uniforms.tSrc.value = this.b2.texture; this.mBlur.uniforms.dir.value.set(0, 4 / this.h); this.run(this.mBlur, this.b1);
    this.mBlur.uniforms.tSrc.value = this.b1.texture; this.mBlur.uniforms.dir.value.set(9 / this.w, 0); this.run(this.mBlur, this.b2);
    this.mBlur.uniforms.tSrc.value = this.b2.texture; this.mBlur.uniforms.dir.value.set(0, 9 / this.h); this.run(this.mBlur, this.b1);
    const F = this.mFinal.uniforms;
    const prev = this.hist[this.hi], next = this.hist[1 - this.hi];
    F.tPrev.value = prev.texture; F.tHud.value = hudTex; F.frame.value = frame;
    for (const k of ['bloom', 'chroma', 'echo', 'smear', 'zoom', 'zoomBlur', 'flashW', 'flashK', 'flashR', 'grain', 'streak', 'streakDark', 'vignette', 'glitch', 'glitchSeed', 'hudOn', 'polarity', 'dimScene', 'redBlobAmt'])
      if (P[k] !== undefined) F[k].value = P[k];
    F.whip.value.set(P.whip[0], P.whip[1]); F.zoomCenter.value.set(P.zoomCenter[0], P.zoomCenter[1]); F.redBlob.value.set(P.redBlob[0], P.redBlob[1]);
    this.run(this.mFinal, next);
    this.mCopy.uniforms.tSrc.value = next.texture; this.run(this.mCopy, null);
    this.last = next.texture;
    this.hi = 1 - this.hi;
  }
}

export const DEFAULT_POST = {
  exposure: 1, contrast: 0.35, lift: 0, haze: 0, hazeR: 0.6, hazePos: [0.5, 0.55], soft: 1.4, ao: 0.6, aoRad: 0.35, redKeep: 1, glyph: 1, polarity: 0, glyphDetail: 0.35, glyphScroll: 0,
  bloom: 0.55, chroma: 0.0042, echo: 0, smear: 0, zoom: 1, zoomBlur: 0, zoomCenter: [0.5, 0.5], whip: [0, 0],
  flashW: 0, flashK: 0, flashR: 0, grain: 0.05, streak: 1, streakDark: 1, vignette: 0.25, glitch: 0, glitchSeed: 0,
  hudOn: 1, dimScene: 1, redBlob: [0.5, 0.8], redBlobAmt: 0,
};
