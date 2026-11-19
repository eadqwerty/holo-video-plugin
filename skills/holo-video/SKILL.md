---
name: holo-video
description: Make a vertical 9:16 (default) or 16:9, 60-70 s cinematic "hidden mechanism" mindset short in the HOLO style (chrome android, pi-digit glyph matte, red accents, smear/whip/zoom transitions, Kokoro narration), entirely in code - sourced script, narration, a three.js storyboard, procedural sound, render and QA. Use when the user asks for a HOLO video or episode, "a video like these", a new episode from the topic backlog, or to set up, re-render or fix an episode.
---

# HOLO video episodes

`PLUGIN` = this plugin's root: two folders above this skill's base directory (also `${CLAUDE_PLUGIN_ROOT}`).
`PROJECT` = the user's video folder: the current working directory unless they name another. All commands below
run from `PROJECT`. `PY` = `.venv/bin/python` inside `PROJECT`. Quote paths; they may contain spaces.

## 0. Setup (once per project folder)
If `PROJECT` has no `engine/`, no `.venv/` or no `engine/models/kokoro-v1.0.onnx`, run:

    bash "$PLUGIN/scripts/setup.sh" "$PROJECT"

- It copies the engine, tools, docs and three example episodes into `PROJECT`. It installs three.js and Playwright
  Chromium (npm), creates `.venv` with Kokoro TTS and Whisper, and downloads the Kokoro voice model (~340 MB). Then it
  renders one test still. Expect 5-10 minutes. The Whisper model downloads on the first narration.
- It needs Node 18+, Python 3.10-3.13 and ffmpeg. If something is missing it stops and prints the install command.
  Ask the user before installing system packages (e.g. `brew install ffmpeg node python@3.12`).
- `bash "$PLUGIN/scripts/setup.sh" --check "$PROJECT"` re-checks without changing anything.
- Platform: built and tested on Apple Silicon macOS (Metal GPU, mlx-whisper). Other systems use faster-whisper and
  Chromium's default GPU path. These are untested, so say so if the user is not on a Mac.

Before the first episode in a session, read `PROJECT/docs/STYLE_SPEC.md` (binding look),
`docs/CONTENT_FORMULA.md` (script and storyboard rules) and `docs/PIPELINE.md` (commands). Then study one example
film: `films/ep002_doorways/film.js` is the most complete, and `films/ep003_too_busy/film.js` (with its
`vertical.js`) shows the house pace and vertical re-framing.

## Fixed rules (do not relax without the user's explicit say-so)
- **The style is fixed.** Every episode uses the HOLO engine and `docs/STYLE_SPEC.md`. Don't invent a new look,
  simplify the pipeline or swap in generic motion graphics.
- **Format: vertical 9:16 (1080x1920) by default**, for YouTube Shorts, Reels and TikTok. It renders with
  `engine/tools/render_vertical.mjs` (engine copy `engine/web_vertical/`). Make the 16:9 version (`render.mjs`,
  `engine/web/`) only when the user asks for a horizontal upload. Never letterbox 16:9 into 9:16.
  - Keep vertical shots from looking too zoomed in. The default is lens x1.5 with the camera pulled back x1.2.
  - All titles and HUD labels stay inside the UI-safe area (x 0.05-0.80, y 0.10-0.66), clear of the right-side
    buttons and the bottom caption rows. The vertical engine enforces this; check it in the stills.
- **House pace (locked):**
  - ~174 WPM (Kokoro `am_michael`; tune `speed` 1.02-1.10 until `voice.py` reports 170-176).
  - Pauses 0.12-0.18 s, beats 0.28-0.34 s.
  - The hook goes straight into the story, with the anchor (date + name) by ~5 s.
  - About 20 short lines and 190-205 words.
  - ~28 shots per minute, including angle cuts on emphasis words.
- **Facts must be real and sourced.**
  - Verify every claim with web search, preferably in the primary paper.
  - Write `films/<ep>/facts.md` (claim to source, with page numbers where possible) **before** the script.
  - Hedge contested or small-sample science in the script itself ("in one study", "researchers found").
  - Never invent numbers, quotes or dates.
- **Originality.**
  - Use only the stock Kokoro voice and never clone a real narrator's voice.
  - Never reuse other creators' footage, logos or scripts, and never duplicate their distinctive scenes.
  - Build original scenes from the prop kit.
- **One episode at a time.** Don't batch-produce until the user has approved a pilot. Show each episode and wait.
- **Honest reporting.** Never call an episode accurate or finished without having looked at its stills and contact
  sheet. Say what is untested or weak.

## Episode workflow
`<ep>` = `epNNN_slug` (next free number in `films/`). Copy the folder layout of an example episode.

1. **Topic.**
   - If the user gave a topic, use it.
   - If they gave none ("/holo", "next", "auto", "pick one"), choose it yourself with
     [topic-finder.md](topic-finder.md). It takes the backlog first; when the backlog runs out, it researches,
     verifies and scores new topics and adds them to the backlog. Don't ask the user to choose: state the pick in one
     line and continue.
   - Either way, re-check the facts with web search.
2. **facts.md first:** every claim, its source and its status (ROBUST / SOLID-LIMITED / CONTESTED).
3. **script.json:**
   - Nine beats: hook, anchor, result, mechanism, mirror, turn, caveat, action, closing question that echoes the hook.
   - One sentence or fragment group per `lines[]` entry, each with a `pause`.
   - Second person, short sentences, lists of three, no hashtags or calls to action.
   - Fields: `{"title","voice":"am_michael","speed":1.06,"lead":0.1,"tail":1.6,"lines":[{"id":"l01","text":"...","pause":0.15}]}`.
