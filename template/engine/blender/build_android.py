"""Procedural armoured android for the HOLO style.

Run:  blender -b --python engine/blender/build_android.py -- <out.glb> [preview_dir]

Pipeline
 1. Rigify human metarig (A-pose, 2 m) -> prune to body + hand deform bones.
 2. Anatomy = blended metaballs (capsules/ellipsoids per muscle mass) -> mesh -> voxel remesh -> smooth.
 3. Armour = shells cut from the body surface by region rules, pushed outward + solidified, so the
    seams between plates read as dark panel lines (as in the references).
 4. Red accents (chest block, shoulder caps, joint dots, visor dot) as small separate meshes.
 5. Body gets automatic weights; every other piece copies weights from the body (data transfer).
 6. Export skinned GLB. Material NAMES carry the role: SUIT / PLATE / RED / VISOR.
"""
import bpy, bmesh, sys, os, math, addon_utils
from mathutils import Vector, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/android.glb'
VARIANT = os.environ.get('HOLO_VARIANT', 'armoured')   # 'armoured' (default, production) | 'slim' (EXPERIMENTAL, not production quality: metaball anatomy reads toy-like)
SLIM = VARIANT == 'slim'
RS = [0.93 if SLIM else 1.0]   # radius scale for body/limb masses (head features unaffected)
PREV = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable('rigify', default_set=True)

# ---------------------------------------------------------------- skeleton
bpy.ops.object.armature_human_metarig_add()
arm = bpy.context.object
arm.name = 'Android'
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones
KEEP_PREFIX = ('spine', 'shoulder', 'upper_arm', 'forearm', 'hand', 'palm', 'f_', 'thumb', 'thigh', 'shin', 'foot', 'toe')
for b in list(eb):
    if not b.name.startswith(KEEP_PREFIX):
        eb.remove(b)
for b in eb:
    b.use_deform = True
B = {b.name: (b.head.copy(), b.tail.copy()) for b in eb}
bpy.ops.object.mode_set(mode='OBJECT')


def mirror(v):
    return Vector((-v.x, v.y, v.z))


def side(fn):
    """call fn(sign, name_suffix) for left (+x) and right (-x)."""
    fn(1, 'L')
    fn(-1, 'R')


