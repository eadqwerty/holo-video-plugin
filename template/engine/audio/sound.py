"""HOLO sound design: procedural score + SFX from the film's cue list, mixed under the narration.

usage: python engine/audio/sound.py cues.json out_mix.wav [--voice voice.wav] [--seed 7] [--key D]
cues.json (from `render.mjs --cues`): {"duration", "cuts":[{"t","kind","toWhite"}], "glitches":[{"t","d","a"}],
                                       "texts":[{"t0","t1","str"}], "hud":[t...], "logo":[t...]}

Measured reference profile (STYLE_SPEC §7): speech -17 dBFS, bed only 3-6 dB below speech in gaps, bed energy
dominated by sub (<80 Hz) + a sustained high pad (steady partials ~600/750/1000/1500/2400 Hz), broadband digital
clicks on cuts/text, low booms on major transitions. No melody, no drums.
"""
import sys, json, subprocess, os
import numpy as np

SR = 48000


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


cues = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
VOICE = arg('--voice')
R = np.random.default_rng(int(arg('--seed', 7)))
KEY = {'C': 65.41, 'D': 73.42, 'E': 82.41, 'F': 87.31, 'G': 98.0, 'A': 55.0}[arg('--key', 'D')]
dur = cues['duration'] + 0.5
N = int(dur * SR)
t = np.arange(N) / SR


def env_adsr(n, a, d, s, r_):
    e = np.ones(n)
    na, nd, nr = int(a * SR), int(d * SR), int(r_ * SR)
    e[:na] = np.linspace(0, 1, max(1, na))[:len(e[:na])]
    e[na:na + nd] = np.linspace(1, s, max(1, nd))[:len(e[na:na + nd])]
    e[na + nd:] = s
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); z = 0.0
    for i in range(len(x)):  # small buffers only
        z = (1 - a) * x[i] + a * z; y[i] = z
    return y


def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo: m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi: m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))


def place(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf) or i + len(x) <= 0: return
    j0 = max(0, -i); i = max(0, i)
    n = min(len(x) - j0, len(buf) - i)
    buf[i:i + n] += x[j0:j0 + n] * gain


# ---------------------------------------------------------------- bed: drone + pad + high partials
bed = np.zeros(N)
# sub drone (root an octave down) with slow breathing
lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.07 * t)
bed += 0.09 * np.sin(2 * np.pi * KEY / 2 * t) * lfo
bed += 0.05 * np.sin(2 * np.pi * KEY * t + 0.3 * np.sin(2 * np.pi * 0.11 * t))
# dark minor pad: root, fifth, octave, minor third — detuned sines, filtered noise breath
for ratio, g in ((1, 0.04), (1.5, 0.035), (2, 0.035), (2.378, 0.03), (3, 0.025)):
    for det in (-0.12, 0.0, 0.13):
        bed += g * np.sin(2 * np.pi * (KEY * ratio + det) * t + R.uniform(0, 6.28)) * (0.6 + 0.4 * np.sin(2 * np.pi * R.uniform(0.03, 0.09) * t + R.uniform(0, 6)))
# the steady high partials heard in every reference (glassy, very quiet)
for f0, g in ((KEY * 8, 0.050), (KEY * 10, 0.040), (KEY * 13.6, 0.030), (KEY * 20, 0.026), (KEY * 32, 0.016)):
    bed += g * np.sin(2 * np.pi * f0 * t + R.uniform(0, 6.28)) * (0.5 + 0.5 * np.sin(2 * np.pi * R.uniform(0.05, 0.2) * t))
air = fft_filter(R.standard_normal(N), lo=2500, hi=9000) * 0.012 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.05 * t))
bed += air
fade = np.minimum(1, t / 1.2) * np.minimum(1, (dur - t) / 1.5)
# refs: lows between words are nearly silent -> sub energy comes from voice + booms only
bed = fft_filter(bed, lo=110)
bed *= fade

# ---------------------------------------------------------------- sfx
sfx = np.zeros(N)


def boom(at, g=1.0):
    n = int(1.6 * SR); tt = np.arange(n) / SR
    f = 52 * np.exp(-tt * 3.5) + 34
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.6)
    x += 0.25 * fft_filter(R.standard_normal(n), hi=300) * np.exp(-tt * 9)
    place(sfx, x, at, 0.65 * g)


