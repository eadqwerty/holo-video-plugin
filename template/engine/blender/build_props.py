"""HOLO hero-prop library (the reference set's recurring objects), exported one GLB per prop.

Run:  blender -b --python engine/blender/build_props.py -- engine/assets/props [preview_dir]

Material NAMES carry the role (as for the android): PLATE (light chrome), SUIT (dark), RED, VISOR (black gloss), GLASS.
Animatable parts are separate named nodes: cabinet Drawer0..2, clock HourHand/MinuteHand.
Units: metres, Y-up after export; every prop stands on the floor (min z = 0) unless noted.
"""
import bpy, bmesh, sys, os, math
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/props'
PREV = argv[1] if len(argv) > 1 else None
os.makedirs(OUT, exist_ok=True)

MATS = {}


def mat(name, rgb):
    if name not in MATS:
        m = bpy.data.materials.new(name); m.diffuse_color = (*rgb, 1); MATS[name] = m
    return MATS[name]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    for n, c in (('PLATE', (.85, .85, .85)), ('SUIT', (.06, .06, .06)), ('RED', (.8, .03, .04)), ('VISOR', (.02, .02, .02)), ('GLASS', (.9, .9, .9))):
        mat(n, c)


def assign(o, m):
    o.data.materials.clear(); o.data.materials.append(MATS[m])


def apply_all(o):
    bpy.context.view_layer.objects.active = o
    for x in bpy.context.selected_objects: x.select_set(False)
    o.select_set(True)
    for md in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)


def smooth(o, sub=1):
    if sub:
        m = o.modifiers.new('sub', 'SUBSURF'); m.levels = sub; m.render_levels = sub
    apply_all(o)
    bpy.ops.object.shade_smooth()


def cube(name, size, loc, m='PLATE', bevel=0.004):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)   # Blender 5.x defaults location=True
    if bevel:
        b = o.modifiers.new('b', 'BEVEL'); b.width = bevel; b.segments = 2
        apply_all(o)
    assign(o, m)
    return o


def cyl(name, r, depth, loc, m='PLATE', rot=(0, 0, 0), verts=48):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object; o.name = name; assign(o, m); bpy.ops.object.shade_smooth()
    return o


def lathe(name, profile, m='PLATE', steps=64):
    """profile: list of (r, z) points revolved around Z."""
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    rings = []
    for k in range(steps):
        a = k / steps * math.tau
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile])
    for k in range(steps):
        A, B = rings[k], rings[(k + 1) % steps]
        for i in range(len(profile) - 1):
            bm.faces.new((A[i], B[i], B[i + 1], A[i + 1]))
    bm.normal_update(); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    assign(o, m)
    bpy.context.view_layer.objects.active = o
    for x in bpy.context.selected_objects: x.select_set(False)
    o.select_set(True)
    sub = o.modifiers.new('sub', 'SUBSURF'); sub.levels = 2
    bpy.ops.object.modifier_apply(modifier='sub')
    bpy.ops.object.shade_smooth()
    return o


def export(name):
    for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH' or o.type == 'EMPTY')
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_materials='EXPORT', export_apply=True)
    print('PROP', name, os.path.getsize(path))
    if PREV:
        preview(name)


def preview(name):
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light = 'STUDIO'; scn.display.shading.color_type = 'MATERIAL'; scn.display.shading.show_cavity = True
    scn.render.resolution_x = scn.render.resolution_y = 400
    scn.world = scn.world or bpy.data.worlds.new('w'); scn.world.color = (1, 1, 1)
    objs = [o for o in scn.objects if o.type == 'MESH']
    lo = Vector((min(v[i] for o in objs for v in [o.matrix_world @ Vector(c) for c in o.bound_box]) for i in range(3)))
    hi = Vector((max(v[i] for o in objs for v in [o.matrix_world @ Vector(c) for c in o.bound_box]) for i in range(3)))
    c = (lo + hi) / 2; r = (hi - lo).length
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam); scn.camera = cam
    cam.location = c + Vector((0.9, -1.4, 0.8)).normalized() * r * 1.6
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    os.makedirs(PREV, exist_ok=True)
    scn.render.filepath = os.path.join(PREV, name + '.png'); bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


# ---------------------------------------------------------------- brain (refs 6/7): two hemispheres with gyri, cerebellum, stem
reset()
mb = bpy.data.metaballs.new('brain'); mb.resolution = 0.006
mo = bpy.data.objects.new('Brain', mb); bpy.context.collection.objects.link(mo)
for sx in (1, -1):
    for (x, y, z, r, s) in ((0.045, 0.0, 0.10, 0.07, (1.0, 1.6, 1.0)), (0.05, 0.05, 0.085, 0.06, (1, 1.2, 1)), (0.05, -0.05, 0.09, 0.06, (1, 1.2, 1)), (0.055, 0.0, 0.065, 0.06, (1, 1.5, 0.8))):
        e = mb.elements.new(type='ELLIPSOID'); e.co = (x * sx, y, z); e.radius = r; e.size_x, e.size_y, e.size_z = s