def metaball_body():
    global mbdata, TS
    # ---------------------------------------------------------------- anatomy (metaballs)
    mbdata = bpy.data.metaballs.new('Anatomy')
    mbdata.resolution = 0.0045 if os.environ.get('HOLO_VARIANT') == 'slim' else 0.006
    mbdata.render_resolution = mbdata.resolution
    mbdata.threshold = 0.6
    mbobj = bpy.data.objects.new('Anatomy', mbdata)
    bpy.context.collection.objects.link(mbobj)


    def quat_x_to(d):
        return Vector((1, 0, 0)).rotation_difference(d.normalized())


    def capsule(a, b, r, stiff=2.0):
        a, b = Vector(a), Vector(b)
        el = mbdata.elements.new(type='CAPSULE')
        el.co = (a + b) / 2
        el.radius = r * RS[0]
        el.size_x = max((b - a).length / 2, 1e-4)
        el.rotation = quat_x_to(b - a)
        el.stiffness = stiff
        return el


    def ellip(c, r, sx, sy, sz, stiff=2.0, rot=None):
        el = mbdata.elements.new(type='ELLIPSOID')
        el.co = Vector(c)
        el.radius = r * RS[0]
        el.size_x, el.size_y, el.size_z = sx, sy, sz
        el.stiffness = stiff
        if rot is not None:
            el.rotation = rot
        return el


    def lerp(a, b, t):
        return Vector(a).lerp(Vector(b), t)


    def side(fn):
        """call fn(sign, name_suffix) for left (+x) and right (-x)."""
        fn(1, 'L')
        fn(-1, 'R')


    def P(x, y, z, s=1):
        return Vector((x * s, y, z))


    # torso
    TS = 1.1 if SLIM else 2.0   # lower stiffness = smoother blending into one torso form (slim variant)
    ellip((0, 0.025, 1.02), 0.17, 1.15, 0.80, 0.70, stiff=TS)           # pelvis
    ellip((0, 0.015, 1.17), 0.15 * (1.12 if SLIM else 1), 0.95, 0.72, 0.95, stiff=TS)           # abdomen
    ellip((0, 0.005, 1.31), 0.16 * (1.08 if SLIM else 1), 1.00, 0.74, 0.90, stiff=TS)           # lower ribs
    ellip((0, 0.005, 1.45), 0.19, 1.05, 0.72, 0.95, stiff=TS)           # rib cage
    ellip((0, 0.02, 1.57), 0.16, 1.15, 0.66, 0.55, stiff=TS)            # upper chest / clavicle line
    RS[0] = 1.0 if SLIM else RS[0]
    capsule((0, 0.012, 1.63), (0, -0.012, 1.79), 0.072 if SLIM else 0.10)         # neck
    capsule((0, 0.03, 1.62), (0, 0.0, 1.70), 0.11)             # neck base / traps
    ellip((0, -0.015, 1.885 - (0.02 if SLIM else 0)), 0.135 * (1.12 if SLIM else 1), 0.80, 0.92, 1.02)        # cranium
    ellip((0, -0.05, 1.825), 0.09, 0.78, 0.80, 0.85)          # jaw / face mass
    if SLIM:
        # sculpted face (ref4-style human-faced android): brow, cheekbones, nose, lips, chin; eye sockets carved
        ellip((0, -0.098, 1.905), 0.055, 1.45, 0.42, 0.32)                   # brow ridge
        for sx in (1, -1):
            ellip((0.048 * sx, -0.084, 1.858), 0.036, 0.95, 0.5, 0.5)        # cheekbones
        capsule((0, -0.104, 1.884), (0, -0.114, 1.852), 0.013, stiff=3.0)    # nose bridge -> tip
        ellip((0, -0.108, 1.815), 0.032, 1.25, 0.5, 0.36)                    # lips
        ellip((0, -0.095, 1.786), 0.042, 1.0, 0.75, 0.75)                    # chin
        for sx in (1, -1):
            el = mbdata.elements.new(type='BALL'); el.co = Vector((0.036 * sx, -0.112, 1.874)); el.radius = 0.024; el.use_negative = True
    RS[0] = 0.93 if SLIM else 1.0


    def limbs(s, n):
        # chest + back muscles
        ellip(P(0.07, -0.02, 1.49, s), 0.10 * (0.8 if SLIM else 1), 1.2, 0.36, 0.58, stiff=TS)          # pec (flat, armoured)
        ellip(P(0.10, 0.06, 1.44, s), 0.11 * (0.8 if SLIM else 1), 0.80, 0.55, 1.15, stiff=TS)            # lat
        capsule(P(0.03, 0.03, 1.64, s), P(0.17, 0.02, 1.605, s), 0.075)  # trapezius
        ellip(P(0.075, 0.075, 1.0, s), 0.12, 0.85, 0.75, 0.85)           # glute
        # arm
        ua_h, ua_t = B['upper_arm.' + n]
        fa_h, fa_t = B['forearm.' + n]
        ellip(lerp(ua_h, ua_t, 0.08) + Vector((0.0 * s, 0.0, 0.01)), 0.095, 0.95, 0.95, 0.9)   # deltoid
        capsule(lerp(ua_h, ua_t, 0.12), lerp(ua_h, ua_t, 0.92), 0.068)                         # upper arm
        capsule(lerp(ua_h, ua_t, 0.35), lerp(ua_h, ua_t, 0.75), 0.072)                         # bicep/tricep
        capsule(lerp(fa_h, fa_t, 0.02), lerp(fa_h, fa_t, 0.45), 0.064)                         # forearm upper
        capsule(lerp(fa_h, fa_t, 0.45), lerp(fa_h, fa_t, 0.97), 0.048)                         # wrist
        # hand: palm + fingers
        hh, ht = B['hand.' + n]
        for k in ('1', '2', '3', '4'):
            ph, pt = B['palm.0%s.%s' % (k, n)]
            capsule(lerp(ph, pt, -0.2), lerp(ph, pt, 0.9), 0.026)
        for f, r in (('f_index', 0.0145), ('f_middle', 0.015), ('f_ring', 0.0145), ('f_pinky', 0.013), ('thumb', 0.0165)):
            for j in ('01', '02', '03'):
                h, t = B['%s.%s.%s' % (f, j, n)]
                capsule(h, t, r * (1.0 - 0.1 * int(j)), stiff=2.5)
        # leg
        th_h, th_t = B['thigh.' + n]
        sh_h, sh_t = B['shin.' + n]
        capsule(lerp(th_h, th_t, 0.05), lerp(th_h, th_t, 0.45), 0.115)   # upper thigh
        capsule(lerp(th_h, th_t, 0.45), lerp(th_h, th_t, 0.95), 0.088)   # lower thigh
        ellip(lerp(th_h, th_t, 0.98) + Vector((0, -0.02, 0)), 0.07, 0.95, 0.85, 1.0)  # knee
        capsule(lerp(sh_h, sh_t, 0.05), lerp(sh_h, sh_t, 0.5), 0.078)    # calf
        ellip(lerp(sh_h, sh_t, 0.28) + Vector((0, 0.03, 0)), 0.085, 0.85, 0.85, 1.4)  # calf belly
        capsule(lerp(sh_h, sh_t, 0.5), lerp(sh_h, sh_t, 0.97), 0.052)    # ankle
        fh, ft = B['foot.' + n]
        toh, tot = B['toe.' + n]
        capsule(sh_t + Vector((0, 0.035, -0.02)), ft + Vector((0, 0, 0.01)), 0.06)  # heel->ball
        capsule(toh, tot + Vector((0, -0.02, 0)), 0.052)                # toes


    side(limbs)

    bpy.context.view_layer.objects.active = mbobj
    mbobj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    body = bpy.context.object
    body.name = 'Body'

    # voxel remesh + smooth for a clean, even topology
    rm = body.modifiers.new('rm', 'REMESH')
    rm.mode = 'VOXEL'
    rm.voxel_size = 0.0055
    sm = body.modifiers.new('sm', 'CORRECTIVE_SMOOTH')
    sm.iterations = 6
    sm.smooth_type = 'LENGTH_WEIGHTED'
    bpy.ops.object.modifier_apply(modifier='rm')
    bpy.ops.object.modifier_apply(modifier='sm')
    dec = body.modifiers.new('dec', 'DECIMATE')
    dec.ratio = 0.35
    bpy.ops.object.modifier_apply(modifier='dec')
    bpy.ops.object.shade_smooth()
    return body


