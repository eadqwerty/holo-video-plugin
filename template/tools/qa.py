"""Spec check for HOLO frames (no reference footage needed).

usage: .venv/bin/python tools/qa.py frame1.png [frame2.png ...]
Use stills rendered at --size 1024x576 (16:9) or 540x960 / 576x1024 (9:16); the glyph cell scales with the short side.
Measures each frame with its short side at 576 px (1024x576 or 576x1024) and compares with docs/STYLE_SPEC.md targets:
  paper (white-scene background luminance) 236-243 (spec 238-241)
  glyph pitch ~3.2 px across x ~5.3 px down (6x10 px cells @1080p)
  red accents ~ (185, 83, 92) on white
Prints one line per frame with OK / CHECK flags. CHECK means "look at it", not "broken".
"""
import sys
import numpy as np
from PIL import Image

W, H = 1024, 576   # set per frame (portrait frames use 576x1024)


def pitch(L):
    H, W = L.shape
    best, box = -1, (0, 0)
    for y in range(0, H - 160, 40):
        for x in range(0, W - 160, 40):
            w = L[y:y + 160, x:x + 160]
            s = ((w > 40) & (w < 215)).mean() * w.std()
            if s > best:
                best, box = s, (x, y)
    x, y = box
    w = L[y:y + 160, x:x + 160]

    def per(axis):
        pp = w - w.mean(axis=axis, keepdims=True)
        sp = np.abs(np.fft.rfft(pp, axis=axis)).mean(axis=1 - axis)
        lo, hi = 20, 65                       # glyph periods 2.5-8 px only (ignore grid lines / props)
        return 160 / (lo + int(np.argmax(sp[lo:hi])))
    return per(1), per(0)


def check(path):
    im = Image.open(path).convert('RGB')
    size = (576, 1024) if im.height > im.width else (1024, 576)
    a = np.asarray(im.resize(size, Image.LANCZOS), dtype=float)
    L = a @ [0.299, 0.587, 0.114]
    white = (L > 200).mean() > 0.35
    out, flags = [], []
    if white:
        paper = float(np.median(L[L > 200]))
        out.append(f'paper {paper:5.1f}')
        flags.append('OK' if 236 <= paper <= 243 else 'CHECK paper')
    else:
        out.append(f'dark scene (median {np.median(L):.0f})')
    px, py = pitch(L)
    out.append(f'pitch {px:.2f}x{py:.2f}')
    flags.append('OK' if 2.8 <= px <= 3.7 and 4.7 <= py <= 6.0 else 'CHECK pitch')
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = (r - np.maximum(g, b)) > 60
    if m.sum() > 50:
        red = a[m].mean(0)
        out.append('red (%d,%d,%d)' % tuple(red))
        if white:
            d = np.abs(red - [185, 83, 92]).max()
            flags.append('OK' if d < 45 else 'CHECK red')
    bad = [f for f in flags if f != 'OK']
    print(f'{path}: ' + '  '.join(out) + '  ->  ' + (', '.join(bad) if bad else 'OK'))
    return not bad


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    res = [check(p) for p in sys.argv[1:]]
    print(f'{sum(res)}/{len(res)} frames within spec ranges')
