# Lâmina de carvalho claro (imagem quadrada = 2,4 × 2,4 m), gerada sem imagem externa.
# Corte "flat-sawn": anéis de crescimento com espaçamento irregular cortados pelo plano
# formam catedrais; fibras finas, manchas longas e poros no sentido do veio.
# x da imagem = ao longo do veio. Saída: cor (sRGB) e relevo.
import numpy as np


class Noise:
    def __init__(self, seed):
        r = np.random.default_rng(seed)
        self.perm = np.concatenate([r.permutation(256)] * 2)
        self.vals = r.random(256)

    def __call__(self, x, y):
        xi, yi = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
        xf, yf = x - xi, y - yi
        X, Y = xi & 255, yi & 255
        u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
        p, V = self.perm, self.vals
        a = V[p[X + p[Y]]]; b = V[p[X + 1 + p[Y]]]
        c = V[p[X + p[Y + 1]]]; d = V[p[X + 1 + p[Y + 1]]]
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v

    def fbm(self, x, y):
        return self(x, y) * 0.57 + self(x * 2.03, y * 2.03) * 0.29 + self(x * 4.1, y * 4.1) * 0.14


def oak(size=2048, seed=7, rings=110, arch=0.22):
    nz = Noise(seed)
    rng = np.random.default_rng(seed + 1)
    ox, oy = rng.random() * 50, rng.random() * 50
    y, x = np.mgrid[0:size, 0:size].astype(np.float64)
    u, v = x / size, y / size
    warp = nz.fbm(ox + u * 1.6, oy + v * 2.4) - 0.5
    cath = (u - 0.5 - warp * 0.35) ** 2 * arch
    r = (v + cath + warp * 0.035 + (nz(ox + u * 5, oy + v * 40) - 0.5) * 0.004) * rings \
        + (nz.fbm(ox * 0.5 + u * 0.4, oy + v * 5) - 0.5) * rings * 0.12
    n = np.floor(r)
    ring = r - n
    strength = 0.35 + nz(n * 0.71 + 0.5, np.full_like(n, oy)) * 0.9
    late = (ring ** 6 * 0.8 + ring ** 2 * 0.2) * strength
    fiber = nz(ox + u * 7, oy + v * size * 0.5) - 0.5
    streak = nz.fbm(oy + u * 0.7, ox + v * 7) - 0.5
    kL = np.clip(0.18 + streak * 0.9 - late * 0.5, 0, None)[..., None]
    kD = np.clip(late * 0.42 + np.maximum(0, -streak) * 0.35 + fiber * 0.12 + 0.03, 0, 1)[..., None]
    B = np.array([0.70, 0.52, 0.34]); D = np.array([0.46, 0.31, 0.18]); L = np.array([0.80, 0.64, 0.45])
    lit = B + (L - B) * kL
    col = lit + (D - lit) * kD
    # poros: traços curtos e escuros ao longo do veio
    pr = np.zeros((size, size))
    for _ in range(size * 6):
        l = int(3 + rng.random() * 12); t = 1
        px, py = int(rng.random() * size), int(rng.random() * size)
        pr[py:py + t, px:px + l] += 0.04 + rng.random() * 0.1
    col *= (1 - np.clip(pr, 0, 0.3))[..., None]
    height = 1 - np.clip(late * 0.7 + pr * 2, 0, 1)
    return np.clip(col, 0, 1), height


if __name__ == '__main__':
    import sys
    from PIL import Image
    c, h = oak()
    Image.fromarray((c * 255).astype(np.uint8)).save(sys.argv[1])
    Image.fromarray((h * 255).astype(np.uint8)).save(sys.argv[2])