4. **Narration:** `$PY engine/tools/voice.py films/<ep>/script.json films/<ep>/audio`.
   - Check that the reported WPM is 170-176 and that `asr words` equals the word count.
   - Check `audio/words.json` for every word you will sync to.
   - Respell words the voice mispronounces.
5. **Storyboard as code** (`films/<ep>/film.js`):
   - Start from the shot templates in `engine/web/src/shots.js` and the example films. (Films import `holo/...`, so
     one `film.js` serves both formats.)
   - **Compose vertical-first:** keep the subject near the centre, prefer one figure per shot or figures stacked in
     depth, and avoid side-by-side pairs or put them in `vertical.js`.
   - One shot per sentence, alternating white and black.
   - Every shot shows a literal noun from its sentence. The android is "you"; the ghost hologram is the mind.
   - One title per shot, on its key word: red for the punch, grey for setup.
   - Clinical HUD tags.
   - Transitions: smear for polarity flips, zoom going inside, whip at chapter turns, glitch on the turn.
   - End on the ghost figure with a red core and the question held as a cross-cut title.
   - Time everything from narration with `N.cut('lNN')` and `w('word', n)`.
   - Write `STORYBOARD.md` as a table of line, shot, transition and title.
6. **Look-dev stills (vertical).** Render a frame every ~2 s and LOOK at every one:
   - `node engine/tools/render_vertical.mjs --film films/<ep>/film.js --stills 0.8,2.8,4.8,... --outdir analysis/<ep>_vert --size 540x960`
   - `$PY tools/sheet.py analysis/<ep>_vert/sheetA.jpg 9 213 analysis/<ep>_vert/t*.png` (18 per sheet).
   - Fix shots whose subject is off-centre or cut off by adding `films/<ep>/vertical.js` (copy the ep003 one). Each
     entry picks the shot playing at `at` (use `cut('lNN')` / `w('word')`) and adjusts its camera:
     - `follow: n` keeps the n-th figure of the scene centred (figures count in creation order);
     - `followY` sets the aim height;
     - `dist: k` pulls back, multiplying the default;
     - `zoom` sets the lens;
     - `aim`, `pos`, `shift` or `camera: (lt, dur, c) => ({pos, target, fov})` give full control.
   - Also fix props that are too small, unreadable titles and empty frames in `film.js`. Re-render the changed shots.
7. **Render and sound:**
   - `node engine/tools/render_vertical.mjs --film films/<ep>/film.js --cues films/<ep>/audio/cues.json`
   - `$PY engine/audio/sound.py films/<ep>/audio/cues.json films/<ep>/audio/mix.wav --voice films/<ep>/audio/voice.wav --seed <n>`
   - `node engine/tools/render_vertical.mjs --film films/<ep>/film.js --out renders/vertical/<ep>_v1_video.mp4 --workers 4`
     takes about 3 minutes for 65 s on an M-series Mac. Run it in the background and wait for completion.
   - `ffmpeg -y -i renders/vertical/<ep>_v1_video.mp4 -i films/<ep>/audio/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest renders/vertical/<ep>_v1.mp4`
     This is the upload file.
   - Phone copy, under 30 MB:
     `ffmpeg -y -i renders/vertical/<ep>_v1.mp4 -c:v libx264 -crf 24 -maxrate 3M -bufsize 6M -c:a aac -b:a 160k -movflags +faststart renders/phone/<ep>_v1_phone.mp4`
   - **Horizontal 16:9 (only on request):** run the same commands with `engine/tools/render.mjs` (default
     1920x1080), output in `renders/`. Look-dev for it uses `--size 1024x576`. The same `mix.wav` works for both.
8. **QA:**
   - Contact sheet of the final file:
     `ffmpeg -ss 1 -i renders/vertical/<ep>_v1.mp4 -vf fps=1/2.5,scale=216:-2 -q:v 3 <tmp>/f%03d.jpg`, then
     `$PY tools/contact_sheet.py <tmp> analysis/<ep>_v1_sheet.jpg 14 136 1.0 2.5`. Look at it.
     Blank or blurred frames right at a cut are transitions; check them with a still if unsure.
   - `$PY tools/qa.py analysis/<ep>_vert/t*.png` checks the spec numbers: paper ~238-241, glyph pitch, red
     (185,83,92). It works for portrait and landscape stills.
   - If the user has their own reference frames, `tools/compare.py` compares side by side.
9. **Deliver.** Give the paths, length, WPM and shots per minute, what works, and what is weak. Send the phone copy
   if the host can send files.
   - Append a row to `docs/EPISODE_LOG.md`.
   - Mark the backlog heading `· ✅ made as EPxxx` if the topic came from there.
   - Ask before starting the next episode.

## Engine notes
- Rebuilding the android needs Blender 4+ (optional; the built `engine/assets/android.glb` ships):
  `blender -b --python engine/blender/build_android.py -- engine/assets/android.glb analysis/android_prev`.
  The default body is the CC0 MakeHuman mesh with a mask head; `HOLO_HEAD=helmet` gives the visor helmet.
- Hero props (`heroProp`): brain, bulb, headphones, phone, cabinet, bed, clock, hourglass. Add new ones in
  `engine/blender/build_props.py` when a script needs a literal noun the kit lacks.
- Poses live in `engine/web/src/android.js` (`POSES`, `walkPose`, `walkWith`, `extend`, `mixPose`). Custom poses
  can be defined inside a film (see `SLUMP` and `HELP` in ep003).
- Two engine copies: `engine/web/` (16:9) and `engine/web_vertical/` (9:16, the default). A change to shared engine
  code (android, props, env, post) must be made in both. Only `runtime.js`, `text.js`, `post.js` and `android.js`
  differ, by the vertical edits.
- Render one still first after any engine change: a broken shader shows up as a black frame.