def mh_body():
    """CC0 MakeHuman body (engine/blender/mh_body.py); the metarig is re-fitted to its joint centres."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mh_body as MHB
    fs = int(os.environ.get('HOLO_FACE_SMOOTH', '60'))
    verts, faces, J, fg = MHB.build(face_smooth=fs, keep=('body',) if fs else ('body', 'helper-l-eye', 'helper-r-eye'))
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones
    for b in eb:
        b.use_connect = False
    for n, (h, t) in MHB.RIG_MAP.items():
        if n in eb:
            eb[n].head = MHB.joint(J, h)
            eb[n].tail = MHB.joint(J, t)
    for b in eb:
        b.roll = 0.0
    B.clear()
    B.update({b.name: (b.head.copy(), b.tail.copy()) for b in eb})
    bpy.ops.object.mode_set(mode='OBJECT')
    me = bpy.data.meshes.new('Body')
    me.from_pydata(verts, [], faces)
    me.validate()
    for p, g in zip(me.polygons, fg):     # eyeballs -> material slot 1 (VISOR); subsurf keeps the index
        p.material_index = 1 if g.endswith('-eye') and os.environ.get('HOLO_EYES', 'dark') == 'dark' else 0
    ob = bpy.data.objects.new('Body', me)
    bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    sub = ob.modifiers.new('sub', 'SUBSURF')
    sub.levels = sub.render_levels = int(os.environ.get('HOLO_SUBD', '1'))
    bpy.ops.object.modifier_apply(modifier='sub')
    bpy.ops.object.shade_smooth()
    LM.update(eye=J['l-eye'][2], head_top=max(v.co.z for v in me.vertices), neck=J['neck'][2], pelvis=J['pelvis'][2],
              chest=J['spine-1'][2], waist=J['spine-2'][2], knee=J['l-knee'][2], ankle=J['l-ankle'][2], head_y=J['head'][1])
    JJ.update(J)
    return ob


# landmarks (z in metres): defaults = the metaball body these plate rules were tuned on
LM = dict(eye=1.877, head_top=1.99, neck=1.658, pelvis=1.01, chest=1.466, waist=1.293, knee=0.537, ankle=0.085, head_y=-0.025)
LM0 = dict(LM)
JJ = {}
BASE = os.environ.get('HOLO_BASE', 'mh')   # 'mh' (CC0 MakeHuman anatomy, default since 2026-11-19) | 'metaball' (v1-v4 android)
body = mh_body() if BASE == 'mh' else metaball_body()


def Zf(z):
    """map a z tuned on the metaball body to the same anatomical place on the current body."""
    keys = sorted(('ground', 'ankle', 'knee', 'pelvis', 'waist', 'chest', 'neck', 'eye', 'head_top'), key=lambda k: LM0.get(k, 0))
    old = [0.0] + [LM0[k] for k in keys if k != 'ground']
    new = [0.0] + [LM[k] for k in keys if k != 'ground']
    for i in range(len(old) - 1):
        if z <= old[i + 1]:
            t = (z - old[i]) / (old[i + 1] - old[i])
            return new[i] + (new[i + 1] - new[i]) * t
    return new[-1] + (z - old[-1])


HY = LM['head_y'] - LM0['head_y']   # head-region y shift


def front(x, z, default=-0.1):
    """y of the body's front surface at (x, z)."""
    ok, loc, n, i = body.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
    return loc.y if ok else default


