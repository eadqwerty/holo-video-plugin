"""Side-by-side + measured comparison of a reference frame and a generated frame.

usage: compare.py out.jpg  REF.png:label  OURS.png:label  [REF2 OURS2 ...]   (pairs)
Each pair becomes one row: [ref | ours | 6x crop ref | 6x crop ours], plus printed metrics.
Crops are taken from the most textured mid-tone region of each image.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw

W, H = 1024, 576


def load(p):
    return Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS)


def metrics(im):
    a = np.asarray(im, dtype=float)
    L = a @ [0.299, 0.587, 0.114]
    p = np.percentile(L, [2, 25, 50, 75, 98])
    # glyph pitch via FFT on the most mid-tone 160px window
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
        fr = np.arange(len(sp)) / 160
        sp[:6] = 0
        k = np.argmax(sp)
        return 1 / fr[k]
    lap = np.abs(L[1:-1, 1:-1] * 4 - L[:-2, 1:-1] - L[2:, 1:-1] - L[1:-1, :-2] - L[1:-1, 2:]).mean()
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = (r - np.maximum(g, b)) > 60
    red = a[m].mean(0) if m.sum() > 50 else np.array([0, 0, 0])
    mid = ((L > 30) & (L < 225)).mean()
    return dict(p=p, xper=per(1), yper=per(0), lap=lap, red=red, redfrac=m.mean(), mid=mid, box=box)


def crop(im, box):
    x, y = box
    return im.crop((x + 20, y + 20, x + 120, y + 80)).resize((600, 360), Image.NEAREST)


args = sys.argv[2:]
rows = []
for i in range(0, len(args), 2):
    rp, rl = (args[i].split(':') + ['ref'])[:2]
    op, ol = (args[i + 1].split(':') + ['ours'])[:2]
    R, O = load(rp), load(op)
    mr, mo = metrics(R), metrics(O)
    print(f'--- {rl}  vs  {ol}')
    for k, fmt in (('p', 'lum p2/25/50/75/98'), ('xper', 'glyph x-pitch px'), ('yper', 'glyph y-pitch px'), ('lap', 'sharpness (lap)'), ('mid', 'mid-tone fraction'), ('redfrac', 'red pixel fraction'), ('red', 'mean red rgb')):
        a, b = mr[k], mo[k]
        f = lambda v: np.array2string(np.round(v, 1)) if isinstance(v, np.ndarray) else f'{v:.3f}'
        print(f'   {fmt:22s} ref {f(a):28s} ours {f(b)}')
    row = Image.new('RGB', (W * 2 + 1200, H), (30, 30, 30))
    row.paste(R, (0, 0)); row.paste(O, (W, 0))
    row.paste(crop(R, mr['box']), (W * 2, 0)); row.paste(crop(O, mo['box']), (W * 2 + 600, 0))
    d = ImageDraw.Draw(row)
    d.rectangle([0, 0, 260, 18], fill=(0, 0, 0)); d.text((4, 3), 'REF ' + rl, fill=(255, 255, 0))
    d.rectangle([W, 0, W + 260, 18], fill=(0, 0, 0)); d.text((W + 4, 3), 'OURS ' + ol, fill=(0, 255, 255))
    d.text((W * 2 + 4, 365), 'ref texture 6x', fill=(255, 255, 0)); d.text((W * 2 + 604, 365), 'ours texture 6x', fill=(0, 255, 255))
    rows.append(row)
sheet = Image.new('RGB', (rows[0].width, sum(r.height for r in rows)))
y = 0
for r in rows:
    sheet.paste(r, (0, y)); y += r.height
sheet.save(sys.argv[1], quality=90)
print('wrote', sys.argv[1], sheet.size)