for (x, y, z, r) in ((0.03, 0.075, 0.035, 0.035), (-0.03, 0.075, 0.035, 0.035)):
    e = mb.elements.new(type='BALL'); e.co = (x, y, z); e.radius = r
e = mb.elements.new(type='CAPSULE'); e.co = (0, 0.045, 0.0); e.radius = 0.018; e.size_x = 0.03; e.rotation = Vector((1, 0, 0)).rotation_difference(Vector((0, 0.3, -1)))
bpy.context.view_layer.objects.active = mo; mo.select_set(True)
bpy.ops.object.convert(target='MESH')
br = bpy.context.object; br.name = 'Brain'
rm = br.modifiers.new('rm', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = 0.0025
tex = bpy.data.textures.new('gyri', 'VORONOI'); tex.noise_scale = 0.018; tex.distance_metric = 'DISTANCE'
d = br.modifiers.new('d', 'DISPLACE'); d.texture = tex; d.strength = -0.006; d.mid_level = 0.6
sm = br.modifiers.new('sm', 'CORRECTIVE_SMOOTH'); sm.iterations = 3
dec = br.modifiers.new('dec', 'DECIMATE'); dec.ratio = 0.3
apply_all(br); bpy.ops.object.shade_smooth(); assign(br, 'PLATE')
# central fissure groove
cube('Fissure', (0.004, 0.2, 0.1), (0, 0, 0.12), 'SUIT', bevel=0)
bpy.data.objects.remove(bpy.data.objects['Fissure'])
export('brain')

# ---------------------------------------------------------------- light bulb (ref2 "THE IDEA"): glass, screw base, red filament
reset()
prof = [(0.0, 0.215), (0.03, 0.212), (0.055, 0.2), (0.068, 0.18), (0.07, 0.16), (0.064, 0.135), (0.05, 0.11), (0.036, 0.09), (0.03, 0.075)]
g = lathe('Glass', prof, 'GLASS')
base = [(0.03, 0.075), (0.031, 0.07)]
for i in range(6):
    z = 0.068 - i * 0.008; base += [(0.033, z), (0.029, z - 0.004)]
base += [(0.022, 0.012), (0.008, 0.004), (0.0, 0.003)]
lathe('Base', base, 'SUIT')
pts = [(-0.012, 0, 0.09), (-0.012, 0, 0.14), (-0.008, 0, 0.15), (-0.004, 0, 0.14), (0.0, 0, 0.15), (0.004, 0, 0.14), (0.008, 0, 0.15), (0.012, 0, 0.14), (0.012, 0, 0.09)]
cd = bpy.data.curves.new('fil', 'CURVE'); cd.dimensions = '3D'; cd.bevel_depth = 0.0018
sp = cd.splines.new('POLY'); sp.points.add(len(pts) - 1)
for p, c in zip(sp.points, pts): p.co = (*c, 1)
fo = bpy.data.objects.new('Filament', cd); bpy.context.collection.objects.link(fo)
bpy.context.view_layer.objects.active = fo; fo.select_set(True); bpy.ops.object.convert(target='MESH'); assign(bpy.context.object, 'RED')
export('bulb')

# ---------------------------------------------------------------- headphones (ref3 "HEADPHONES ON"): band, yokes, red cushions
reset()
bpy.ops.mesh.primitive_torus_add(major_radius=0.105, minor_radius=0.011, location=(0, 0, 0.11), rotation=(math.pi / 2, 0, 0), major_segments=64, minor_segments=12)
band = bpy.context.object; band.name = 'Band'
bm = bmesh.new(); bm.from_mesh(band.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.02], context='VERTS'); bm.to_mesh(band.data); bm.free()
assign(band, 'PLATE'); bpy.ops.object.shade_smooth()
for sx in (1, -1):
    cyl('Cup', 0.048, 0.03, (0.108 * sx, 0, 0.09), 'PLATE', rot=(0, math.pi / 2, 0))
    cyl('Cushion', 0.044, 0.018, (0.088 * sx, 0, 0.09), 'RED', rot=(0, math.pi / 2, 0))
export('headphones')

# ---------------------------------------------------------------- phone (refs 1/2): slab, black screen, red camera dot
reset()
ph = cube('Body', (0.075, 0.009, 0.155), (0, 0, 0.0775), 'PLATE', bevel=0.006)
cube('Screen', (0.068, 0.002, 0.145), (0, -0.0047, 0.0775), 'VISOR', bevel=0.004)
cyl('Cam', 0.004, 0.003, (0.025, 0.005, 0.14), 'RED', rot=(math.pi / 2, 0, 0), verts=16)
export('phone')

