"""MakeHuman hm08 base mesh (CC0) -> shaped, scaled body + joint centres in Blender space.

Assets: engine/assets/third_party/makehuman/ (base.obj + macrodetail targets, all CC0 1.0; see NOTICE.md there).
The macro mix follows MakeHuman's own scheme: race targets carry the gender shape, the
'universal' targets carry muscle/weight, and 'idealproportions' lengthens limbs.

Space conversion: MakeHuman is Y-up, faces +Z, character's left is +X, units of decimetres.
Blender (and the Rigify metarig): Z-up, faces -Y, left is +X. So p_b = (x, -z, y - y_floor) * s.
"""
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
MH = os.path.join(HERE, '..', 'assets', 'third_party', 'makehuman')


def _read_obj(path):
    V, faces, groups = [], [], defaultdict(set)
    cur = None
    with open(path) as fh:
        for l in fh:
            if l.startswith('v '):
                V.append([float(x) for x in l.split()[1:4]])
            elif l.startswith('g '):
                cur = l.split()[1]
            elif l.startswith('f '):
                ids = [int(x.split('/')[0]) - 1 for x in l.split()[1:]]
                faces.append((cur, ids))
                groups[cur].update(ids)
    return V, faces, groups


def _apply_target(V, name, w):
    if abs(w) < 1e-6:
        return
    with open(os.path.join(MH, 'targets', name + '.target')) as fh:
        for l in fh:
            if not l.strip() or l.startswith('#'):
                continue
            i, dx, dy, dz = l.split()
            v = V[int(i)]
            v[0] += float(dx) * w; v[1] += float(dy) * w; v[2] += float(dz) * w


def build(muscle=0.72, weight=0.38, proportions=1.0, height=1.98, keep=('body', 'helper-l-eye', 'helper-r-eye'), face_smooth=0):
    """muscle/weight in MakeHuman's 0..1 macro range (0.5 = average). Returns (verts, faces, joints, face_groups)."""
    V, faces, groups = _read_obj(os.path.join(MH, 'base.obj'))
    # muscle / weight interpolation weights (MakeHuman: average at 0.5, extreme at 0 / 1)
    mw = {'averagemuscle': 1 - abs(muscle - 0.5) * 2, ('maxmuscle' if muscle > 0.5 else 'minmuscle'): abs(muscle - 0.5) * 2}
    ww = {'averageweight': 1 - abs(weight - 0.5) * 2, ('maxweight' if weight > 0.5 else 'minweight'): abs(weight - 0.5) * 2}
    for race in ('african', 'asian', 'caucasian'):      # neutral 1/3 mix; male, young (25)
        _apply_target(V, '%s-male-young' % race, 1 / 3)
    for m, a in mw.items():
        for w, b in ww.items():
            _apply_target(V, 'universal-male-young-%s-%s' % (m, w), a * b)
            _apply_target(V, 'male-young-%s-%s-idealproportions' % (m, w), a * b * proportions)
    # joint centres = mean of each joint helper's vertices (after shaping)
    joints = {}
    for g, ids in groups.items():
        if g.startswith('joint-'):
            n = len(ids)
            joints[g[6:]] = [sum(V[i][k] for i in ids) / n for k in range(3)]
    keep_ids = set()
    kfaces, fgroups = [], []
    for g, ids in faces:
        if g in keep:
            kfaces.append(ids)
            fgroups.append(g)
            keep_ids.update(ids)
    y0 = min(V[i][1] for i in keep_ids)
    y1 = max(V[i][1] for i in groups['body'])
    s = height / (y1 - y0)
    conv = lambda p: (p[0] * s, -p[2] * s, (p[1] - y0) * s)
    remap = {}
    verts = []
    for i in sorted(keep_ids):
        remap[i] = len(verts)
        verts.append(conv(V[i]))
    kfaces = [[remap[i] for i in f] for f in kfaces]
    joints = {k: conv(p) for k, p in joints.items()}
    if face_smooth:
        verts = _calm_face(verts, kfaces, fgroups, joints, face_smooth)
    return verts, kfaces, joints, fgroups


