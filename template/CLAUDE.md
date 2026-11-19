# HOLO video project (vertical 9:16 by default, 16:9 on request; ~60-70 s shorts)

This folder was set up by the `holo-video` plugin. Use its skill (`/holo <topic>`) to make episodes.

## The style is fixed: always use the HOLO system
- Every video uses the HOLO engine in `engine/`. Don't invent a new look, simplify the pipeline or swap in generic
  motion graphics unless the user explicitly asks.
- Binding look: `docs/STYLE_SPEC.md`. Script and storyboard rules: `docs/CONTENT_FORMULA.md`. Commands:
  `docs/PIPELINE.md`. Verified topics: `docs/TOPIC_BACKLOG.md`.
- Example episodes: `films/ep001_open_loops/`, `films/ep002_doorways/`, `films/ep003_too_busy/`. Shot templates:
  `engine/web/src/shots.js`.

## Format
- **Vertical 9:16 (1080x1920) by default**, rendered with `engine/tools/render_vertical.mjs` (engine copy `engine/web_vertical/`
  plus per-episode `films/<ep>/vertical.js` re-framing).
- Text stays in the UI-safe area (x 0.05-0.80, y 0.10-0.66).
- 16:9 (`render.mjs`, `engine/web/`) only when asked. Never letterbox.

## House pace (locked)
- ~174 WPM, pauses 0.12-0.18 s, beats 0.28-0.34 s.
- Anchor by ~5 s.
- ~28 shots per minute.

## Hard rules
- Facts must be real and sourced in `films/<ep>/facts.md`; hedge contested science.
- Use the stock Kokoro voice (`am_michael`). Never clone a real person's voice, and never reuse other creators'
  footage, logos or scripts.
- One episode at a time. Don't batch-produce until the user approves a pilot. Check stills and the contact sheet
  before calling anything done.

## Environment
- Python tools: `.venv/bin/python` (Kokoro TTS, Whisper, numpy, Pillow).
- Node: `engine/node_modules` (three.js, Playwright Chromium).
- ffmpeg on PATH. Blender is optional (rebuilds `engine/assets/android.glb`).