# ---------------------------------------------------------------- materials (role by name)
def mat(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    return m


M_SUIT = mat('SUIT', (0.06, 0.06, 0.06))
M_PLATE = mat('PLATE', (0.85, 0.85, 0.85))
M_RED = mat('RED', (0.8, 0.03, 0.04))
M_VISOR = mat('VISOR', (0.02, 0.02, 0.02))
body.data.materials.append(M_PLATE if SLIM else M_SUIT)
if BASE == 'mh':
    body.data.materials.append(M_VISOR)

# ---------------------------------------------------------------- armour shells
BW = {n: (h, t) for n, (h, t) in B.items()}


def seg_t(p, h, t):
    d = t - h
    return (p - h).dot(d) / d.length_squared


def seg_dist(p, h, t):
    tt = max(0.0, min(1.0, seg_t(p, h, t)))
    return (p - (h + (t - h) * tt)).length


def shell(name, planes, pred=None, thick=0.010, push=0.006, material=None, parts=None, smooth=0):
    """Plate = body surface clipped by half-spaces (clean, straight panel edges).
    planes: list of (point, normal); geometry on the +normal side is kept.
    parts: optional list of plane-lists whose results are unioned (for L-shaped plates).
    pred(p): optional face-centre filter to drop unwanted islands."""
    groups = parts if parts is not None else [planes]
    bm_out = bmesh.new()
    for pl in groups:
        bm = bmesh.new()
        bm.from_mesh(body.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != 0], context='FACES')   # never plate the eyes
        for co, no in pl:
            geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
            bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector(co), plane_no=Vector(no).normalized(), clear_inner=True)
        bmesh.ops.dissolve_degenerate(bm, dist=0.0008, edges=bm.edges[:])
        if pred:
            bm.faces.ensure_lookup_table()
            kill = [f for f in bm.faces if not pred(f.calc_center_median())]
            bmesh.ops.delete(bm, geom=kill, context='FACES')
        # drop tiny islands (slivers left where a cut grazes the surface)
        bm.faces.ensure_lookup_table()
        seen, isl = set(), []
        for f0 in bm.faces:
            if f0.index in seen:
                continue
            stack, comp = [f0], []
            seen.add(f0.index)
            while stack:
                f = stack.pop(); comp.append(f)
                for e in f.edges:
                    for g in e.link_faces:
                        if g.index not in seen:
                            seen.add(g.index); stack.append(g)
            isl.append(comp)
        if len(isl) > 1:
            big = max(len(c) for c in isl)
            bmesh.ops.delete(bm, geom=[f for c in isl if len(c) < 0.08 * big for f in c], context='FACES')
        loose = [v for v in bm.verts if not v.link_faces]
        bmesh.ops.delete(bm, geom=loose, context='VERTS')
        me = bpy.data.meshes.new('tmp'); bm.to_mesh(me); bm.free()
        bm_out.from_mesh(me)
        bpy.data.meshes.remove(me)
    if smooth:   # soften sculpted detail (e.g. turn a face into a calm mannequin mask); boundary stays put
        inner = [v for v in bm_out.verts if not v.is_boundary]
        for _ in range(smooth):
            bmesh.ops.smooth_vert(bm_out, verts=inner, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm_out.normal_update()
    # push along the nearest body normal (robust even for cut-edge verts)
    for v in bm_out.verts:
        ok, loc, nrm, idx = body.closest_point_on_mesh(v.co)
        v.co += (nrm if ok else v.normal) * push
    # remove spikes: drop faces with any edge much longer than the body's voxel size
    bm_out.edges.ensure_lookup_table()
    bad = [f for f in bm_out.faces if max(e.calc_length() for e in f.edges) > 0.07]
    bmesh.ops.delete(bm_out, geom=bad, context='FACES')
    me = bpy.data.meshes.new(name)
    bm_out.to_mesh(me)
    bm_out.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material or M_PLATE)
    s = ob.modifiers.new('solid', 'SOLIDIFY')
    s.thickness = thick
    s.offset = 1.0
    s.use_rim = True
    s.use_even_offset = False
    s.use_quality_normals = True
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier='solid')
    bpy.ops.object.shade_smooth()
    return ob


