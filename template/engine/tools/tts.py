"""Kokoro offline TTS for HOLO (kokoro-onnx).

usage:  .venv/bin/python engine/tools/tts.py lines.json out_dir
lines.json = [{"id": "l01", "text": "...", "voice": "am_michael", "speed": 1.06, "lang": "en-us"}, ...]
writes  out_dir/<id>.wav (24 kHz mono, leading/trailing silence trimmed)
Model files: engine/models/kokoro-v1.0.onnx + voices-v1.0.bin (downloaded by the plugin's setup.sh),
or the folder named by $HOLO_KOKORO_DIR.
"""
import sys, os, json
import numpy as np, soundfile as sf

if len(sys.argv) < 3:
    sys.exit(__doc__)
HERE = os.path.dirname(os.path.abspath(__file__))
MD = os.environ.get('HOLO_KOKORO_DIR', os.path.join(HERE, '..', 'models'))
model, voices = os.path.join(MD, 'kokoro-v1.0.onnx'), os.path.join(MD, 'voices-v1.0.bin')
if not (os.path.exists(model) and os.path.exists(voices)):
    sys.exit(f'tts.py: Kokoro model files not found in {MD}. Run the plugin setup (scripts/setup.sh <project>).')
try:
    from kokoro_onnx import Kokoro
except ImportError:
    sys.exit('tts.py: kokoro-onnx is not installed in this Python. Use .venv/bin/python (created by setup.sh).')

lines, out = json.load(open(sys.argv[1], encoding='utf-8')), sys.argv[2]
os.makedirs(out, exist_ok=True)
k = Kokoro(model, voices)
for L in lines:
    a, sr = k.create(L['text'], voice=L.get('voice', 'am_michael'), speed=L.get('speed', 1.06), lang=L.get('lang', 'en-us'))
    peak = np.abs(a).max() if len(a) else 0
    nz = np.where(np.abs(a) > peak * 0.02)[0]
    if len(nz):
        a = a[max(0, nz[0] - int(0.03 * sr)): nz[-1] + int(0.08 * sr)]
    sf.write(os.path.join(out, L['id'] + '.wav'), a, sr)
    print(L['id'], round(len(a) / sr, 3), L['text'])
