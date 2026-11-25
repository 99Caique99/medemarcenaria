# Prepara as 9 fotos da montagem (assets/montagem/etapa-0N.png) para a animação:
#   1. alinha todas pelo móvel (mesma largura, centro e linha do chão) num quadro 1200×1200;
#   2. completa o que falta da parede/chão nas bordas (as fotos 4–9 cortam o topo do móvel);
#   3. recorta as peças que entram em cada etapa (com transparência) e as folhas das portas;
#   4. gera a etapa 0 (sala vazia) apagando a base da foto 1.
# Saída: .cache/montagem/*.png + montagem.json → depois `node scripts/build-montagem.mjs`.
#   pip install opencv-python-headless numpy && python3 scripts/montagem.py
import json, os
import cv2
import numpy as np

SRC = 'assets/montagem'
OUT = '.cache/montagem'
os.makedirs(OUT, exist_ok=True)
C, WC, CX, BC = 1200, 600, 600, 1008  # quadro, largura do móvel, centro, linha do chão
# Medidas de cada foto original: borda esquerda/direita do móvel e linha de baixo (px)
MEAS = {1: (394, 1544, 960), 2: (497, 1468, 971), 3: (519, 1432, 966), 4: (530, 1399, 989), 5: (524, 1410, 995),
        6: (535, 1425, 994), 7: (610, 1440, 980), 8: (548, 1393, 979), 9: (548, 1409, 985)}
rng = np.random.default_rng(1)


def wood_mask(img, sat=90):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    return ((hsv[..., 0] > 5) & (hsv[..., 0] < 25) & (hsv[..., 1] > sat)).astype(np.uint8) * 255


def align(i):
    L, R, b = MEAS[i]
    im = cv2.imread(f'{SRC}/etapa-{i:02d}.png')
    s = WC / (R - L)
    M = np.float32([[s, 0, CX - (L + R) / 2 * s], [0, s, BC - b * s]])
    w = cv2.warpAffine(im, M, (C, C), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REPLICATE)
    inside = cv2.warpAffine(np.full(im.shape[:2], 255, np.uint8), M, (C, C), flags=cv2.INTER_NEAREST, borderValue=0)
    inside = cv2.erode(inside, np.ones((5, 5), np.uint8))
    known = (inside > 0) & (cv2.dilate(wood_mask(w), np.ones((25, 25), np.uint8)) == 0)
    # Fora da foto: parede/chão reconstruídos em baixa resolução (liso) + grão de foto
    S = 120
    small = cv2.resize(w, (S, S), interpolation=cv2.INTER_AREA)
    unk = cv2.dilate(cv2.resize((~known).astype(np.uint8) * 255, (S, S), interpolation=cv2.INTER_NEAREST), np.ones((3, 3), np.uint8))
    fill = cv2.inpaint(small, unk, 8, cv2.INPAINT_TELEA)
    fill = cv2.GaussianBlur(cv2.resize(fill, (C, C), interpolation=cv2.INTER_CUBIC), (0, 0), 10).astype(np.float32)
    fill += rng.normal(0, 2.2, fill.shape).astype(np.float32)
    a = cv2.GaussianBlur(inside.astype(np.float32) / 255, (0, 0), 4)[..., None]
    return np.clip(w * a + fill * (1 - a), 0, 255).astype(np.uint8)


F = {i: align(i) for i in range(1, 10)}


def hull_mask(mask, keep):
    n, lab, st, _ = cv2.connectedComponentsWithStats(mask)
    out = np.zeros_like(mask)
    for k in range(1, n):
        if keep(st[k]):
            pts = cv2.findNonZero((lab == k).astype(np.uint8))
            cv2.fillConvexPoly(out, cv2.convexHull(pts), 255)
    return out


def clean(m):
    return cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))


pieces = {}


def save_piece(name, img, mask, feather=1.2):
    a = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), feather)
    ys, xs = np.where(a > 4)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    rgba = np.dstack([img, np.clip(a, 0, 255).astype(np.uint8)])[y0:y1, x0:x1]
    cv2.imwrite(f'{OUT}/{name}.png', rgba)
    pieces[name] = dict(x=int(x0), y=int(y0), w=int(x1 - x0), h=int(y1 - y0))
    return mask


