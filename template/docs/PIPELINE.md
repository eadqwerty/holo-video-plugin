# Making an episode (HOLO pipeline)

Everything is in code; nothing needs a GUI. All commands run from the project root (the folder set up by the plugin's `scripts/setup.sh`).

```
films/<epNNN_slug>/
  script.json     narration lines + pauses + voice settings
  facts.md        every factual claim with its source
  film.js         storyboard as code (shots, titles, HUD, glitches) timed from audio/words.json
  audio/          voice_raw/, voice.wav, lines.json, words.json, cues.json, mix.wav (+ stems)
renders/<epNNN_slug>_vN.mp4
```

1. **Topic and script.** Follow `docs/CONTENT_FORMULA.md`: 180–210 words, nine beats, one sentence per `lines[]` entry, with a `pause` after each line (house pace: 0.12–0.18 normal, 0.28–0.34 beat). Write `facts.md` first.
2. **Narration:**
   `.venv/bin/python engine/tools/voice.py films/<ep>/script.json films/<ep>/audio`
   It reports WPM; aim for **~174** (house pace; acceptable 170–176) and adjust `speed` (default `am_michael` @ 1.08). Check `words.json` for every key word you will sync to.
3. **Storyboard as code.** Start from the **shot templates** in `engine/web/src/shots.js`:
   - `deskScene`, `walkTrack` (with `carry`), `hologramLoops` (with `stopAt`), `objectRow` (cubes turn red)
   - `propStudy` (hero prop, optional aura), `thresholdWalk` (doorway + red boundary), `headClose` (with `turnAt`), `finale`
   - `angle({t0, camera})` for angle cuts, with camera helpers `closeOn`, `lowWide`, `overhead`

   Write custom shots only where a sentence needs something new. `films/ep002_doorways/film.js` is the most complete custom example.
   - Each shot is `{t0, bg:'white'|'black', xin:'smear'|'zoom'|'whip'|'glitch'|'cut', build({scene, add}) → {update, camera, hud}}`.
   - Time everything from narration: `N.cut('l05')` for shot starts, and `title(str, 'word', occurrence, opts)` for titles.
4. **Look-dev stills.** Render one frame per shot at 1024×576:
   `node engine/tools/render.mjs --film films/<ep>/film.js --stills 1.5,4.2,... --outdir analysis/<ep> --size 1024x576`
   Then `.venv/bin/python tools/sheet.py analysis/<ep>/sheet.jpg 4 512 analysis/<ep>/t*.png`, and check the spec numbers with `.venv/bin/python tools/qa.py analysis/<ep>/t*.png` (with your own reference frames, `tools/compare.py` compares side by side).
5. **Render** (~15 frames/s with 4 workers, so **about 2 min for a 62 s episode**):
   `node engine/tools/render.mjs --film films/<ep>/film.js --out renders/<ep>_video.mp4 --workers 4`
   - Capture: each frame is packed to YUV 4:2:0 (BT.709) on the GPU, sent as raw bytes over a local WebSocket, and encoded once by a per-worker x264 (CRF 18). Parts are joined without re-encoding.
   - Measured: render 2 ms, readback 14 ms; the old PNG screenshot was 290 ms per frame.
   - `--capture png` keeps the old (slow) path as a fallback.
   - Phone copy: `ffmpeg -i renders/<ep>.mp4 -vf scale=1280:-2 -c:v libx264 -crf 24 -maxrate 4M -bufsize 8M -c:a aac -b:a 160k -movflags +faststart renders/phone/<ep>_phone.mp4`
6. **Sound:**
   - `node engine/tools/render.mjs --film films/<ep>/film.js --cues films/<ep>/audio/cues.json`
   - `.venv/bin/python engine/audio/sound.py films/<ep>/audio/cues.json films/<ep>/audio/mix.wav --voice films/<ep>/audio/voice.wav --seed <n>`
   - `ffmpeg -i renders/<ep>_video.mp4 -i films/<ep>/audio/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest renders/<ep>_vN.mp4`
7. **QA:**
   - Contact sheet of the final file.
   - Transition strips at 10 fps.
   - `tools/compare.py` against 3–4 reference frames: paper ≈ 238–241, glyph pitch 3.20×5.33 at 1024, red ≈ (185,83,92) on white.
   - Listen for TTS mispronunciations; fix them by respelling in `script.json`.

## Rebuilding the character
`blender -b --python engine/blender/build_android.py -- engine/assets/android.glb analysis/android_prev`
   - The default build is the CC0 MakeHuman body with the mask head. `HOLO_HEAD=helmet` gives the visor-helmet head (→ `android_mhh.glb`), and `HOLO_BASE=metaball` gives the old v1–v4 body (→ `android_v4_metaball.glb`). `HOLO_FACE_SMOOTH` (default 60) controls how calm the face is.
   - Render with a non-default body: `render.mjs ... --android mhh` loads `engine/assets/android_mhh.glb`; omit the flag for `android.glb`.
This is deterministic. Edit anatomy (metaball table), armour cuts or accents in that script.

## Engine map
| File | Role |
|---|---|
| `engine/web/src/post.js` | grade → cell → π-glyph matte → bloom → final (chroma, streaks, echo, flashes, glitch, grain, HUD) |
| `engine/web/src/runtime.js` | boot, shot scheduling, lazy scene build, camera rigs (`orbit`, `dolly`), handheld drift, **transitions**, cue export |
| `engine/web/src/android.js` | GLB load, materials by role, direction-based posing, pose library, `walkPose`, `extend`, `mixPose`, `withIdle` |
| `engine/web/src/materials.js` | procedural chrome/light/prop/red/visor matcaps, rim by polarity, x-ray shader |
| `engine/web/src/env.js` | grid, trace, rings, particles, wire sphere, lattice, door, pillar, blob shadow, fat lines |
| `engine/web/src/props.js` | cube, table, desk, chair, card, calendar, panel, arc, bar, wall (`frame:true` = free-standing doorway, preferred), boundary (red scan plane), filmStrip |
| `engine/web/src/text.js` | titles (cloud-in, tear-out), HUD callouts, emblem |
| `engine/web/src/sync.js` | narration word/line timing |
| `engine/tools/render.mjs` | Playwright/Chromium (Metal), one browser per worker; GPU YUV pack → WebSocket → x264 per worker → concat (copy) |
| `engine/tools/voice.py` | Kokoro TTS → assembled + processed voice → per-line Whisper alignment onto script words |
| `engine/audio/sound.py` | procedural bed + SFX from cues, ducking, −14 LUFS master |
| `tools/compare.py`, `tools/sheet.py`, `tools/contact_sheet.py` | measurement and contact sheets |

## Episodes so far
| Ep | Title | Topic / anchor | Length | Render time |
|---|---|---|---|---|
| 001 | Open Loops | Zeigarnik effect (Lewin's waiter, 1920s; Zeigarnik 1927; Masicampo & Baumeister 2011) | 65.8 s | ~23 min (old PNG capture) |
| 002 | The Last Room | Doorway effect (Radvansky et al., 2011) | 61.5 s | 2 min 4 s (fast capture) |


## Rebuilding hero props
`blender -b --python engine/blender/build_props.py -- engine/assets/props analysis/props_prev`
