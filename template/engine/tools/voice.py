"""Narration builder for HOLO episodes.

usage:  .venv/bin/python engine/tools/voice.py films/<ep>/script.json films/<ep>/audio
script.json = {"voice": "am_michael", "speed": 1.12, "lines": [{"id": "l01", "text": "...", "pause": 0.18}, ...]}
  pause = silence AFTER the line (s). Reference measurements: 164-176 wpm, ~6-8 words per sentence,
  typical sentence gap 0.10-0.25 s, 5-17 "beat" pauses of ~0.45 s per minute-long video.

writes  audio/voice_raw/<id>.wav, audio/voice.wav (48 kHz mono, processed), audio/lines.json (line start/end),
        audio/words.json ([{"w","t0","t1","line"}], absolute times, from Whisper word alignment)
Voice: an off-the-shelf Kokoro synthetic voice — deliberately NOT a clone of the reference narrator.
"""
import sys, os, json, subprocess, re
import numpy as np, soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASR_PY = os.environ.get('HOLO_PY', os.path.join(ROOT, '.venv', 'bin', 'python'))
TTS = os.path.join(ROOT, 'engine', 'tools', 'tts.py')

script_path, out = sys.argv[1], sys.argv[2]
S = json.load(open(script_path))
os.makedirs(os.path.join(out, 'voice_raw'), exist_ok=True)
voice, speed = S.get('voice', 'am_michael'), S.get('speed', 1.12)

lines = [{'id': L['id'], 'text': L['text'], 'voice': L.get('voice', voice), 'speed': L.get('speed', speed)} for L in S['lines']]
lj = os.path.join(out, 'tts_lines.json')
json.dump(lines, open(lj, 'w'))
subprocess.run([ASR_PY, TTS, lj, os.path.join(out, 'voice_raw')], check=True)

SR = 48000
lead = S.get('lead', 0.08)
buf = [np.zeros(int(lead * SR))]
t = lead
meta = []
for L in S['lines']:
    a, sr = sf.read(os.path.join(out, 'voice_raw', L['id'] + '.wav'))
    if sr != SR:
        n = int(len(a) * SR / sr)
        a = np.interp(np.linspace(0, len(a) - 1, n), np.arange(len(a)), a)
    meta.append({'id': L['id'], 'text': L['text'], 't0': round(t, 3), 't1': round(t + len(a) / SR, 3)})
    buf.append(a)
    t += len(a) / SR
    p = L.get('pause', 0.16)
    buf.append(np.zeros(int(p * SR)))
    t += p
buf.append(np.zeros(int(S.get('tail', 1.2) * SR)))
raw = np.concatenate(buf).astype(np.float32)
sf.write(os.path.join(out, 'voice_dry.wav'), raw, SR)
json.dump(meta, open(os.path.join(out, 'lines.json'), 'w'), indent=1)

# processing: rumble cut, proximity warmth, presence, gentle compression, tiny room — close-mic documentary read
af = ('highpass=f=65,equalizer=f=115:t=q:w=1.1:g=3.5,equalizer=f=3200:t=q:w=1.4:g=2.0,equalizer=f=7500:t=q:w=1.5:g=-2.5,'
      'acompressor=threshold=-21dB:ratio=3.2:attack=6:release=90:makeup=3,aecho=0.85:0.5:23|41:0.07|0.04,alimiter=limit=0.89')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(out, 'voice_dry.wav'), '-af', af, '-ar', str(SR), '-ac', '1', os.path.join(out, 'voice.wav')], check=True)

# word timing: Whisper per line (no cross-silence hallucination), aligned onto the SCRIPT words,
# gaps interpolated inside each line's known bounds -> every script word gets t0/t1.
code = r"""
import sys, json
jobs = json.load(open(sys.argv[1])); out = {}
try:
    import mlx_whisper
    def tr(j):
        r = mlx_whisper.transcribe(j['wav'], path_or_hf_repo="mlx-community/whisper-large-v3-turbo", word_timestamps=True, language="en", initial_prompt=j['text'])
        return [[w["word"].strip(), w["start"], w["end"]] for s in r["segments"] for w in s.get("words", [])]
except ImportError:
    from faster_whisper import WhisperModel
    M = WhisperModel("small.en", device="cpu", compute_type="int8")
    def tr(j):
        segs, _ = M.transcribe(j['wav'], word_timestamps=True, language="en", initial_prompt=j['text'])
        return [[w.word.strip(), w.start, w.end] for s in segs for w in (s.words or [])]
for j in jobs:
    out[j['id']] = tr(j)
json.dump(out, open(sys.argv[2], "w"))
"""
jobs = [{'id': L['id'], 'text': L['text'], 'wav': os.path.join(out, 'voice_raw', L['id'] + '.wav')} for L in S['lines']]
jf, wj = os.path.join(out, 'asr_jobs.json'), os.path.join(out, 'words_asr.json')
json.dump(jobs, open(jf, 'w'))
subprocess.run([ASR_PY, '-c', code, jf, wj], check=True)
asr = json.load(open(wj))
import difflib
key = lambda w: re.sub(r'[^a-z0-9]', '', w.lower())
words = []
for m in meta:
    sw = m['text'].split()
    aw = asr.get(m['id'], [])
    t0s = [None] * len(sw); t1s = [None] * len(sw)
    sm = difflib.SequenceMatcher(a=[key(x) for x in sw], b=[key(x[0]) for x in aw], autojunk=False)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            t0s[blk.a + k] = m['t0'] + aw[blk.b + k][1]; t1s[blk.a + k] = m['t0'] + aw[blk.b + k][2]
    # interpolate unmatched words by character length inside known neighbours
    known = [i for i in range(len(sw)) if t0s[i] is not None]
    for i in range(len(sw)):
        if t0s[i] is None:
            lo = max([k for k in known if k < i], default=None); hi = min([k for k in known if k > i], default=None)
            a0 = t1s[lo] if lo is not None else m['t0']; b0 = t0s[hi] if hi is not None else m['t1']
            span = list(range((lo + 1) if lo is not None else 0, hi if hi is not None else len(sw)))
            tot = sum(len(sw[k]) for k in span) or 1; acc = sum(len(sw[k]) for k in span if k < i)
            t0s[i] = a0 + (b0 - a0) * acc / tot; t1s[i] = a0 + (b0 - a0) * (acc + len(sw[i])) / tot
    for i, w in enumerate(sw):
        words.append({'w': w, 'key': key(w), 't0': round(t0s[i], 3), 't1': round(t1s[i], 3), 'line': m['id']})
json.dump(words, open(os.path.join(out, 'words.json'), 'w'), indent=0)
total = len(raw) / SR
nw = sum(len(L['text'].split()) for L in S['lines'])
speech = meta[-1]['t1'] - meta[0]['t0']
print(f'voice.wav {total:.2f}s  words {nw}  wpm {nw / speech * 60:.0f}  lines {len(meta)}  asr words {len(words)}')
