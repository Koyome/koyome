# split-chapel.py — re-cut the chapel into TWO same-size layers:
# building (site ink) + star burst (accent red), so the star alone can
# glow in dark mode. Soft 28px alpha-blend zone hides the seam.
import numpy as np
from PIL import Image

INK = (59, 58, 56)      # --ink #3b3a38
ACCENT = (158, 43, 37)  # --accent #9e2b25

SRC = 'C:/Users/杨坤/Pictures/Saved Pictures/9DF58805474C1DFC3C2C1A66A0B3876C.jpg'
A = 'C:/Users/Public/koyome-site/docs/assets/'

im = Image.open(SRC).convert('RGB')
a = np.asarray(im).astype(np.float32)
l = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
alpha = np.clip((l - 18) * 1.1, 0, 255)
alpha[alpha < 14] = 0

# trim to content, pad, cap width (same pipeline as cutout-deco.py)
tmp = Image.fromarray(np.dstack([np.zeros_like(l), np.zeros_like(l), np.zeros_like(l), alpha]).astype(np.uint8), 'RGBA')
bbox = tmp.getbbox()
tmp = tmp.crop(bbox)
pad = max(6, tmp.width // 100)
canvas = Image.new('RGBA', (tmp.width + pad * 2, tmp.height + pad * 2), (0, 0, 0, 0))
canvas.paste(tmp, (pad, pad))
if canvas.width > 1400:
    canvas = canvas.resize((1400, round(canvas.height * 1400 / canvas.width)), Image.LANCZOS)
al = np.asarray(canvas)[..., 3].astype(np.float32)

H = al.shape[0]
CUT = int(H * 0.435)          # star rays end just above the roofline
BLEND = 28
t = np.clip((np.arange(H) - (CUT - BLEND // 2)) / BLEND, 0, 1)  # 0=star … 1=building
star_mask = (1 - t)[:, None]
build_mask = t[:, None]

def layer(mask, color, dst):
    out = np.zeros((H, al.shape[1], 4), dtype=np.uint8)
    out[..., 0], out[..., 1], out[..., 2] = color
    out[..., 3] = np.clip(al * mask, 0, 255).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(dst, 'WEBP', quality=90, method=6)
    print(dst, canvas.size)

layer(build_mask, INK, A + 'deco_chapel.webp')
layer(star_mask, ACCENT, A + 'deco_chapel_star.webp')
