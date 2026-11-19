#!/usr/bin/env bash
# HOLO video: set up (or re-check) a project folder.
#   bash setup.sh <project_dir>            copy engine + docs + example films, install deps, download the voice model
#   bash setup.sh --check <project_dir>    only report what is present / missing
# Safe to re-run: engine/, tools/ and docs/ are refreshed from the plugin; films/, renders/, CLAUDE.md,
# docs/TOPIC_BACKLOG.md and docs/EPISODE_LOG.md are
# never overwritten; node_modules, .venv and the downloaded model are kept.
set -euo pipefail

CHECK=0
if [ "${1:-}" = "--check" ]; then CHECK=1; shift; fi
PLUGIN="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-$PWD}"
mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd)"
KOKORO_URL="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"

say() { printf '\n== %s\n' "$*"; }
missing=()

# ---------------------------------------------------------------- system tools
say "Checking system tools"
command -v node >/dev/null && NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]') || NODE_MAJOR=0
if [ "$NODE_MAJOR" -ge 18 ]; then echo "node $(node -v)"; else missing+=("Node.js 18+  (macOS: brew install node)"); fi
command -v ffmpeg >/dev/null && echo "ffmpeg ok" || missing+=("ffmpeg  (macOS: brew install ffmpeg)")
PY=""
for c in python3.12 python3.13 python3.11 python3.10 python3; do
  if command -v "$c" >/dev/null; then
    v=$("$c" -c 'import sys;print("%d.%d"%sys.version_info[:2])')
    case "$v" in 3.10|3.11|3.12|3.13) PY="$c"; break;; esac
  fi
done
if [ -n "$PY" ]; then echo "python: $PY ($($PY --version))"; else missing+=("Python 3.10-3.13  (macOS: brew install python@3.12)"); fi
command -v blender >/dev/null && echo "blender ok (optional)" || echo "blender not found (optional: only needed to rebuild the android or props)"

if [ "${#missing[@]}" -gt 0 ]; then
  echo; echo "MISSING (install these, then re-run):"; for m in "${missing[@]}"; do echo "  - $m"; done
  exit 1
fi

if [ "$CHECK" = 1 ]; then
  say "Project $TARGET"
  for p in engine/web/index.html engine/node_modules/three engine/node_modules/playwright .venv/bin/python engine/models/kokoro-v1.0.onnx engine/models/voices-v1.0.bin docs/STYLE_SPEC.md; do
    [ -e "$TARGET/$p" ] && echo "  ok       $p" || echo "  MISSING  $p"
  done
  exit 0
fi

# ---------------------------------------------------------------- files
say "Copying the HOLO engine into $TARGET"
rsync -a --exclude node_modules --exclude models "$PLUGIN/template/engine/" "$TARGET/engine/"
rsync -a "$PLUGIN/template/tools/" "$TARGET/tools/"
rsync -a --exclude TOPIC_BACKLOG.md --exclude EPISODE_LOG.md "$PLUGIN/template/docs/" "$TARGET/docs/"
rsync -a --ignore-existing "$PLUGIN/template/docs/" "$TARGET/docs/"   # the backlog and episode log grow per project: never overwrite
rsync -a --ignore-existing "$PLUGIN/template/films/" "$TARGET/films/"
[ -e "$TARGET/CLAUDE.md" ] || cp "$PLUGIN/template/CLAUDE.md" "$TARGET/CLAUDE.md"
mkdir -p "$TARGET/renders/phone" "$TARGET/analysis"

# ---------------------------------------------------------------- node deps
say "Installing three.js + Playwright (npm) and headless Chromium"
( cd "$TARGET/engine" && npm ci --no-audit --no-fund && npx playwright install chromium )

# ---------------------------------------------------------------- python deps
say "Creating .venv (Kokoro TTS, Whisper, numpy, Pillow)"
[ -x "$TARGET/.venv/bin/python" ] || "$PY" -m venv "$TARGET/.venv"
VPY="$TARGET/.venv/bin/python"
"$VPY" -m pip install -q --upgrade pip
"$VPY" -m pip install -q numpy soundfile pillow kokoro-onnx
if [ "$(uname -s)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ]; then
  "$VPY" -m pip install -q mlx-whisper
else
  echo "(not Apple Silicon: using faster-whisper for word timing; untested on this platform)"
  "$VPY" -m pip install -q faster-whisper
fi

# ---------------------------------------------------------------- voice model
say "Downloading the Kokoro voice model (~340 MB, once)"
mkdir -p "$TARGET/engine/models"
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  if [ -s "$TARGET/engine/models/$f" ]; then echo "  have $f"; else curl -fL --progress-bar -o "$TARGET/engine/models/$f.part" "$KOKORO_URL/$f" && mv "$TARGET/engine/models/$f.part" "$TARGET/engine/models/$f"; fi
done

# ---------------------------------------------------------------- smoke test
say "Smoke test: one TTS line and one rendered still"
TMP="$TARGET/analysis/_setup_check"; mkdir -p "$TMP"
echo '[{"id":"t","text":"Setup check.","voice":"am_michael","speed":1.06}]' > "$TMP/l.json"
"$VPY" "$TARGET/engine/tools/tts.py" "$TMP/l.json" "$TMP" >/dev/null && echo "  voice ok ($TMP/t.wav)"
( cd "$TARGET" && node engine/tools/render.mjs --film films/ep002_doorways/film.js --stills 5 --outdir analysis/_setup_check --size 640x360 >/dev/null ) && echo "  render ok ($TMP/t005.00.png)"

say "Done. Open Claude Code in $TARGET and ask for an episode (or /holo <topic>)."
