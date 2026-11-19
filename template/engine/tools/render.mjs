#!/usr/bin/env node
// HOLO engine renderer. Loads engine/web/index.html?film=<film module>, drives window.HOLO.render(t)
// deterministically and encodes with ffmpeg.
//
// Capture (default --capture raw): the page renders, gl.readPixels()es the finished frame and POSTs the raw RGBA
// bytes to this process's local server; each worker pipes them straight into its own H.264 encode (BT.709 matrix),
// parts are concatenated without re-encoding.  ~5x faster than the old path (--capture png: compositor PNG
// screenshot -> FFV1 intermediate -> second encode), which is kept as a fallback.
//
//   node engine/tools/render.mjs --film films/demo/film.js --out out.mp4 [--size 1920x1080] [--fps 30]
//        [--from 0] [--to <dur>] [--workers 3] [--audio mix.wav] [--crf 12]
//   node engine/tools/render.mjs --film films/demo/film.js --stills 1.0,2.5,7 --outdir dir [--size 1024x576]
//
// Temporal effects (frame echo) need history, so each worker renders WARM frames before its segment.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { WebSocketServer } from 'ws';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(HERE, '..');
const ROOT = path.resolve(ENGINE, '..');           // project root (films live here)
const A = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => {
  if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const [W, H] = String(A.size || '1920x1080').split('x').map(Number);
const FPS = Number(A.fps || 30);
const WARM = 8;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.wav': 'audio/wav' };

const SINKS = new Map();   // worker id -> async (Buffer) => void
function serve() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(q.headers.host || '')) { r.writeHead(403); return r.end(); }
      if (q.method === 'POST' && q.url.startsWith('/__frame/')) {
        const id = q.url.slice(9), sink = SINKS.get(id);
        const buf = Buffer.allocUnsafe(W * H * 4); let off = 0;
        q.on('data', c => { c.copy(buf, off); off += c.length; });
        q.on('end', async () => {
          if (!sink || off !== buf.length) { r.writeHead(400); return r.end('bad frame ' + off); }
          await sink(buf); r.writeHead(204); r.end();
        });
        return;
      }
      let u; try { u = decodeURIComponent(q.url.split('?')[0]); } catch { r.writeHead(400); return r.end(); }
      const p = path.resolve(ROOT, '.' + u);
      if (!p.startsWith(ROOT + path.sep)) { r.writeHead(403); return r.end(); }
      fs.readFile(p, (e, d) => {
        if (e) { r.writeHead(404); return r.end('not found ' + u); }
        r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        r.end(d);
      });
    });
    // binary frame channel: ws://127.0.0.1:<port>/w/<worker id>; each message = one yuv420p frame, acked with 'k'
    const wss = new WebSocketServer({ server: s, maxPayload: 256 << 20 });
    wss.on('connection', (ws, req) => {
      const id = (req.url || '').split('/').pop();
      ws.on('message', async d => { const sink = SINKS.get(id); if (sink) await sink(Buffer.from(d)); ws.send('k'); });
    });
    s.listen(0, '127.0.0.1', () => res({ server: s, port: s.address().port }));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || /HOLO/.test(m.text())) console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  const film = String(A.film).replace(/^\.?\/?/, '');
  await page.goto(`http://127.0.0.1:${port}/engine/web/index.html?film=/${film}&w=${W}&h=${H}&fps=${FPS}${A.android ? '&android=' + A.android : ''}`);
  await page.waitForFunction(() => window.HOLO && window.HOLO.ready === true, null, { timeout: 120000 });
  return page;
}

async function frame(page, t) {
  await page.evaluate(t => window.HOLO.render(t), t);
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
}

const launch = () => chromium.launch({ args: [...(process.platform === 'darwin' ? ['--use-angle=metal'] : []), '--enable-gpu', '--ignore-gpu-blocklist', '--font-render-hinting=none', '--force-color-profile=srgb', '--enable-unsafe-swiftshader=false'] });

async function stills() {
  const { server, port } = await serve();
  const browser = await launch();
  const page = await openPage(browser, port);
  const outdir = path.resolve(A.outdir || 'stills');
  fs.mkdirSync(outdir, { recursive: true });
  for (const ts of String(A.stills).split(',').map(Number)) {
    // warm the temporal buffers with the frames just before t
    for (let k = WARM; k > 0; k--) await page.evaluate(t => window.HOLO.render(t), Math.max(0, ts - k / FPS));
    const png = await frame(page, ts);
    const f = path.join(outdir, `t${ts.toFixed(2).padStart(6, '0')}.png`);
    fs.writeFileSync(f, png);
    console.log(f);
  }
  await browser.close(); server.close();
}