UP, DN = (0, 0, 1), (0, 0, -1)
FRONT, BACK = (0, -1, 0), (0, 1, 0)


def zband(z0, z1):
    return [((0, 0, z0), UP), ((0, 0, z1), DN)]


def axial(h, t, t0, t1):
    d = (t - h).normalized()
    return [(h + (t - h) * t0, d), (h + (t - h) * t1, -d)]


pieces = []
if SLIM:
    pieces.append(shell('Helmet', None, thick=0.008, push=0.006, parts=[[((0, 0, 1.935), UP)], [((0, 0, 1.83), UP), ((0, 0, 1.935), DN), ((0, -0.0, 0), BACK)]]))
    pieces.append(shell('Chest', zband(1.42, 1.58) + [((0, 0.0, 0), FRONT), ((0.15, 0, 0), (-1, 0, 0)), ((-0.15, 0, 0), (1, 0, 0))], thick=0.007, push=0.006))
MASK = BASE == 'mh' and os.environ.get('HOLO_HEAD', 'mask') == 'mask'
if MASK:
    eye = JJ['l-eye']; chin_z = JJ['jaw'][2] - 0.012; hy = LM['head_y']
    brow = eye[2] + float(os.environ.get('HOLO_BROW', '0.042'))
    ysplit = eye[1] + 0.075               # just in front of the ears
    jaw = ((0, eye[1] + 0.01, chin_z), (0, -0.6, 1))     # under-jaw line rising toward the back of the skull
    G = 0.0025                            # half panel-gap
    pieces.append(shell('Helmet', None, thick=0.010, push=0.009, parts=[
        [((0, 0, brow + G), UP), jaw],
        [((0, ysplit + G, 0), BACK), ((0, 0, brow + G), DN), jaw]]))
    pieces.append(shell('Faceplate', [((0, 0, brow - G), DN), ((0, ysplit - G, 0), FRONT), jaw], thick=0.007, push=0.005, smooth=0))
    hw = max(v.co.x for v in body.data.vertices if abs(v.co.z - eye[2]) < 0.01 and abs(v.co.y - hy) < 0.06)
    for sx in (1, -1):                    # ear pods (dark), red core
        bpy.ops.mesh.primitive_cylinder_add(radius=0.034, depth=0.03, location=(sx * (hw + 0.008), ysplit + 0.018, eye[2] - 0.02), rotation=(0, math.pi / 2, 0), vertices=32)
        o = bpy.context.object; o.name = 'EarPod'; o.data.materials.append(M_SUIT)
        bev = o.modifiers.new('b', 'BEVEL'); bev.width = 0.006; bev.segments = 3
        bpy.ops.object.modifier_apply(modifier='b'); bpy.ops.object.shade_smooth()
        pieces.append(o)
