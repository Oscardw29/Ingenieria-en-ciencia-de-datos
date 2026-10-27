"""Muestrea el logo en partículas: [x, y, categoría] con x,y en -1000..1000.

Uso: python3 tools/generate_points.py <logo_original.webp> js/logo-points.js
"""
import json, random, sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGBA")
W = im.width
px = im.load()

REF = [  # (category, rgb, keep probability)
    (0, (255, 255, 255), 0.95),  # white lettering
    (1, (30, 74, 144), 0.3),    # ring borders
    (2, (5, 29, 77), 0.05),      # navy ring background
    (3, (212, 216, 252), 0.075), # lavender disc
    (4, (39, 16, 92), 0.42),     # gear + wave
    (5, (125, 157, 242), 0.7),   # light bars / binary digits
    (6, (97, 70, 219), 0.7),     # violet bar
    (7, (74, 20, 160), 0.7),     # deep violet bar
]
random.seed(7)
STEP = 9
pts = []
for y in range(0, W, STEP):
    for x in range(0, W, STEP):
        jx = min(W - 1, x + random.randint(0, STEP - 1))
        jy = min(W - 1, y + random.randint(0, STEP - 1))
        r, g, b, a = px[jx, jy]
        if a < 160:
            continue
        cat, _, keep = min(REF, key=lambda c: sum((u - v) ** 2 for u, v in zip(c[1], (r, g, b))))
        if random.random() > keep:
            continue
        nx = round((jx / W * 2 - 1) * 1000)
        ny = round((jy / W * 2 - 1) * 1000)
        pts.append((nx, ny, cat))

random.shuffle(pts)
flat = [v for p in pts for v in p]
counts = {}
for p in pts:
    counts[p[2]] = counts.get(p[2], 0) + 1
print(len(pts), counts)
with open(out, "w") as f:
    f.write("/* Generado a partir de assets/logo.webp: [x, y, categoría] normalizados en -1000..1000. */\n")
    f.write("window.LOGO_POINTS = " + json.dumps(flat, separators=(",", ":")) + ";\n")
