# Cena do guarda-roupa (Blender/Cycles), montada peça por peça.
# Gera a sequência de quadros que o site toca sincronizada com a rolagem.
#   pip install bpy numpy   (Blender como módulo Python)
#   python scripts/render/guarda_roupa.py --out .cache/render --size 1080 --frames 160 --samples 64
#   python scripts/render/guarda_roupa.py --only 0,40,80,120,159   (só alguns quadros, para conferir)
import argparse
import math
import os
import sys
import zlib

import bpy  # antes do bmesh
import bmesh
from mathutils import Vector

ap = argparse.ArgumentParser()
ap.add_argument('--out', default='.cache/render')
ap.add_argument('--size', type=int, default=1080)
ap.add_argument('--frames', type=int, default=160)
ap.add_argument('--samples', type=int, default=64)
ap.add_argument('--only', default='')
ap.add_argument('--threads', type=int, default=0)
ap.add_argument('--closeup', action='store_true')
# padrão: estúdio (fundo transparente, só o móvel e sua sombra, para pousar sobre o site)
ap.add_argument('--room', action='store_true', help='cena antiga, com parede e chão')
args = ap.parse_args()
os.makedirs(args.out, exist_ok=True)

# ---------------------------------------------------------------- cena limpa
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = args.samples
sc.cycles.use_adaptive_sampling = True
sc.cycles.adaptive_threshold = 0.02
sc.cycles.use_denoising = True
sc.cycles.max_bounces = 6
sc.cycles.glossy_bounces = 3
sc.cycles.transparent_max_bounces = 2
sc.cycles.caustics_reflective = False
sc.cycles.caustics_refractive = False
if args.threads:
    sc.render.threads_mode = 'FIXED'
    sc.render.threads = args.threads
sc.render.resolution_x = sc.render.resolution_y = args.size
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_depth = '8'
STUDIO = not args.room
if STUDIO:
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'
sc.view_settings.exposure = -0.35
coll = sc.collection

# ---------------------------------------------------------------- utilitários
def box(name, size, loc, mat, bevel=0.0015, parent=None):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    # UV em metros, veio no sentido da maior dimensão de cada face, trecho aleatório da lâmina
    uvl = bm.loops.layers.uv.new('UVMap')
    rnd = (zlib.crc32(f"{name}{loc}".encode()) % 997) / 997
    for f in bm.faces:
        nrm = [abs(c) for c in f.normal]
        ax = nrm.index(max(nrm))
        a, b = [(1, 2), (0, 2), (0, 1)][ax]
        g, c = (a, b) if size[a] >= size[b] else (b, a)
        for lp in f.loops:
            co = lp.vert.co
            lp[uvl].uv = ((co[g] + size[g] / 2) / TILE + rnd * max(0, 1 - size[g] / TILE),
                          (co[c] + size[c] / 2) / TILE + ((rnd * 7.31 + ax * 0.37) % 1) * max(0, 1 - size[c] / TILE))
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob.location = loc
    ob.data.materials.append(mat)
    if bevel:
        m = ob.modifiers.new('bevel', 'BEVEL')
        m.width = bevel
        m.segments = 3
        m.limit_method = 'ANGLE'
        m.harden_normals = True
    for p in ob.data.polygons:
        p.use_smooth = True
    if parent:
        ob.parent = parent
    return ob


def cyl(name, r, h, loc, mat, rot=(0, 0, 0), verts=32):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=h)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = rot
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def empty(name, loc):
    ob = bpy.data.objects.new(name, None)
    coll.objects.link(ob)
    ob.location = loc
    return ob


def nodes_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m, nt, bsdf

# ---------------------------------------------------------------- materiais
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from madeira import oak as oak_texture  # noqa: E402

TILE = 2.4  # a imagem da lâmina cobre 2,4 × 2,4 m