# ---------------------------------------------------------------- filing cabinet (ref3 "20 YEARS"): 3 drawers (named, slide on -Y)
reset()
w, dd, h = 0.47, 0.62, 1.32
cube('Shell', (w, dd, h), (0, 0, h / 2), 'PLATE', bevel=0.006)
for i in range(3):
    zc = h - 0.22 - i * 0.42
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0)); em = bpy.context.object; em.name = 'Drawer%d' % i
    f = cube('Front%d' % i, (w - 0.04, 0.03, 0.38), (0, -dd / 2 - 0.012, zc), 'PLATE', bevel=0.005); f.parent = em
    hd = cube('Handle%d' % i, (0.14, 0.03, 0.025), (0, -dd / 2 - 0.04, zc + 0.11), 'SUIT', bevel=0.006); hd.parent = em
    lb = cube('Label%d' % i, (0.09, 0.006, 0.05), (0, -dd / 2 - 0.03, zc + 0.05), 'RED' if i == 1 else 'SUIT', bevel=0.001); lb.parent = em
    box = cube('Box%d' % i, (w - 0.06, dd - 0.04, 0.34), (0, 0.0, zc - 0.01), 'SUIT', bevel=0.003); box.parent = em
export('cabinet')

# ---------------------------------------------------------------- bed (refs 3/6): frame, mattress, pillow, sheet fold
reset()
L, W = 2.05, 1.0
for x in (-1, 1):
    for y in (-1, 1):
        cyl('Leg', 0.025, 0.28, (x * (W / 2 - 0.05), y * (L / 2 - 0.05), 0.14), 'SUIT', verts=16)
cube('Frame', (W, L, 0.08), (0, 0, 0.3), 'PLATE', bevel=0.01)
cube('Head', (W, 0.06, 0.55), (0, L / 2 - 0.03, 0.55), 'PLATE', bevel=0.012)
m = cube('Mattress', (W - 0.04, L - 0.1, 0.18), (0, -0.02, 0.43), 'PLATE', bevel=0.05)
p = cube('Pillow', (0.6, 0.32, 0.12), (0, L / 2 - 0.26, 0.57), 'PLATE', bevel=0.05)
smooth(p, 2)
cube('Sheet', (W - 0.02, 1.1, 0.03), (0, -0.42, 0.53), 'PLATE', bevel=0.012)
cube('SheetFold', (W - 0.02, 0.12, 0.04), (0, 0.12, 0.545), 'PLATE', bevel=0.015)
export('bed')

# ---------------------------------------------------------------- wall clock (ref3 "2 AM"): rim, face, ticks, named hands (rotate about Y-forward)
reset()
R = 0.22
cyl('Rim', R, 0.05, (0, 0, R), 'PLATE', rot=(math.pi / 2, 0, 0), verts=64)
cyl('Face', R * 0.9, 0.052, (0, -0.002, R), 'PLATE', rot=(math.pi / 2, 0, 0), verts=64)
for i in range(12):
    a = i / 12 * math.tau
    t = cube('Tick', (0.008, 0.01, 0.03 if i % 3 else 0.05), (math.sin(a) * R * 0.78, -0.03, R + math.cos(a) * R * 0.78), 'SUIT', bevel=0)
    t.rotation_euler = (0, a, 0)
for nm, ln, wd, m in (('HourHand', 0.1, 0.014, 'SUIT'), ('MinuteHand', 0.16, 0.009, 'SUIT'), ('SecondHand', 0.17, 0.004, 'RED')):
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, -0.035, R)); em = bpy.context.object; em.name = nm
    hnd = cube(nm + 'Mesh', (wd, 0.006, ln), (0, -0.035 - (0.002 if m == 'RED' else 0), R + ln / 2 - 0.02), m, bevel=0)
    hnd.parent = em; hnd.matrix_parent_inverse = em.matrix_world.inverted()
cyl('Pin', 0.012, 0.02, (0, -0.042, R), 'RED', rot=(math.pi / 2, 0, 0), verts=16)
export('clock')

# ---------------------------------------------------------------- hourglass: frame + glass + red sand
reset()
cyl('Top', 0.11, 0.025, (0, 0, 0.4125), 'PLATE'); cyl('Bot', 0.11, 0.025, (0, 0, 0.0125), 'PLATE')
for a in range(3):
    ang = a / 3 * math.tau; cyl('Post', 0.008, 0.375, (math.cos(ang) * 0.09, math.sin(ang) * 0.09, 0.2125), 'SUIT', verts=12)
lathe('Glass', [(0.0, 0.4), (0.07, 0.395), (0.075, 0.33), (0.04, 0.25), (0.01, 0.215), (0.04, 0.18), (0.075, 0.1), (0.07, 0.03), (0.0, 0.025)], 'GLASS')
lathe('Sand', [(0.0, 0.03), (0.066, 0.032), (0.06, 0.08), (0.03, 0.11), (0.0, 0.12)], 'RED')
export('hourglass')
print('DONE')