const YUV = ['-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

async function video() {
  if (String(A.capture || 'raw') === 'png') return videoPng();
  const { server, port } = await serve();
  const browsers = [];
  const probeB = await launch(); browsers.push(probeB);
  const probe = await openPage(probeB, port);
  const dur = await probe.evaluate(() => window.HOLO.duration);
  await probe.close();
  const from = Number(A.from || 0), to = Math.min(Number(A.to || dur), dur);
  const n0 = Math.round(from * FPS), n1 = Math.round(to * FPS);
  const workers = Math.max(1, Number(A.workers || 4));
  const per = Math.ceil((n1 - n0) / workers);
  const tmp = path.resolve(A.out + '.parts');
  fs.mkdirSync(tmp, { recursive: true });
  const t0 = Date.now();
  let done = 0;
  const jobs = [];
  for (let w = 0; w < workers; w++) {
    const a = n0 + w * per, b = Math.min(n1, a + per);
    if (a >= b) break;
    jobs.push((async () => {
      const browser = w === 0 ? probeB : await launch();   // one browser process per worker: transfers don't queue
      if (w) browsers.push(browser);
      const page = await openPage(browser, port);
      for (let k = Math.max(0, a - WARM); k < a; k++) await page.evaluate(t => window.HOLO.render(t), k / FPS);
      const part = path.join(tmp, `p${String(w).padStart(2, '0')}.mkv`);
      const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
        '-c:v', 'libx264', '-preset', String(A.preset || 'medium'), '-crf', String(A.crf || 18), '-g', String(FPS * 2), part], { stdio: ['pipe', 'inherit', 'inherit'] });
      const id = String(w);
      SINKS.set(id, buf => new Promise(res => { if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res); }));
      await page.evaluate(url => window.HOLO.connect(url), `ws://127.0.0.1:${port}/w/${id}`);
      for (let k = a; k < b; k++) {
        await page.evaluate(t => window.HOLO.grab(t), k / FPS);
        if (++done % 30 === 0) {
          const el = (Date.now() - t0) / 1000;
          process.stderr.write(`\r${done}/${n1 - n0} frames  ${(done / el).toFixed(1)} fps  eta ${((n1 - n0 - done) / (done / el)).toFixed(0)}s   `);
        }
      }
      ff.stdin.end();
      await new Promise(r => ff.on('close', r));
      await page.close();
      return part;
    })());
  }
  const parts = await Promise.all(jobs);
  for (const b of browsers) await b.close();
  server.close();
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
  const args = ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list];
  if (A.audio) args.push('-ss', String(from), '-i', path.resolve(A.audio));
  args.push('-map', '0:v', '-c:v', 'copy');
  if (A.audio) args.push('-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest');
  args.push('-movflags', '+faststart', path.resolve(A.out));
  await new Promise((res, rej) => spawn('ffmpeg', args, { stdio: 'inherit' }).on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.error(`\nwrote ${A.out} (${n1 - n0} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s, raw capture)`);
}

async function videoPng() {
  const { server, port } = await serve();
  const browser = await launch();
  const probe = await openPage(browser, port);
  const dur = await probe.evaluate(() => window.HOLO.duration);
  await probe.close();
  const from = Number(A.from || 0), to = Math.min(Number(A.to || dur), dur);
  const n0 = Math.round(from * FPS), n1 = Math.round(to * FPS);
  const workers = Math.max(1, Number(A.workers || 3));
  const per = Math.ceil((n1 - n0) / workers);
  const tmp = path.resolve(A.out + '.parts');
  fs.mkdirSync(tmp, { recursive: true });
  const t0 = Date.now();
  let done = 0;
  const jobs = [];
  for (let w = 0; w < workers; w++) {
    const a = n0 + w * per, b = Math.min(n1, a + per);
    if (a >= b) break;
    jobs.push((async () => {
      const page = await openPage(browser, port);
      for (let k = Math.max(0, a - WARM); k < a; k++) await page.evaluate(t => window.HOLO.render(t), k / FPS);
      const part = path.join(tmp, `p${String(w).padStart(2, '0')}.mkv`);
      const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'rgb24', part], { stdio: ['pipe', 'inherit', 'inherit'] });
      for (let k = a; k < b; k++) {
        const png = await frame(page, k / FPS);
        if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
        if (++done % 30 === 0) {
          const el = (Date.now() - t0) / 1000;
          process.stderr.write(`\r${done}/${n1 - n0} frames  ${(done / el).toFixed(1)} fps  eta ${((n1 - n0 - done) / (done / el)).toFixed(0)}s   `);
        }
      }
      ff.stdin.end();
      await new Promise(r => ff.on('close', r));
      await page.close();
      return part;
    })());
  }
  const parts = await Promise.all(jobs);
  await browser.close(); server.close();
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
  const args = ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list];
  if (A.audio) args.push('-ss', String(from), '-i', path.resolve(A.audio));
  args.push('-map', '0:v');
  if (A.audio) args.push('-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest');
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', String(A.crf || 18), ...YUV, '-movflags', '+faststart', path.resolve(A.out));
  await new Promise((res, rej) => spawn('ffmpeg', args, { stdio: 'inherit' }).on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.error(`\nwrote ${A.out} (${n1 - n0} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

async function cues() {
  const { server, port } = await serve();
  const browser = await launch();
  const page = await openPage(browser, port);
  fs.writeFileSync(path.resolve(A.cues), JSON.stringify(await page.evaluate(() => window.HOLO.cues()), null, 1));
  console.log('wrote', A.cues);
  await browser.close(); server.close();
}

if (!A.film) { console.error('need --film'); process.exit(1); }
(A.cues ? cues() : A.stills ? stills() : video()).catch(e => { console.error(e); process.exit(1); });