def wood_images(seed, tag='', **kw):
    """Gera (uma vez) a lâmina e o relevo, e carrega no Blender."""
    cp = os.path.join(args.out, f'_carvalho-{seed}{tag}.png')
    hp = os.path.join(args.out, f'_carvalho-{seed}{tag}-relevo.png')
    if not os.path.exists(cp):
        from PIL import Image
        import numpy as np
        c, h = oak_texture(seed=seed, **kw)
        Image.fromarray((c * 255).astype(np.uint8)).save(cp)
        Image.fromarray((h * 255).astype(np.uint8)).save(hp)
    ci = bpy.data.images.load(cp)
    hi = bpy.data.images.load(hp)
    hi.colorspace_settings.name = 'Non-Color'
    return ci, hi


def oak(name, seed, rough=0.42, coat=0.25, **kw):
    m, nt, bsdf = nodes_mat(name)
    if STUDIO:  # acabamento acetinado, não verniz brilhante
        rough, coat = rough + 0.14, coat * 0.3
    if STUDIO:  # nogueira/freijó escuro, como nos projetos da MEDE
        kw.setdefault('palette', ((0.40, 0.30, 0.22), (0.22, 0.155, 0.105), (0.52, 0.40, 0.29)))
    ci, hi = wood_images(seed, tag='-nogueira2' if kw.get('palette') else '', **kw)
    uv = nt.nodes.new('ShaderNodeUVMap')
    tc = nt.nodes.new('ShaderNodeTexImage')
    tc.image = ci
    tc.interpolation = 'Cubic'
    th = nt.nodes.new('ShaderNodeTexImage')
    th.image = hi
    nt.links.new(uv.outputs['UV'], tc.inputs['Vector'])
    nt.links.new(uv.outputs['UV'], th.inputs['Vector'])
    nt.links.new(tc.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Coat Weight'].default_value = coat
    bsdf.inputs['Coat Roughness'].default_value = 0.1
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.12
    bump.inputs['Distance'].default_value = 0.0004
    nt.links.new(th.outputs['Color'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return m


# portas: lâmina de veio mais reto e calmo (corte quase radial), como em móvel planejado de alto padrão
M = {'oakV': oak('carvalho', 7), 'oakD': oak('carvalho-portas', 11, rough=0.38, coat=0.35, rings=150, arch=0.06)}
M['oakH'] = M['oakV']
M['chrome'], _, b = nodes_mat('cromado')
b.inputs['Base Color'].default_value = (0.86, 0.86, 0.88, 1)
b.inputs['Metallic'].default_value = 1.0
b.inputs['Roughness'].default_value = 0.16
M['brass'], _, b = nodes_mat('latao')
b.inputs['Base Color'].default_value = (0.80, 0.60, 0.34, 1)
b.inputs['Metallic'].default_value = 1.0
b.inputs['Roughness'].default_value = 0.3
M['black'], _, b = nodes_mat('pe')
b.inputs['Base Color'].default_value = (0.03, 0.03, 0.03, 1)
b.inputs['Roughness'].default_value = 0.5
M['led'], ntl, b = nodes_mat('led')
b.inputs['Base Color'].default_value = (1, 0.8, 0.55, 1)
b.inputs['Emission Color'].default_value = (1, 0.72, 0.42, 1)
b.inputs['Emission Strength'].default_value = 0.0

# parede (reboco claro) e chão (cimento queimado polido)
M['wall'], nt, b = nodes_mat('parede')
b.inputs['Base Color'].default_value = (0.74, 0.68, 0.62, 1)
b.inputs['Roughness'].default_value = 0.9
nz = nt.nodes.new('ShaderNodeTexNoise')
nz.inputs['Scale'].default_value = 40
bp = nt.nodes.new('ShaderNodeBump')
bp.inputs['Strength'].default_value = 0.03
nt.links.new(nz.outputs['Fac'], bp.inputs['Height'])
nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
M['floor'], nt, b = nodes_mat('chao')
nz = nt.nodes.new('ShaderNodeTexNoise')
nz.inputs['Scale'].default_value = 3.5
nz.inputs['Detail'].default_value = 8
rp = nt.nodes.new('ShaderNodeValToRGB')
rp.color_ramp.elements[0].color = (0.40, 0.37, 0.34, 1)
rp.color_ramp.elements[1].color = (0.56, 0.53, 0.50, 1)
nt.links.new(nz.outputs['Fac'], rp.inputs['Fac'])
nt.links.new(rp.outputs['Color'], b.inputs['Base Color'])
rr = nt.nodes.new('ShaderNodeMapRange')
rr.inputs['To Min'].default_value = 0.12
rr.inputs['To Max'].default_value = 0.3
nt.links.new(nz.outputs['Fac'], rr.inputs['Value'])
nt.links.new(rr.outputs['Result'], b.inputs['Roughness'])
M['shadowcast'], _, b = nodes_mat('janela')
b.inputs['Base Color'].default_value = (0.2, 0.2, 0.2, 1)

# ---------------------------------------------------------------- sala
WALL_Y = 1.05
chao = box('chao', (14, 14, 0.02), (0, 3, -0.01), M['floor'], bevel=0)
if STUDIO:
    chao.is_shadow_catcher = True  # só a sombra do móvel aparece; o resto fica transparente
parede = box('parede', (14, 0.1, 6), (0, WALL_Y + 0.05, 3), M['wall'], bevel=0)
rodape = box('rodape-parede', (14, 0.012, 0.07), (0, WALL_Y - 0.006, 0.035), M['wall'], bevel=0.002)

# Janela fora de quadro, à esquerda: a luz do sol entra por ela e desenha a grade na parede
WX = -3.2
win_parts = []
for z0, z1 in ((0, 0.75), (2.85, 5)):
    win_parts.append(box('janela-parede', (0.1, 6, z1 - z0), (WX, 0, (z0 + z1) / 2), M['shadowcast'], bevel=0))
for y0, y1 in ((-3, -1.6), (0.9, 3)):
    win_parts.append(box('janela-parede', (0.1, y1 - y0, 2.1), (WX, (y0 + y1) / 2, 1.8), M['shadowcast'], bevel=0))
for y in (-0.95, -0.35, 0.25):
    win_parts.append(box('caixilho', (0.1, 0.05, 2.1), (WX, y, 1.8), M['shadowcast'], bevel=0))
for z in (1.45, 2.15):
    win_parts.append(box('caixilho', (0.1, 2.5, 0.05), (WX, -0.35, z), M['shadowcast'], bevel=0))
for o in win_parts:
    o.visible_camera = False
    o.visible_glossy = False
if STUDIO:
    for o in [parede, rodape] + win_parts:
        o.hide_render = True

# ---------------------------------------------------------------- luz
world = bpy.data.worlds.new('mundo')
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.95, 0.88, 0.80, 1)
bg.inputs['Strength'].default_value = 0.55

sun_d = bpy.data.lights.new('sol', 'SUN')
sun_d.energy = 5.0
sun_d.angle = math.radians(18 if STUDIO else 1.6)  # estúdio: sombra mais macia
sun_d.color = (1.0, 0.86, 0.68)
sun = bpy.data.objects.new('sol', sun_d)
coll.objects.link(sun)
d = Vector((1.0, 0.55, -0.55)).normalized()  # vem da esquerda, de cima, um pouco da frente
sun.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

fill_d = bpy.data.lights.new('rebatedor', 'AREA')
fill_d.energy = 160
fill_d.size = 4
fill_d.color = (1.0, 0.95, 0.9)
fill_d.use_shadow = not STUDIO  # sem sombra do rebatedor: senão mancha o fundo transparente
fill = bpy.data.objects.new('rebatedor', fill_d)
coll.objects.link(fill)
fill.location = (2.5, -4.5, 2.6)
fill.rotation_euler = (Vector((0, 0.3, 1.0)) - fill.location).to_track_quat('-Z', 'Y').to_euler()

led_d = bpy.data.lights.new('led', 'AREA')
led_d.shape = 'RECTANGLE'
led_d.color = (1.0, 0.72, 0.42)
led_d.energy = 0
led = bpy.data.objects.new('led', led_d)
coll.objects.link(led)

# ---------------------------------------------------------------- móvel
# medidas (m): 1,60 × 2,00 × 0,58; MDF 18 mm; base sobre pés reguláveis
W, H, D, T = 1.6, 2.0, 0.58, 0.018
FEET = 0.09          # altura dos pés
BH = 0.07            # altura da base (moldura)
Z0 = FEET + BH       # piso interno
DIV = -0.08          # divisória (x)
Y0 = 0.0             # frente do corpo em y = -D/2

parts = {}


def add(name, ob):
    ob['home'] = tuple(ob.location)
    ob['rot0'] = tuple(ob.rotation_euler)
    parts[name] = ob
    return ob


# base: moldura + pés
base = add('base', empty('base', (0, 0, 0)))
box('base-frente', (W, T, BH), (0, -D / 2 + T / 2, FEET + BH / 2), M['oakH'], parent=base)
box('base-tras', (W, T, BH), (0, D / 2 - T / 2, FEET + BH / 2), M['oakH'], parent=base)
box('base-esq', (T, D - 2 * T, BH), (-W / 2 + T / 2, 0, FEET + BH / 2), M['oakH'], parent=base)
box('base-dir', (T, D - 2 * T, BH), (W / 2 - T / 2, 0, FEET + BH / 2), M['oakH'], parent=base)
box('base-fundo', (W, D, T), (0, 0, Z0 - T / 2), M['oakH'], parent=base)
for x in (-W / 2 + 0.06, W / 2 - 0.06, DIV):
    for y in (-D / 2 + 0.06, D / 2 - 0.06):
        f = cyl('pe', 0.022, FEET - 0.01, (x, y, (FEET - 0.01) / 2 + 0.01), M['chrome'])
        f.parent = base
        g = cyl('sapata', 0.028, 0.012, (x, y, 0.006), M['black'])
        g.parent = base

HS = H - BH - FEET  # altura das laterais
add('lat-esq', box('lat-esq', (T, D, HS), (-W / 2 + T / 2, 0, Z0 + HS / 2 - T), M['oakV']))
add('lat-dir', box('lat-dir', (T, D, HS), (W / 2 - T / 2, 0, Z0 + HS / 2 - T), M['oakV']))
ZTOP = Z0 - T + HS
add('tampo', box('tampo', (W, D, T), (0, 0, ZTOP + T / 2), M['oakH']))
IH = ZTOP - Z0  # altura interna
add('fundo', box('fundo', (W - 2 * T, 0.008, IH), (0, D / 2 - 0.012, Z0 + IH / 2), M['oakV'], bevel=0.0008))
add('divisoria', box('divisoria', (T, D - 0.03, IH), (DIV, -0.012, Z0 + IH / 2), M['oakV']))
RX0, RX1 = DIV + T / 2, W / 2 - T  # vão direito
for k, z in enumerate((0.42, 0.80, 1.18, 1.52)):
    add(f'prat-{k}', box(f'prat-{k}', (RX1 - RX0, D - 0.04, T), ((RX0 + RX1) / 2, -0.016, Z0 + z), M['oakH']))
LX0, LX1 = -W / 2 + T, DIV - T / 2  # vão esquerdo
add('prat-gav', box('prat-gav', (LX1 - LX0, D - 0.04, T), ((LX0 + LX1) / 2, -0.016, Z0 + 0.50), M['oakH']))
add('cabideiro', cyl('cabideiro', 0.0125, LX1 - LX0, ((LX0 + LX1) / 2, 0.0, ZTOP - 0.09), M['chrome'], rot=(0, math.pi / 2, 0)))
for k, z in enumerate((0.03, 0.26)):
    g = add(f'gaveta-{k}', empty(f'gaveta-{k}', ((LX0 + LX1) / 2, -D / 2 + 0.05, Z0 + z)))
    gw, gh = LX1 - LX0 - 0.006, 0.21
    box('frente', (gw, T, gh), (0, 0, gh / 2), M['oakD'], parent=g)
    box('caixa-l', (0.012, D - 0.08, gh - 0.04), (-gw / 2 + 0.03, D / 2 - 0.04, gh / 2 - 0.01), M['oakH'], parent=g)
    box('caixa-r', (0.012, D - 0.08, gh - 0.04), (gw / 2 - 0.03, D / 2 - 0.04, gh / 2 - 0.01), M['oakH'], parent=g)
    p = cyl('puxador', 0.007, 0.14, (0, -0.03, gh * 0.62), M['brass'] if STUDIO else M['chrome'], rot=(0, math.pi / 2, 0))
    p.parent = g
# fita de LED sob o tampo, no vão direito
add('led-fita', box('led-fita', (RX1 - RX0 - 0.06, 0.012, 0.004), ((RX0 + RX1) / 2, -D / 2 + 0.06, ZTOP - 0.004), M['led'], bevel=0))
led.location = ((RX0 + RX1) / 2, -D / 2 + 0.07, ZTOP - 0.012)
led.rotation_euler = (0, 0, 0)  # aponta para baixo (-Z)
led_d.size = RX1 - RX0 - 0.06
led_d.size_y = 0.02

# portas: lisas (18 mm), com frestas de 2 mm, dobradiças de caneco por dentro e
# puxador longo de aço escovado perto do encontro das portas
M['steel'], _, b_ = nodes_mat('aco-escovado')
b_.inputs['Base Color'].default_value = (0.80, 0.60, 0.34, 1) if STUDIO else (0.74, 0.74, 0.75, 1)  # latão escovado (dourado da marca)
b_.inputs['Metallic'].default_value = 1.0
b_.inputs['Roughness'].default_value = 0.28
b_.inputs['Anisotropic'].default_value = 0.6
M['hinge'], _, b_ = nodes_mat('dobradica')
b_.inputs['Base Color'].default_value = (0.62, 0.62, 0.63, 1)
b_.inputs['Metallic'].default_value = 1.0
b_.inputs['Roughness'].default_value = 0.35
GAP = 0.002
DW, DH = W / 2 - GAP * 1.5, HS + T - 0.006
doors = []
for side in (-1, 1):
    hinge = add(f'porta-{side}', empty(f'porta-{side}', (side * (W / 2 - GAP), -D / 2 - 0.0095, Z0 - T + 0.003)))
    box('folha', (DW, T, DH), (-side * DW / 2, 0, DH / 2), M['oakD'], bevel=0.0012, parent=hinge)
    # puxador: barra quadrada de 12 mm × 70 cm sobre dois suportes
    hx = -side * (DW - 0.055)
    box('puxador', (0.012, 0.012, 0.70), (hx, -0.045, DH * 0.5), M['steel'], bevel=0.0015, parent=hinge)
    for zz in (DH / 2 + 0.3, DH / 2 - 0.3):
        cyl('suporte', 0.005, 0.036, (hx, -0.027, zz), M['steel'], rot=(math.pi / 2, 0, 0)).parent = hinge
    # dobradiças de caneco (visíveis com a porta aberta)
    for zz in (0.12, DH / 2, DH - 0.12):
        cyl('caneco', 0.018, 0.004, (-side * 0.03, 0.0105, zz), M['hinge'], rot=(math.pi / 2, 0, 0)).parent = hinge
        box('braco', (0.05, 0.006, 0.022), (-side * 0.005, 0.014, zz), M['hinge'], bevel=0.001, parent=hinge)
    doors.append((side, hinge))

# ---------------------------------------------------------------- câmera
cam_d = bpy.data.cameras.new('camera')
cam_d.lens = 50
cam_d.dof.use_dof = True
cam_d.dof.aperture_fstop = 5.6
cam = bpy.data.objects.new('camera', cam_d)
coll.objects.link(cam)
sc.camera = cam
TARGET = Vector((0, 0, 1.05))
cam_d.dof.focus_distance = 5.4

# ---------------------------------------------------------------- animação
def clamp01(v):
    return max(0.0, min(1.0, v))


def win(t, a, b):
    return clamp01((t - a) / (b - a))


def out3(t):  # desacelera (power3.out)
    return 1 - (1 - t) ** 3


def inout(t):  # sine.inOut
    return 0.5 - 0.5 * math.cos(math.pi * t)


def io3(t):  # power3.inOut
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


# Etapas no tempo normalizado 0..1 (mesma ordem das fotos de referência)
STEPS = {
    'base': (0.03, 0.13), 'lat-esq': (0.12, 0.22), 'lat-dir': (0.16, 0.26), 'tampo': (0.25, 0.35),
    'fundo': (0.33, 0.43), 'divisoria': (0.42, 0.50),
    'prat-0': (0.47, 0.54), 'prat-1': (0.49, 0.56), 'prat-2': (0.51, 0.58), 'prat-3': (0.53, 0.60),
    'prat-gav': (0.56, 0.62), 'cabideiro': (0.58, 0.64), 'gaveta-0': (0.60, 0.67), 'gaveta-1': (0.62, 0.69),
    'porta--1': (0.68, 0.75), 'porta-1': (0.70, 0.77),
}
DROP = {'base', 'lat-esq', 'lat-dir', 'tampo'}
SLIDE_DOWN = {'fundo'}


def place(name, t):
    ob = parts[name]
    home = Vector(ob['home'])
    a, b = STEPS[name]
    u = win(t, a, b)
    for o in (ob, *ob.children_recursive):
        o.hide_render = u <= 0
    if u <= 0:
        return
    travel = 1 - out3(win(u, 0, 0.8))
    seat = 1 - inout(win(u, 0.62, 1))
    rot = list(ob['rot0'])
    if name in DROP or name in SLIDE_DOWN or name.startswith('porta'):
        off = Vector((0, 0, 3.2)) * travel + Vector((0, 0, 0.03)) * seat
        if name.startswith('lat'):
            off.x += (-0.25 if name == 'lat-esq' else 0.25) * travel
        sway = 0.05 * math.cos(u * math.pi * 3) * (1 - u) ** 2
        if name in DROP:
            rot[0] += sway
            rot[1] += sway * 0.6
        if name.startswith('porta'):
            # porta não cai do céu: chega pelo lado, já aberta, e encaixa na dobradiça
            off = Vector((2.6 * (1 if name == 'porta-1' else -1), -0.15, 0.0)) * travel + Vector((0, 0, 0.012)) * seat
    else:  # chega pelo lado (de fora do quadro), alinha na frente do vão e é empurrado para dentro
        sx = 3.2 if home.x > DIV else -3.2
        off = Vector((sx, -0.55, 0.0)) * travel + Vector((0, -0.28 * (1 - travel), 0.015)) * seat
        if travel > 0:
            off.y = -0.55 * max(travel, 1 - inout(win(u, 0.55, 1)))
    ob.location = home + off
    ob.rotation_euler = rot


def state(t):
    for n in STEPS:
        place(n, t)
    # portas: chegam abertas (100°), fecham com amortecimento e abrem de novo com a luz
    # fechamento com amortecedor: embala e desacelera muito nos últimos graus
    c = win(t, 0.76, 0.87)
    close = 1 - (1 - c) ** 4 if c < 1 else 1
    reopen = io3(win(t, 0.90, 0.99))
    ang = math.radians(95) * (1 - close) + math.radians(95) * reopen
    for side, hinge in doors:
        hinge.rotation_euler = (0, 0, side * ang)
    on = inout(win(t, 0.88, 0.97))
    M['led'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 9 * on
    led_d.energy = 28 * on
    parts['led-fita'].hide_render = t < 0.6
    # câmera: um arco lento de três quartos (esquerda, alto) até de frente, aproximando
    e = inout(t)
    yaw = math.radians(-22 + 16 * e)
    dist = 5.3 - 0.75 * e
    hgt = 1.5 - 0.3 * e
    cam.location = TARGET + Vector((math.sin(yaw) * dist, -math.cos(yaw) * dist, hgt - TARGET.z))
    cam.rotation_euler = (TARGET - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam_d.dof.focus_distance = (cam.location - Vector((0, -0.3, 1.0))).length
    if args.closeup:
        cam.location = Vector((0.2, -1.6, 1.3))
        cam.rotation_euler = (Vector((0.35, -0.3, 1.1)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam_d.dof.focus_distance = 1.4


N = args.frames
frames = [int(x) for x in args.only.split(',')] if args.only else range(N)
for f in frames:
    state(f / (N - 1))
    sc.render.filepath = os.path.join(args.out, f'q{f:04d}.png')
    bpy.ops.render.render(write_still=True)
    print('quadro', f, flush=True)