if not SLIM and not MASK:
  pieces.append(shell('Helmet', None, thick=0.012, push=0.012, parts=[
    [((0, 0, Zf(1.912)), UP)],
    [((0, 0, Zf(1.80)), UP), ((0, 0, Zf(1.912)), DN), ((0, -0.035 + HY, 0), BACK)]]))
if not SLIM and not MASK:
  pieces.append(shell('Visor', [((0, 0, Zf(1.852)), UP), ((0, 0, Zf(1.902)), DN), ((0, -0.05 + HY, 0), FRONT)], thick=0.006, push=0.018, material=M_VISOR))
if not SLIM and not MASK:
  pieces.append(shell('Faceplate', [((0, 0, Zf(1.752)), UP), ((0, 0, Zf(1.838)), DN), ((0, -0.03 + HY, 0), FRONT)], thick=0.008, push=0.008, smooth=0))
if not SLIM:
  # torso
  pieces.append(shell('Chest', zband(Zf(1.405), Zf(1.60)) + [((0, 0.0, 0), FRONT), ((0.19, 0, 0), (-1, 0, 0)), ((-0.19, 0, 0), (1, 0, 0))], push=0.010))
  pieces.append(shell('Back', zband(Zf(1.33), Zf(1.62)) + [((0, 0.035, 0), BACK), ((0.16, 0, 0), (-1, 0, 0)), ((-0.16, 0, 0), (1, 0, 0))], push=0.009))
  for k, (z0, z1) in enumerate(((1.338, 1.378), (1.276, 1.316), (1.214, 1.254), (1.152, 1.192))):
    pieces.append(shell('Ab%d' % k, zband(Zf(z0), Zf(z1)) + [((0, 0.02, 0), FRONT), ((0.14, 0, 0), (-1, 0, 0)), ((-0.14, 0, 0), (1, 0, 0))], push=0.007))
  pieces.append(shell('Belt', zband(Zf(1.075), Zf(1.115)), push=0.006, thick=0.012))