def _smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def _calm_face(verts, faces, fgroups, J, iters):
    """Weighted Laplacian smoothing of the face only: softens the mouth line, nasolabial folds and
    brow so the face reads as a calm sculpted mannequin mask (ref4) instead of a specific person."""
    nb = defaultdict(set)
    for f, g in zip(faces, fgroups):
        if g != 'body':
            continue
        for i in range(len(f)):
            a, b = f[i], f[(i + 1) % len(f)]
            nb[a].add(b); nb[b].add(a)
    eye, chin, hy = J['l-eye'], J['jaw'][2], J['head'][1]
    W = {}
    for i in nb:
        x, y, z = verts[i]
        w = _smoothstep(chin - 0.035, chin + 0.01, z) * (1 - _smoothstep(eye[2] + 0.015, eye[2] + 0.045, z))
        w *= 1 - _smoothstep(hy - 0.03, hy + 0.0, y)          # front of the head only
        w *= 1 - _smoothstep(0.055, 0.075, abs(x))            # not the ears
        if w > 1e-3:
            W[i] = w * 0.5
    V = [list(v) for v in verts]
    for _ in range(iters):
        new = {}
        for i, w in W.items():
            n = nb[i]
            avg = [sum(V[j][k] for j in n) / len(n) for k in range(3)]
            new[i] = [V[i][k] + (avg[k] - V[i][k]) * w for k in range(3)]
        for i, v in new.items():
            V[i] = v
    return [tuple(v) for v in V]


# Rigify metarig bone -> (head joint, tail joint); 'mid:a:b' = midpoint
RIG_MAP = {
    'spine': ('pelvis', 'spine-3'), 'spine.001': ('spine-3', 'spine-2'), 'spine.002': ('spine-2', 'spine-1'),
    'spine.003': ('spine-1', 'neck'), 'spine.004': ('neck', 'mid:neck:head'), 'spine.005': ('mid:neck:head', 'head'),
    'spine.006': ('head', 'head-2'),
}
for _s in ('l', 'r'):
    S = _s.upper()
    RIG_MAP.update({
        'shoulder.' + S: (_s + '-clavicle', _s + '-shoulder'), 'upper_arm.' + S: (_s + '-shoulder', _s + '-elbow'),
        'forearm.' + S: (_s + '-elbow', _s + '-hand'), 'hand.' + S: (_s + '-hand', _s + '-finger-3-1'),
        'thigh.' + S: (_s + '-upper-leg', _s + '-knee'), 'shin.' + S: (_s + '-knee', _s + '-ankle'),
        'foot.' + S: (_s + '-ankle', _s + '-foot-1'), 'toe.' + S: (_s + '-foot-1', _s + '-foot-2'),
    })
    for k, f in enumerate(('thumb', 'f_index', 'f_middle', 'f_ring', 'f_pinky')):
        for j in range(3):
            RIG_MAP['%s.0%d.%s' % (f, j + 1, S)] = ('%s-finger-%d-%d' % (_s, k + 1, j + 1), '%s-finger-%d-%d' % (_s, k + 1, j + 2))
        if k:
            RIG_MAP['palm.0%d.%s' % (k, S)] = ('palm:%s:%d' % (_s, k + 1), '%s-finger-%d-1' % (_s, k + 1))


def joint(J, key):
    if key.startswith('mid:'):
        _, a, b = key.split(':')
        return tuple((J[a][i] + J[b][i]) / 2 for i in range(3))
    if key.startswith('palm:'):   # palm bone root: 25% of the way from the wrist to the knuckle
        _, s, k = key.split(':')
        w, kn = J[s + '-hand'], J['%s-finger-%s-1' % (s, k)]
        return tuple(w[i] + (kn[i] - w[i]) * 0.25 for i in range(3))
    return tuple(J[key])