# 1 · base (com os pés) — e a sala vazia (etapa 0) apagando-a da foto 1
w1 = clean(wood_mask(F[1]))
base = hull_mask(w1, lambda s: s[4] > 2000)
ys, xs = np.where(base > 0)
feet = np.zeros_like(base)
cv2.rectangle(feet, (int(xs.min()), int(ys.max()) - 4), (int(xs.max()), int(ys.max()) + 22), 255, -1)
dark = (cv2.cvtColor(F[1], cv2.COLOR_BGR2GRAY) < 110).astype(np.uint8) * 255
base = cv2.bitwise_or(base, cv2.bitwise_and(feet, dark))
save_piece('p1', F[1], cv2.dilate(base, np.ones((3, 3), np.uint8)))
# Base, pés e sombra num retângulo; cada linha é refeita interpolando a parede/chão
# dos dois lados (preserva o rodapé da parede e o degradê do chão) + grão de foto.
hx0, hx1 = int(xs.min()) - 40, int(xs.max()) + 40
hy0, hy1 = int(ys.min()) - 12, int(ys.max()) + 46
F0 = F[1].astype(np.float32)
band = 24
for y in range(hy0, hy1):
    l = F0[y, hx0 - band:hx0].mean(0)
    r = F0[y, hx1:hx1 + band].mean(0)
    k = np.linspace(0, 1, hx1 - hx0)[:, None]
    F0[y, hx0:hx1] = l * (1 - k) + r * k
F0[hy0:hy1, hx0:hx1] += rng.normal(0, 2.2, (hy1 - hy0, hx1 - hx0, 3))
soft = np.zeros((C, C), np.float32)
soft[hy0:hy1, hx0:hx1] = 1
soft = cv2.GaussianBlur(soft, (0, 0), 3)[..., None]
F[0] = np.clip(F0 * soft + F[1] * (1 - soft), 0, 255).astype(np.uint8)

# 2 · laterais (acima da base)
w2 = clean(wood_mask(F[2]))
rows = np.where((w2 > 0).sum(1) > 0.8 * WC)[0]
w2[rows.min() - 3:] = 0
save_piece('p2', F[2], cv2.dilate(hull_mask(w2, lambda s: s[4] > 800), np.ones((5, 5), np.uint8)))

# 3 · tampo (a peça mais alta e baixa em altura)
w3 = clean(wood_mask(F[3]))
save_piece('p3', F[3], cv2.dilate(hull_mask(w3, lambda s: s[3] < 90 and s[2] > 300 and s[1] < 600), np.ones((7, 7), np.uint8)))

# 5–6 · prateleiras/divisória e gavetas/cabideiro: diferença entre etapas, só dentro do móvel
box = np.zeros((C, C), np.uint8)
cv2.rectangle(box, (300, 352), (900, 1000), 255, -1)
for i in (5, 6):
    d = np.abs(cv2.GaussianBlur(F[i], (0, 0), 3).astype(np.float32) - cv2.GaussianBlur(F[i - 1], (0, 0), 3)).max(2)
    m = clean((d > 28).astype(np.uint8) * 255) & box
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    m = np.isin(lab, [k for k in range(1, n) if st[k][4] > 1500]).astype(np.uint8) * 255
    save_piece(f'p{i}', F[i], cv2.dilate(m, np.ones((5, 5), np.uint8)), feather=2.5)

# 8 · folhas das portas fechadas (giram nas dobradiças entre as etapas 7→8→9)
for name, (x0, x1) in {'portaE': (300, 560), 'portaD': (560, 831)}.items():
    m = np.zeros((C, C), np.uint8)
    cv2.rectangle(m, (x0, 324), (x1, 996), 255, -1)
    save_piece(name, F[8], m, feather=0.6)

for i, img in F.items():
    cv2.imwrite(f'{OUT}/f{i}.png', img)
json.dump({'size': C, 'pieces': pieces}, open(f'{OUT}/montagem.json', 'w'), indent=2)
print(json.dumps(pieces))