def limb_plates(s, n):
    ua = BW['upper_arm.' + n]; fa = BW['forearm.' + n]
    th = BW['thigh.' + n]; sh = BW['shin.' + n]
    xs = ((0, 0, 0), (s, 0, 0))   # keep own side only
    dc = ua[0] + (ua[1] - ua[0]) * 0.1 + Vector((0, 0, 0.02))
    pieces.append(shell('Shoulder.' + n, [(dc + Vector((0, 0, -0.035)), (0.25 * s, 0, 1)), (dc - Vector((0.07 * s, 0, 0)), (s, 0, 0))],
                        pred=lambda p: (p - dc).length < (0.11 if SLIM else 0.13), thick=0.008 if SLIM else 0.014, push=0.008 if SLIM else 0.018))
    if SLIM:
        pieces.append(shell('Gauntlet.' + n, axial(*fa, 0.3, 0.8) + [xs], pred=lambda p: seg_dist(p, *fa) < 0.1, thick=0.006, push=0.005))
        pieces.append(shell('Glove.' + n, [(fa[0] + (fa[1] - fa[0]) * 0.93, (fa[1] - fa[0]).normalized())], pred=lambda p: (p - fa[1]).length < 0.24, thick=0.005, push=0.004))
        pieces.append(shell('Knee.' + n, axial(*th, 0.94, 1.06) + [xs, ((0, th[1].y - 0.015, 0), FRONT)], pred=lambda p: seg_dist(p, *th) < 0.12, thick=0.008, push=0.008))
        pieces.append(shell('Boot.' + n, [((0, 0, 0.13), DN), xs], pred=lambda p: abs(p.x - s * 0.098) < 0.1, thick=0.008, push=0.006))
        return
    pieces.append(shell('UpperArm.' + n, axial(*ua, 0.42, 0.80) + [xs], pred=lambda p: seg_dist(p, *ua) < 0.12, push=0.008))
    pieces.append(shell('Gauntlet.' + n, axial(*fa, 0.18, 0.82) + [xs], pred=lambda p: seg_dist(p, *fa) < 0.11, push=0.009))
    pieces.append(shell('Thigh.' + n, axial(*th, 0.14, 0.78) + [xs, ((0, th[0].y + 0.005, 0), FRONT)], pred=lambda p: seg_dist(p, *th) < 0.17, push=0.009))
    pieces.append(shell('Knee.' + n, axial(*th, 0.92, 1.08) + [xs, ((0, th[1].y - 0.015, 0), FRONT)], pred=lambda p: seg_dist(p, *th) < 0.14, thick=0.014, push=0.015))
    pieces.append(shell('Shin.' + n, axial(*sh, 0.12, 0.76) + [xs], pred=lambda p: seg_dist(p, *sh) < 0.13, push=0.009))
    hd = BW['hand.' + n]
    wrist_c = fa[1]
    pieces.append(shell('Glove.' + n, [(fa[0] + (fa[1] - fa[0]) * 0.93, (fa[1] - fa[0]).normalized())],
                        pred=lambda p: (p - wrist_c).length < 0.24, thick=0.006, push=0.006))
    pieces.append(shell('Boot.' + n, [((0, 0, Zf(0.16)), DN), xs], pred=lambda p: abs(p.x - sh[1].x) < 0.1, thick=0.012, push=0.010))


side(limb_plates)

# ---------------------------------------------------------------- red accents
def add_box(name, loc, size, rot=(0, 0, 0), material=M_RED):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bev = o.modifiers.new('b', 'BEVEL'); bev.width = min(size) * 0.25; bev.segments = 2
    bpy.ops.object.modifier_apply(modifier='b')
    o.data.materials.append(material)
    pieces.append(o)
    return o


def add_dot(name, loc, r, material=M_RED):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=16, ring_count=8)
    o = bpy.context.object; o.name = name
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    pieces.append(o)
    return o


if SLIM:
    add_box('ChestCore', (0, -0.1, 1.47), (0.05, 0.025, 0.035))
else:
    add_box('ChestCore', (0, front(0, Zf(1.47), -0.108) - 0.010, Zf(1.47)), (0.075, 0.03, 0.05))
    if MASK:
        for sx in (1, -1):
            add_dot('EarDot', (sx * (hw + 0.024), ysplit + 0.018, eye[2] - 0.02), 0.012)
    else:
        add_dot('VisorDot', (0.03, front(0.03, Zf(1.877), -0.117 + HY) - 0.018, Zf(1.875)), 0.011)


def accents(s, n):
    ua = BW['upper_arm.' + n]; th = BW['thigh.' + n]; sh = BW['shin.' + n]; fa = BW['forearm.' + n]
    dc = ua[0] + (ua[1] - ua[0]) * 0.1 + Vector((0, 0, 0.02))
    add_box('ShoulderRed.' + n, dc + Vector((0.035 * s, 0, 0.062)), (0.07, 0.11, 0.025), rot=(0, -0.45 * s, 0))
    add_dot('KneeDot.' + n, th[1] + Vector((0, -0.085, 0.0)), 0.022)
    add_dot('ElbowDot.' + n, fa[0] + Vector((0, 0.07, 0)), 0.018)
    add_box('WristBand.' + n, fa[1] + (fa[0] - fa[1]) * 0.12, (0.06, 0.06, 0.022), rot=(0, math.atan2(fa[1].z - fa[0].z, fa[1].x - fa[0].x) * -1 + math.pi / 2, 0))
    add_dot('HipDot.' + n, Vector((0.16 * s, -0.04, Zf(1.06))), 0.016)
    add_box('BootRed.' + n, Vector((sh[1].x, front(sh[1].x, Zf(0.07), -0.075) - 0.015, Zf(0.07))), (0.07, 0.03, 0.03))


