# holo-video: a Claude Code plugin

Makes vertical 9:16 (default, for Shorts, Reels and TikTok) or 16:9, 60–70 s cinematic "hidden mechanism" mindset shorts in the HOLO style, entirely in code. Claude:
1. picks or receives a topic and verifies the facts;
2. writes a sourced script;
3. voices it with an offline stock voice (Kokoro);
4. builds the storyboard as three.js code (a chrome android, the π-digit glyph matte, red accents, smear, whip and
   zoom cuts);
5. adds procedural sound, renders and checks the result.

## Install

You need Claude Code, plus Node 18+, Python 3.10–3.13 and ffmpeg on the computer. On macOS:
`brew install node python@3.12 ffmpeg`.

1. In Claude Code, on any device, add the marketplace, then install:
   ```
   /plugin marketplace add eadqwerty/holo-video-plugin
   /plugin install holo-video@holo-video
   ```
   Restart Claude Code if it asks.
   - From a local copy instead: `/plugin marketplace add /path/to/holo-video-plugin`.
2. Update later with `/plugin marketplace update holo-video`, then `/plugin update holo-video@holo-video`.
3. Make an empty folder for your videos, open Claude Code in it and run:
   ```
   /holo setup
   ```
   This copies the engine into the folder, installs three.js, Playwright Chromium and a Python venv (Kokoro TTS,
   Whisper), downloads the voice model (~340 MB) and renders a test frame. Expect 5–10 minutes.
4. Make an episode:
   ```
   /holo                 (Claude picks the topic itself: next verified backlog topic, or new researched ones)
   /holo the Pygmalion effect
   ```

Each episode takes about 20–40 minutes end to end. Rendering a 65 s episode takes about 3 minutes on an
Apple Silicon Mac.

## Platform
Built and tested on Apple Silicon macOS (Metal GPU, mlx-whisper). Other platforms fall back to faster-whisper and
Chromium's default GPU path. These are untested.

## What's inside
- `skills/holo-video/SKILL.md`: the workflow and rules.
- `commands/holo.md`: the `/holo` command.
- `scripts/setup.sh`: project setup.
- `template/`: the engine, docs, tools and three example episodes that `setup.sh` copies into your project.

See `NOTICE.md` for third-party licences.