def click(at, g=1.0, length=0.05):
    n = int(length * SR)
    x = R.standard_normal(n)
    x = np.round(x * 3) / 3                       # bit-crush
    hold = int(R.integers(3, 12)); x = np.repeat(x[::hold], hold)[:n]  # sample-rate reduction
    x *= np.exp(-np.arange(n) / (n * 0.35))
    x = fft_filter(x, lo=900)
    place(sfx, x, at, 0.18 * g)


def chirp(at, g=1.0):  # data chirp for titles: a few rapid clicks + tone blips
    for k in range(int(R.integers(3, 6))):
        click(at + k * R.uniform(0.012, 0.03), g * R.uniform(0.4, 1.0), length=R.uniform(0.01, 0.03))
    n = int(0.07 * SR); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * R.choice([1800, 2400, 3100]) * tt) * np.exp(-tt * 45)
    place(sfx, x, at, 0.05 * g)


def whoosh(at, length=0.45, g=1.0, rise=True):
    n = int(length * SR); tt = np.linspace(0, 1, n)
    x = R.standard_normal(n)
    # sweeping band via cascaded fft filter blocks
    out = np.zeros(n); blk = 2048
    for i in range(0, n, blk):
        u = tt[min(i, n - 1)] if rise else 1 - tt[min(i, n - 1)]
        seg = x[i:i + blk]
        out[i:i + blk] = fft_filter(np.pad(seg, (0, blk - len(seg))), lo=300 + 3500 * u, hi=900 + 7000 * u)[:len(seg)]
    e = (tt ** 2.2 if rise else (1 - tt) ** 1.5)
    place(sfx, out * e, at - (length if rise else 0), 0.35 * g)


def tick(at, g=1.0):
    n = int(0.012 * SR); x = R.standard_normal(n) * np.exp(-np.arange(n) / 90)
    place(sfx, fft_filter(x, lo=3000), at, 0.06 * g)


for c in cues.get('cuts', []):
    k = c.get('kind', 'smear')
    if k == 'smear':
        whoosh(c['t'], 0.35, 0.8); boom(c['t'], 1.0); click(c['t'] - 0.05, 1.2, 0.08)
    elif k == 'zoom':
        whoosh(c['t'], 0.4, 1.0); boom(c['t'], 0.55)
    elif k == 'whip':
        whoosh(c['t'], 0.18, 1.2); whoosh(c['t'], 0.2, 0.6, rise=False); click(c['t'], 0.7)
    elif k == 'glitch':
        for j in range(4): click(c['t'] + j * 0.025, 1.0, 0.03)
    else:
        click(c['t'], 0.6)
for gch in cues.get('glitches', []):
    for j in range(int(max(2, gch['d'] * 40))): click(gch['t'] + j * 0.022, gch['a'], 0.025)
for tx in cues.get('texts', []):
    chirp(tx['t0'] - 0.03, 0.8)
for h in cues.get('hud', []):
    for j in range(5): tick(h + j * 0.05, 0.8)
for lg in cues.get('logo', []):
    click(lg, 0.7, 0.04)

# ---------------------------------------------------------------- mix
def db(x): return 10 ** (x / 20)


stem_bed = os.path.splitext(OUT)[0] + '_music.wav'
stem_sfx = os.path.splitext(OUT)[0] + '_sfx.wav'
import wave


def write(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype(np.int16).tobytes())


write(stem_bed, bed / (np.abs(bed).max() + 1e-9) * 0.7)
write(stem_sfx, sfx / (np.abs(sfx).max() + 1e-9) * 0.8)
# bed sits ~4 dB under voice in gaps and ducks ~5 dB under speech; final -14 LUFS, true peak -1
inputs = ['-i', stem_bed, '-i', stem_sfx]
if VOICE:
    inputs = ['-i', VOICE] + inputs
    fc = ('[0:a]aresample=48000,volume=1.0,asplit=2[v][vk];'
          '[1:a]volume=-21dB[m];[m][vk]sidechaincompress=threshold=0.03:ratio=3.5:attack=20:release=350[md];'
          '[2:a]volume=-15dB[s];[v][md][s]amix=inputs=3:normalize=0:duration=longest,'
          'loudnorm=I=-14:TP=-1:LRA=9[out]')
else:
    fc = '[0:a]volume=-12dB[m];[1:a]volume=-9dB[s];[m][s]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1[out]'
subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', fc, '-map', '[out]', '-ar', '48000', '-ac', '2', OUT], check=True)
print('wrote', OUT)