side(accents)

# ---------------------------------------------------------------- skinning
for o in bpy.context.selected_objects:
    o.select_set(False)
body.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
if BASE == 'mh':
    body.select_set(False)
    proxy = body.copy(); proxy.data = body.data.copy(); proxy.name = 'WeightProxy'
    bpy.context.collection.objects.link(proxy)
    rmp = proxy.modifiers.new('rm', 'REMESH'); rmp.mode = 'VOXEL'; rmp.voxel_size = 0.006
    bpy.context.view_layer.objects.active = proxy
    proxy.select_set(True)
    bpy.ops.object.modifier_apply(modifier='rm')
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for g in proxy.vertex_groups:
        body.vertex_groups.new(name=g.name)
    dt = body.modifiers.new('dt', 'DATA_TRANSFER'); dt.object = proxy; dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}; dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.modifier_apply(modifier='dt')
    bpy.data.objects.remove(proxy)
    body.parent = arm
    am = body.modifiers.new('Armature', 'ARMATURE'); am.object = arm
else:
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

for o in pieces:
    for g in list(o.vertex_groups):
        o.vertex_groups.remove(g)
    for g in body.vertex_groups:
        o.vertex_groups.new(name=g.name)
    dt = o.modifiers.new('dt', 'DATA_TRANSFER')
    dt.object = body
    dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'
    dt.layers_vgroup_select_dst = 'NAME'
    bpy.context.view_layer.objects.active = o
    for x in bpy.context.selected_objects:
        x.select_set(False)
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier='dt')
    o.parent = arm
    am = o.modifiers.new('Armature', 'ARMATURE')
    am.object = arm

# merge all armour into one mesh per material role to keep draw calls low
def join(objs, name):
    objs = [o for o in objs if o.type == 'MESH' and len(o.data.vertices)]
    for x in bpy.context.selected_objects:
        x.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    bpy.context.object.name = name
    return bpy.context.object


armour = join(pieces, 'Armour')

tris = sum(len(p.vertices) - 2 for o in (body, armour) for p in o.data.polygons)
print('ANDROID tris', tris, 'body verts', len(body.data.vertices), 'armour verts', len(armour.data.vertices))

# ---------------------------------------------------------------- previews
if PREV:
    os.makedirs(PREV, exist_ok=True)
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light = 'STUDIO'
    scn.display.shading.color_type = 'MATERIAL'
    scn.display.shading.show_cavity = True
    scn.render.resolution_x, scn.render.resolution_y = 600, 800
    scn.world = bpy.data.worlds.new('w')
    scn.world.color = (1, 1, 1)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scn.collection.objects.link(cam)
    scn.camera = cam
    cam.data.lens = 50
    for nm, loc in (('front', (0, -6.2, 1.0)), ('side', (6.2, 0, 1.0)), ('three', (3.6, -4.6, 1.5)), ('head', (0.5, -1.4, 1.75))):
        cam.location = loc
        tgt = Vector((0, 0, 1.0 if nm != 'head' else 1.72))
        cam.rotation_euler = (tgt - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scn.render.filepath = os.path.join(PREV, nm + '.png')
        bpy.ops.render.render(write_still=True)

# ---------------------------------------------------------------- export
for x in bpy.context.selected_objects:
    x.select_set(False)
for o in (arm, body, armour):
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_skins=True,
                          export_animations=False, export_morph=False, export_yup=True,
                          export_apply=False, export_materials='EXPORT')
print('EXPORTED', OUT, os.path.getsize(OUT))
